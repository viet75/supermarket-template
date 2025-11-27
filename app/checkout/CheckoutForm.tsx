'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Skeleton from '@/components/Skeleton'
import type { StoreSettings, PaymentMethod, OrderItem, OrderAddress, OrderPayload } from '@/lib/types'
import { computeDeliveryFee, validateDelivery, allowedPaymentMethods } from '@/lib/delivery'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { useCartStore } from '@/stores/cartStore'

type Props = { settings: StoreSettings }

const round2 = (n: number) => Math.round(n * 100) / 100

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


    const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    // 🔧 Calcolo automatico della distanza con Nominatim
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
                        setIsAddressValid(km > 0 && km <= settings.delivery_max_km)
                        setLoadingDistance(false)
                        return
                    }
                }

                // ✅ STEP 2.2 — Chiamata Nominatim solo se cache assente o scaduta
                const coords = await geocodeAddress(full)
                if (coords) {
                    const km = computeDistanceFromStore(settings, coords)
                    setDistanceKm(km)
                    setIsAddressValid(km > 0 && km <= settings.delivery_max_km)


                    // ✅ STEP 2.3 — Salvataggio in cache
                    localStorage.setItem(full, JSON.stringify({
                        coords,
                        km,
                        timestamp: Date.now()
                    }))
                } else {
                    setDistanceKm(0)
                    setIsAddressValid(false)
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


    const fee = useMemo(
        () => computeDeliveryFee(distanceKm, settings),
        [distanceKm, settings]
    )

    const validation = useMemo(
        () => validateDelivery(distanceKm, settings),
        [distanceKm, settings, addr]
    )

    const methods = allowedPaymentMethods(settings)
    const [pay, setPay] = useState<PaymentMethod>('cash')
    const total = useMemo(() => round2(subtotal + fee), [subtotal, fee])
    const emptyCart = items.length === 0

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

        const payload: OrderPayload = {
            items: items.map((it) => ({
                id: it.id,
                name: it.name,
                price: Number(it.price),
                qty: Number(it.qty) || 0,
            })) as OrderItem[],
            subtotal,
            delivery_fee: fee,
            total,
            distance_km: dist,
            payment_method: pay,
            address: addr,
        }

        try {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
            const res = await fetch(`${baseUrl}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const text = await res.text()
            let data: any = null
            try { data = JSON.parse(text) } catch { }

            if (!res.ok) {
                if (res.status === 409) {
                    setMsg({
                        type: 'error',
                        text: '⚠️ Alcuni prodotti non sono più disponibili nelle quantità richieste. Aggiorna il carrello.',
                    })
                } else {
                    setMsg({ type: 'error', text: data?.error ?? `Errore API (${res.status})` })
                }
                return
            }

            const orderId = data?.id ?? ''
            if (pay === 'card_online') {
                const res2 = await fetch(`${baseUrl}/api/checkout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        total: data?.total ?? 0,
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


                const checkout = await res2.json()

                if (res2.ok && checkout.url) {
                    clearCart()
                    window.location.href = checkout.url
                    return
                } else {
                    setMsg({
                        type: 'error',
                        text: checkout.error ?? 'Errore creazione checkout online',
                    })
                    return
                }
            }

            setMsg({ type: 'success', text: 'Ordine creato con successo!' })
            clearCart()
            router.push(`/order/success?id=${encodeURIComponent(orderId)}`)
        } catch (e: any) {
            console.error(e)
            setMsg({ type: 'error', text: e?.message ?? 'Errore imprevisto' })
        } finally {
            setSaving(false)
        }
    }, [items, addr, subtotal, fee, pay, settings, validation, clearCart, router])

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
                                        {m === 'cash' && '💵'}
                                        {m === 'card_online' && '💳'}
                                        {m === 'card_on_delivery' && '🏠💳'}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {m === 'cash' && 'Pagamento in contanti alla consegna'}
                                        {m === 'card_online' && 'Pagamento con carta online'}
                                        {m === 'card_on_delivery' && 'Pagamento con carta al domicilio'}
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
                                {loadingDistance
                                    ? '...'
                                    : distanceKm > 0
                                        ? `€${fee.toFixed(2)} (${distanceKm} km)`
                                        : '—'}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg">
                        <span>Totale</span>
                        <span>€{total.toFixed(2)}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={confirmOrder}
                    disabled={saving || emptyCart || !isAddressValid || !addr.firstName || !addr.lastName}
                    className={`w-full rounded-xl font-semibold px-4 py-3 transition 
    ${isAddressValid
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
                >
                    {saving ? '⏳ Elaborazione…' : 'Conferma ordine'}
                </button>

            </aside>
        </div>
    )
}
