'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/Skeleton'
import type { StoreSettings, PaymentMethod, OrderItem, OrderAddress, OrderPayload } from '@/lib/types'
import { validateDelivery, allowedPaymentMethods } from '@/lib/delivery'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { useCartStore } from '@/stores/cartStore'

type Props = { settings: StoreSettings }

const round2 = (n: number) => Math.round(n * 100) / 100

// Mappa dei metodi di pagamento per rendering dinamico
const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { icon: string; label: string }> = {
    cash: { icon: '💵', label: 'Pagamento in contanti alla consegna' },
    pos_on_delivery: { icon: '💳🏠', label: 'Pagamento con POS alla consegna' },
    card_online: { icon: '💳', label: 'Pagamento con carta online' },
}

export default function CheckoutForm({ settings }: Props) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const [hydrated, setHydrated] = useState(false)
    useEffect(() => {
        setHydrated((useCartStore.persist as any)?.hasHydrated?.() ?? false)
        const unsub = (useCartStore.persist as any)?.onFinishHydration?.(() => setHydrated(true))
        return () => { if (typeof unsub === 'function' && unsub) unsub() }
    }, [])

    const items = useCartStore((s) => s.items || [])
    const clearCart = useCartStore((s) => s.clear)

    const subtotal = useMemo(
        () =>
            round2(
                items.reduce((sum: number, it: any) => sum + Number(it.price || 0) * Number(it.qty || 0), 0)
            ),
        [items]
    )

    // 🔹 aggiunti firstName e lastName
    const [addr, setAddr] = useState<OrderAddress>({ firstName: '', lastName: '', line1: '', city: '', cap: '', note: '' })
    const [distanceKm, setDistanceKm] = useState<number>(0)
    const [loadingDistance, setLoadingDistance] = useState(false)
    const [isAddressValid, setIsAddressValid] = useState(false)
    const [distanceError, setDistanceError] = useState<string | null>(null)

    const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    // Valori calcolati dal backend (disponibili solo dopo la creazione dell'ordine)
    const [backendDeliveryFee, setBackendDeliveryFee] = useState<number | null>(null)
    const [backendTotal, setBackendTotal] = useState<number | null>(null)
    const [backendDistanceKm, setBackendDistanceKm] = useState<number | null>(null)

    // Preview della consegna (calcolata prima della creazione dell'ordine)
    const [previewDeliveryFee, setPreviewDeliveryFee] = useState<number | null>(null)
    const [previewDistanceKm, setPreviewDistanceKm] = useState<number | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)

    // Reset valori backend quando cambia l'indirizzo
    useEffect(() => {
        setBackendDeliveryFee(null)
        setBackendTotal(null)
        setBackendDistanceKm(null)
        setPreviewDeliveryFee(null)
        setPreviewDistanceKm(null)
    }, [addr.line1, addr.city, addr.cap])

    // 🔧 Calcolo automatico della distanza con Google Maps
    useEffect(() => {
        if (!addr.line1 || !addr.city || !addr.cap) return

        const handler = setTimeout(async () => {
            setLoadingDistance(true)
            const full = `${addr.line1}, ${addr.cap} ${addr.city}, Italia`

            try {
                // ✅ STEP 2.1 — Controllo cache locale
                const cached = localStorage.getItem(full)
                if (cached) {
                    const { coords, km, timestamp } = JSON.parse(cached)

                    // Se cache recente (meno di 7 giorni), usala
                    const validCache = Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000
                    if (validCache) {
                        setDistanceKm(km)
                        const validation = validateDelivery(km, settings)
                        if (km > settings.delivery_max_km) {
                            setIsAddressValid(false)
                            setDistanceError(`La consegna non è disponibile per questo indirizzo (${km.toFixed(1)} km, massimo ${settings.delivery_max_km} km).`)
                        } else {
                            setIsAddressValid(validation.ok)
                            setDistanceError(null)
                        }
                        setLoadingDistance(false)
                        return
                    }
                }

                // ✅ STEP 2.2 — Chiamata Google Maps solo se cache assente o scaduta
                const coords = await geocodeAddress(full)
                if (coords) {
                    const km = computeDistanceFromStore(settings, coords)
                    setDistanceKm(km)
                    const validation = validateDelivery(km, settings)
                    if (km > settings.delivery_max_km) {
                        setIsAddressValid(false)
                        setDistanceError(`La consegna non è disponibile per questo indirizzo (${km.toFixed(1)} km, massimo ${settings.delivery_max_km} km).`)
                    } else {
                        setIsAddressValid(validation.ok)
                        setDistanceError(null)
                    }

                    // ✅ STEP 2.3 — Salvataggio in cache
                    localStorage.setItem(full, JSON.stringify({
                        coords,
                        km,
                        timestamp: Date.now()
                    }))
                } else {
                    setIsAddressValid(false)
                    setDistanceError("Indirizzo non riconosciuto. Controlla via, numero civico e CAP.")
                    setDistanceKm(0)
                }
            } catch (err) {
                console.error('Errore geocodifica:', err)
                setIsAddressValid(false)
            } finally {
                setLoadingDistance(false)
            }
        }, 600) // leggero debounce per digitazione

        return () => clearTimeout(handler)
    }, [addr, settings])

    // 🔧 Preview del delivery fee (calcolata lato server)
    useEffect(() => {
        if (!settings.delivery_enabled) return
        if (!addr.line1 || !addr.city || !addr.cap) {
            setPreviewDeliveryFee(null)
            setPreviewDistanceKm(null)
            return
        }

        const handler = setTimeout(async () => {
            setLoadingPreview(true)
            try {
                const res = await fetch('/api/delivery/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address: addr.line1,
                        city: addr.city,
                        cap: addr.cap,
                    }),
                })

                if (!res.ok) {
                    const text = await res.text()
                    console.error('❌ API error /api/delivery/preview:', text)
                    // Se errore (es. indirizzo fuori zona), resetta la preview
                    setPreviewDeliveryFee(null)
                    setPreviewDistanceKm(null)
                    return
                }

                const data = await res.json()
                setPreviewDeliveryFee(data.delivery_fee ?? null)
                setPreviewDistanceKm(data.distance_km ?? null)
            } catch (err) {
                console.error('Errore preview consegna:', err)
                setPreviewDeliveryFee(null)
                setPreviewDistanceKm(null)
            } finally {
                setLoadingPreview(false)
            }
        }, 600) // debounce per evitare troppe chiamate

        return () => clearTimeout(handler)
    }, [addr.line1, addr.city, addr.cap, settings.delivery_enabled])

    const validation = useMemo(() => {
        // Se la consegna è disabilitata, l'indirizzo è sempre valido (non serve validare distanza)
        if (!settings.delivery_enabled) {
            return { ok: true }
        }
        // Se la consegna è abilitata ma l'indirizzo non è completo, non è ancora valido
        if (!addr.line1 || !addr.city || !addr.cap) {
            return { ok: false, reason: 'Compila tutti i campi dell\'indirizzo' }
        }
        // Se la distanza è ancora in calcolo, attendi prima di validare
        if (loadingDistance) {
            return { ok: false, reason: 'Calcolo distanza in corso...' }
        }
        // Se la distanza non è ancora stata calcolata (0 e non in loading), non è valido
        if (distanceKm === 0) {
            return { ok: false, reason: 'Indirizzo non riconosciuto' }
        }
        // Valida la distanza solo se è stata calcolata
        return validateDelivery(distanceKm, settings)
    }, [distanceKm, settings, addr, loadingDistance])

    const methods = allowedPaymentMethods(settings)
    const [pay, setPay] = useState<PaymentMethod>('cash')
    const emptyCart = hydrated && items.length === 0

    const [saving, setSaving] = useState(false)

    const confirmOrder = useCallback(async () => {
        setMsg(null)
        setSaving(true) // 🔹 feedback immediato

        if (items.length === 0) {
            setMsg({ type: 'error', text: 'Carrello vuoto' })
            setSaving(false)
            return
        }
        if (!validation.ok) {
            setMsg({ type: 'error', text: validation.reason ?? 'Indirizzo non valido' })
            setSaving(false)
            return
        }
        if (!addr.firstName || !addr.lastName || !addr.line1 || !addr.city || !addr.cap) {
            setMsg({ type: 'error', text: 'Compila tutti i campi obbligatori' })
            setSaving(false)
            return
        }

        const coords = await geocodeAddress(`${addr.line1}, ${addr.cap} ${addr.city}, Italia`)
        const dist = computeDistanceFromStore(settings, coords)
        console.log('🧪 PAYMENT METHOD AL SUBMIT:', pay)
        console.log('🧪 AVAILABLE METHODS:', methods)

        const payload: OrderPayload = {
            items: items.map((it) => ({
                id: it.id,
                name: it.name,
                price: Number(it.price),
                qty: Number(it.qty) || 0,
            })) as OrderItem[],
            subtotal,
            delivery_fee: 0, // Ignorato dal backend, calcolato lato server
            total: 0, // Ignorato dal backend, calcolato lato server
            distance_km: dist,
            payment_method: pay,
            address: addr,
        }

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('❌ API error /api/orders:', text)
                let data: any = null
                try { data = JSON.parse(text) } catch { }
                
                if (res.status === 409) {
                    setMsg({
                        type: 'error',
                        text: '⚠️ Alcuni prodotti non sono più disponibili nelle quantità richieste. Aggiorna il carrello.',
                    })
                } else {
                    setMsg({ type: 'error', text: data?.error ?? `Errore API (${res.status})` })
                }
                setSaving(false)
                return
            }

            const data = await res.json()
            // 🔍 Log temporaneo della response JSON
            console.log('📦 Response da /api/orders:', JSON.stringify(data, null, 2))

            // Salva i valori calcolati dal backend
            if (data?.delivery_fee !== undefined) setBackendDeliveryFee(data.delivery_fee)
            if (data?.total !== undefined) setBackendTotal(data.total)
            if (data?.distance_km !== undefined) setBackendDistanceKm(data.distance_km)

            // ✅ Allineato alla struttura reale della response: usa order_id invece di id
            const orderId = data?.order_id ?? data?.id ?? ''

            if (pay === 'card_online') {
                // ✅ Verifica che orderId non sia vuoto prima di chiamare /api/checkout
                if (!orderId) {
                    setMsg({ type: 'error', text: 'Errore: orderId mancante nella response' })
                    setSaving(false)
                    return
                }

                const res2 = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        total: backendTotal ?? data?.total ?? 0,
                        items: payload.items.map((it: any) => ({
                            id: it.id,
                            name: it.name,
                            price: it.price,
                            quantity: it.qty ?? it.quantity ?? 1,
                            unit: it.unit ?? undefined,
                            image_url: it.image_url ?? null,
                        })),
                    }),
                })

                if (!res2.ok) {
                    const text = await res2.text()
                    console.error('❌ API error /api/checkout:', text)
                    let checkoutData: any = null
                    try { checkoutData = JSON.parse(text) } catch { }
                    setMsg({
                        type: 'error',
                        text: checkoutData?.error ?? `Errore API (${res2.status})`,
                    })
                    setSaving(false)
                    return
                }

                const checkout = await res2.json()
                if (checkout.url) {
                    clearCart()
                    window.location.href = checkout.url
                    return
                } else {
                    setMsg({
                        type: 'error',
                        text: checkout.error ?? 'Errore creazione checkout online',
                    })
                    setSaving(false)
                    return
                }
            }

            setMsg({ type: 'success', text: 'Ordine creato con successo!' })
            clearCart()
            router.push(`/order/success?id=${encodeURIComponent(orderId)}`)
        } catch (e: any) {
            console.error(e)
            setMsg({ type: 'error', text: e?.message ?? 'Errore imprevisto' })
            setSaving(false)
        }
    }, [items, addr, subtotal, pay, settings, validation, clearCart, router, backendTotal])

    if (!mounted) return <Skeleton />
    if (!hydrated && items.length === 0) return <Skeleton />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6 rounded-2xl border p-6 shadow-md bg-white dark:bg-gray-900">
                {msg && (
                    <div
                        className={`rounded-md p-3 text-sm flex items-center justify-center ${msg.type === 'error'
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-green-100 text-green-700 border border-green-300'
                            }`}
                    >
                        {msg.type === 'error' ? '⚠️' : '✅'} {msg.text}
                    </div>
                )}

                <h2 className="text-lg font-semibold">📍 Dati cliente</h2>
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium">Nome</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            value={addr.firstName}
                            onChange={(e) => setAddr({ ...addr, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Cognome</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            value={addr.lastName}
                            onChange={(e) => setAddr({ ...addr, lastName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Via e numero civico</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            value={addr.line1}
                            onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Città</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={addr.city}
                            onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">CAP</label>
                        <input
                            type="text"
                            pattern="[0-9]{5}"
                            title="Inserisci un CAP valido a 5 cifre"
                            required
                            maxLength={5}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            value={addr.cap}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "")
                                setAddr({ ...addr, cap: val })
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Note per il corriere</label>
                        <textarea
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                            value={addr.note ?? ''}
                            onChange={(e) => setAddr({ ...addr, note: e.target.value })}
                        />
                    </div>
                </div>

                {settings.delivery_enabled && (
                    <div className="mt-4">
                        <h2 className="text-lg font-semibold mb-1">📏 Distanza</h2>
                        <div className="w-full rounded-lg border px-3 py-2 text-sm bg-gray-50">
                            {loadingDistance
                                ? "Calcolo in corso..."
                                : distanceKm > 0
                                    ? `${distanceKm} km`
                                    : "Inserisci indirizzo per calcolare"}
                        </div>
                        {!validation.ok && (
                            <p className="text-xs text-red-600 mt-1">
                                {validation.reason === "Indirizzo non valido"
                                    ? "Indirizzo non riconosciuto. Inserisci via, numero civico e CAP a 5 cifre."
                                    : validation.reason}
                            </p>
                        )}
                    </div>
                )}

                {methods.length > 0 && (
                    <div className="mt-4">
                        <h2 className="text-lg font-semibold mb-2">💳 Metodo di pagamento</h2>
                        <div className="space-y-2">
                            {methods.map((m) => (
                                <label
                                    key={m}
                                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${pay === m ? 'border-green-600 bg-green-50' : 'border-gray-200'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        value={m}
                                        checked={pay === m}
                                        onChange={() => setPay(m)}
                                        className="hidden"
                                    />
                                    <span className="text-lg">
                                        {PAYMENT_METHOD_CONFIG[m]?.icon || '💳'}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {PAYMENT_METHOD_CONFIG[m]?.label || m}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <aside className="space-y-6 rounded-2xl border p-6 shadow-md bg-white dark:bg-gray-900 h-fit">
                <h2 className="text-lg font-semibold">🛒 Riepilogo ordine</h2>

                <ul className="divide-y text-sm">
                    {items.map((it: any) => (
                        <li key={it.id} className="flex justify-between py-2">
                            <span>{it.name} × {it.qty}</span>
                            <span>€{(Number(it.price) * it.qty).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>

                <div className="border-t pt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotale</span>
                        <span>€{subtotal.toFixed(2)}</span>
                    </div>
                    {settings.delivery_enabled && (
                        <div className="flex justify-between">
                            <span>Consegna</span>
                            <span>
                                {backendDeliveryFee !== null
                                    ? backendDeliveryFee === 0
                                        ? 'Consegna gratuita'
                                        : `€${backendDeliveryFee.toFixed(2)} (${(backendDistanceKm ?? 0).toFixed(1)} km)`
                                    : previewDeliveryFee !== null
                                        ? previewDeliveryFee === 0
                                            ? 'Consegna gratuita (stima)'
                                            : `€${previewDeliveryFee.toFixed(2)} (stima)`
                                        : loadingPreview || loadingDistance
                                            ? '...'
                                            : '—'}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                        <span>Totale</span>
                        <span>
                            {backendTotal !== null
                                ? `€${backendTotal.toFixed(2)}`
                                : previewDeliveryFee !== null
                                    ? `€${(subtotal + previewDeliveryFee).toFixed(2)} (stima)`
                                    : `€${subtotal.toFixed(2)}`}
                        </span>
                    </div>
                </div>

                {distanceError && (
                    <div className="p-3 mb-3 text-sm text-white bg-red-500 rounded-lg">
                        {distanceError}
                    </div>
                )}

                <button
                    type="button"
                    onClick={confirmOrder}
                    disabled={saving || !validation.ok}

                    className={`w-full rounded-xl font-semibold px-4 py-3 transition 
    ${validation.ok && addr.firstName && addr.lastName
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                >
                    {saving ? '⏳ Elaborazione…' : 'Conferma ordine'}
                </button>

            </aside>
        </div>
    )
}
