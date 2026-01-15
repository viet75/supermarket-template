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

const CAP_ERR = "CAP non valido. Inserisci 5 cifre (es: 74123)."

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
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Helper per determinare il messaggio di errore con priorità
    const updateErrorMessage = (newError: string | null) => {
        if (!newError) {
            setErrorMessage(null)
            return
        }
        const errorLower = newError.toLowerCase()
        // Priorità: se contiene "CAP non valido" o parole chiave CAP -> mostra solo quello
        if (newError.includes("CAP non valido") || 
            errorLower.includes("cap") || 
            errorLower.includes("postal") || 
            errorLower.includes("codice postale") || 
            errorLower.includes("corrisponde")) {
            setErrorMessage(newError)
            return
        }
        // Priorità: se contiene "fuori dal raggio" o "non è disponibile" -> mostra solo quello
        if (newError.includes("fuori dal raggio") || newError.includes("non è disponibile")) {
            setErrorMessage(newError)
        } else {
            // Altrimenti mostra solo "indirizzo non riconosciuto, inserisci via completa..."
            const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
            // Aggiorna solo se non c'è già un errore "fuori raggio"
            setErrorMessage((prev) => {
                if (prev && (prev.includes("fuori dal raggio") || prev.includes("non è disponibile"))) {
                    return prev
                }
                return geocodeError
            })
        }
    }

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
        
        // Valida formato CAP prima di resettare errorMessage
        const capTrimmed = addr.cap ? String(addr.cap).trim() : ''
        const isCapValid = /^\d{5}$/.test(capTrimmed) && capTrimmed !== '00000'
        
        // Resetta errorMessage solo se il CAP è valido o vuoto (per permettere la validazione successiva)
        // Se il CAP non è valido, la validazione nell'useEffect successivo imposterà l'errore
        if (isCapValid || !addr.cap) {
            setErrorMessage(null)
            setDistanceError(null)
        }
    }, [addr.line1, addr.city, addr.cap])

    // 🔧 Calcolo automatico della distanza con Google Maps
    useEffect(() => {
        if (!addr.line1 || !addr.city || !addr.cap) return

        // Valida formato CAP prima di procedere
        const capTrimmed = String(addr.cap).trim()
        if (!/^\d{5}$/.test(capTrimmed) || capTrimmed === '00000') {
            setIsAddressValid(false)
            const capError = "CAP non valido. Inserisci un CAP a 5 cifre."
            setDistanceError(capError)
            updateErrorMessage(capError)
            setDistanceKm(0)
            return
        }

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
                            const radiusError = `La consegna non è disponibile per questo indirizzo (${km.toFixed(1)} km, massimo ${settings.delivery_max_km} km).`
                            setDistanceError(radiusError)
                            updateErrorMessage(radiusError)
                        } else {
                            setIsAddressValid(validation.ok)
                            setDistanceError(null)
                            updateErrorMessage(null)
                        }
                        setLoadingDistance(false)
                        return
                    }
                }

                // ✅ STEP 2.2 — Chiamata geocode con validazione CAP e città
                try {
                    const geocodeUrl = `/api/geocode?q=${encodeURIComponent(full)}&zip=${encodeURIComponent(addr.cap)}&city=${encodeURIComponent(addr.city)}`
                    const geocodeRes = await fetch(geocodeUrl)
                    
                    let geocodeData: any = null
                    try {
                        const text = await geocodeRes.text()
                        geocodeData = JSON.parse(text)
                    } catch {
                        setIsAddressValid(false)
                        const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                        setDistanceError(geocodeError)
                        updateErrorMessage(geocodeError)
                        setDistanceKm(0)
                        setLoadingDistance(false)
                        return
                    }

                    if (!geocodeData.ok) {
                        setIsAddressValid(false)
                        const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                        setDistanceError(geocodeError)
                        updateErrorMessage(geocodeError)
                        setDistanceKm(0)
                        setLoadingDistance(false)
                        return
                    }

                    const coords = { lat: geocodeData.lat, lng: geocodeData.lng }
                    const km = computeDistanceFromStore(settings, coords)
                    setDistanceKm(km)
                    const validation = validateDelivery(km, settings)
                    if (km > settings.delivery_max_km) {
                        setIsAddressValid(false)
                        const radiusError = `La consegna non è disponibile per questo indirizzo (${km.toFixed(1)} km, massimo ${settings.delivery_max_km} km).`
                        setDistanceError(radiusError)
                        updateErrorMessage(radiusError)
                    } else {
                        setIsAddressValid(validation.ok)
                        setDistanceError(null)
                        updateErrorMessage(null)
                    }

                    // ✅ STEP 2.3 — Salvataggio in cache
                    localStorage.setItem(full, JSON.stringify({
                        coords,
                        km,
                        timestamp: Date.now()
                    }))
                } catch (err) {
                    setIsAddressValid(false)
                    const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                    setDistanceError(geocodeError)
                    updateErrorMessage(geocodeError)
                    setDistanceKm(0)
                }
            } catch (err) {
                console.error('Errore geocodifica:', err)
                setIsAddressValid(false)
                const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                setDistanceError(geocodeError)
                updateErrorMessage(geocodeError)
                setDistanceKm(0)
            } finally {
                setLoadingDistance(false)
            }
        }, 600) // leggero debounce per digitazione

        return () => clearTimeout(handler)
    }, [addr, settings])

    // 🔧 Preview del delivery fee (calcolata lato server)
    useEffect(() => {
        if (!settings.delivery_enabled) return
        
        // Calcola capInvalid come prima cosa nell'effetto
        const capTrimmed = addr.cap ? String(addr.cap).trim() : ''
        const capInvalid = capTrimmed && (!/^\d{5}$/.test(capTrimmed) || capTrimmed === '00000')
        
        // Se capInvalid è true -> gestisci errore CAP e return immediato
        if (capInvalid) {
            setDistanceError(CAP_ERR)
            updateErrorMessage(CAP_ERR)
            setPreviewDistanceKm(null)
            setPreviewDeliveryFee(null)
            setIsAddressValid(false)
            setLoadingPreview(false)
            return // Non eseguire altri reset, non fare fetch
        }
        
        if (!addr.line1 || !addr.city || !addr.cap) {
            setPreviewDeliveryFee(null)
            setPreviewDistanceKm(null)
            return
        }

        const handler = setTimeout(async () => {
            setLoadingPreview(true)
            
            // Se capInvalid è false -> pulisci SOLO l'errore CAP se era impostato
            setDistanceError((prev) => (prev === CAP_ERR ? null : prev))
            setErrorMessage((prev) => (prev === CAP_ERR ? null : prev))
            
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
                    // Se errore 400, mostra messaggio specifico
                    if (res.status === 400) {
                        try {
                            const errorData = JSON.parse(text)
                            const errorText = errorData.error || ''
                            
                            const errorTextLower = errorText.toLowerCase()
                            
                            // Se contiene "fuori dal raggio" mostra solo quello
                            if (errorText.includes("fuori dal raggio") || errorText.includes("non è disponibile")) {
                                setDistanceError(errorText)
                                setIsAddressValid(false)
                                updateErrorMessage(errorText)
                            } else if (errorTextLower.includes("cap") || errorTextLower.includes("postal") || errorTextLower.includes("codice postale")) {
                                // Se contiene errori CAP/postal, mostra serverErr direttamente
                                setDistanceError(errorText)
                                setIsAddressValid(false)
                                updateErrorMessage(errorText)
                            } else {
                                // Altrimenti mostra solo "inserisci via completa..."
                                const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                                setDistanceError(geocodeError)
                                setIsAddressValid(false)
                                // Evita che "fuori raggio" venga sovrascritto
                                updateErrorMessage(geocodeError)
                            }
                        } catch {
                            const geocodeError = "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma"
                            setDistanceError(geocodeError)
                            setIsAddressValid(false)
                            updateErrorMessage(geocodeError)
                        }
                    }
                    // Resetta la preview
                    setPreviewDeliveryFee(null)
                    setPreviewDistanceKm(null)
                    return
                }

                const data = await res.json()
                
                // Se data.ok === false, gestisci errore e return
                if (data.ok === false) {
                    setDistanceError(data.error)
                    updateErrorMessage(data.error)
                    setPreviewDistanceKm(null)
                    setPreviewDeliveryFee(null)
                    setIsAddressValid(false)
                    setLoadingPreview(false)
                    return
                }
                
                setPreviewDeliveryFee(data.delivery_fee ?? null)
                setPreviewDistanceKm(data.distance_km ?? null)
                // Se il delivery preview ha successo, resetta errorMessage (ma mantieni errori "fuori raggio" se presenti)
                updateErrorMessage(null)
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
        // Se distanceError esiste -> validation.ok=false con reason=distanceError
        if (distanceError) {
            return { ok: false, reason: distanceError }
        }
        // Se la preview è ancora in calcolo, attendi prima di validare
        if (loadingPreview) {
            return { ok: false, reason: 'Calcolo distanza in corso...' }
        }
        // Se previewDistanceKm è null -> validation.ok=false
        if (previewDistanceKm === null) {
            return { ok: false, reason: "Inserisci l'indirizzo completo (via, numero civico, CAP e città). Esempio: Via Roma 10, 00100 Roma" }
        }
        // Valida la distanza usando previewDistanceKm (non distanceKm client-side)
        return validateDelivery(previewDistanceKm, settings)
    }, [loadingPreview, distanceError, previewDistanceKm, settings, addr])

    const methods = allowedPaymentMethods(settings)
    const [pay, setPay] = useState<PaymentMethod>('cash')
    const emptyCart = hydrated && items.length === 0

    const [saving, setSaving] = useState(false)

    const confirmOrder = useCallback(async () => {
        setMsg(null)
        setSaving(true) // 🔹 feedback immediato

        // Se esiste errorMessage, blocca subito il submit e mostra l'errore
        if (errorMessage) {
            setMsg({ type: 'error', text: errorMessage })
            setSaving(false)
            return
        }

        if (items.length === 0) {
            setMsg({ type: 'error', text: 'Carrello vuoto' })
            setSaving(false)
            return
        }
        if (!validation.ok) {
            // Usa errorMessage se disponibile, altrimenti validation.reason
            const errorText = errorMessage || validation.reason || 'Indirizzo non valido'
            setMsg({ type: 'error', text: errorText })
            setSaving(false)
            return
        }
        if (!addr.firstName || !addr.lastName || !addr.line1 || !addr.city || !addr.cap) {
            setMsg({ type: 'error', text: 'Compila tutti i campi obbligatori' })
            setSaving(false)
            return
        }

        // Usa previewDistanceKm dal server invece di distanceKm client-side
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
            distance_km: previewDistanceKm ?? 0,
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

            // Se la response contiene checkoutUrl (per card_online), redirect a Stripe
            if (data?.checkoutUrl) {
                clearCart()
                window.location.href = data.checkoutUrl
                return
            }

            // Per altri metodi di pagamento, redirect a success
            setMsg({ type: 'success', text: 'Ordine creato con successo!' })
            clearCart()
            router.push(`/order/success?id=${encodeURIComponent(orderId)}`)
        } catch (e: any) {
            console.error(e)
            setMsg({ type: 'error', text: e?.message ?? 'Errore imprevisto' })
            setSaving(false)
        }
    }, [items, addr, subtotal, pay, settings, validation, clearCart, router, backendTotal, errorMessage, previewDistanceKm])

    if (!mounted) return <Skeleton />
    if (!hydrated && items.length === 0) return <Skeleton />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-md bg-white dark:bg-zinc-900">
                {msg && (
                    <div
                        className={`rounded-md p-3 text-sm flex items-center justify-center ${msg.type === 'error'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800'
                            }`}
                    >
                        {msg.type === 'error' ? '⚠️' : '✅'} {msg.text}
                    </div>
                )}

                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📍 Dati cliente</h2>
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Nome</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm"
                            value={addr.firstName}
                            onChange={(e) => setAddr({ ...addr, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Cognome</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm"
                            value={addr.lastName}
                            onChange={(e) => setAddr({ ...addr, lastName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Via e numero civico</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm"
                            value={addr.line1}
                            onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Città</label>
                        <input
                            type="text"
                            required
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2"
                            value={addr.city}
                            onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">CAP</label>
                        <input
                            type="text"
                            pattern="[0-9]{5}"
                            title="Inserisci un CAP valido a 5 cifre"
                            required
                            maxLength={5}
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2"
                            value={addr.cap}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "")
                                setAddr({ ...addr, cap: val })
                            }}
                        />
                        {errorMessage && errorMessage.includes("CAP non valido") && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Note per il corriere</label>
                        <textarea
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 text-sm"
                            value={addr.note ?? ''}
                            onChange={(e) => setAddr({ ...addr, note: e.target.value })}
                        />
                    </div>
                </div>

                {/* Mostra errore CAP/indirizzo sempre visibile, anche se delivery è disabilitata */}
                {errorMessage && !settings.delivery_enabled && (
                    <div className="mt-4">
                        <p className="text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                            {errorMessage}
                        </p>
                    </div>
                )}

                {settings.delivery_enabled && (
                    <div className="mt-4">
                        <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-gray-100">📏 Distanza</h2>
                        <div className="w-full rounded-lg border border-gray-300 dark:border-zinc-800 px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
                            {loadingDistance
                                ? "Calcolo in corso..."
                                : distanceKm > 0
                                    ? `${distanceKm} km`
                                    : "Inserisci indirizzo per calcolare"}
                        </div>
                        {errorMessage && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                )}

                {methods.length > 0 && (
                    <div className="mt-4">
                        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">💳 Metodo di pagamento</h2>
                        <div className="space-y-2">
                            {methods.map((m) => (
                                <label
                                    key={m}
                                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${pay === m ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-zinc-800'
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
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {PAYMENT_METHOD_CONFIG[m]?.label || m}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <aside className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-md bg-white dark:bg-zinc-900 h-fit">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🛒 Riepilogo ordine</h2>

                <ul className="divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                    {items.map((it: any) => (
                        <li key={it.id} className="flex justify-between py-2 text-gray-900 dark:text-gray-100">
                            <span>{it.name} × {it.qty}</span>
                            <span>€{(Number(it.price) * it.qty).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>

                <div className="border-t border-gray-200 dark:border-zinc-800 pt-4 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-900 dark:text-gray-100">
                        <span>Subtotale</span>
                        <span>€{subtotal.toFixed(2)}</span>
                    </div>
                    {settings.delivery_enabled && (
                        <div className="flex justify-between text-gray-900 dark:text-gray-100">
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
                    <div className="flex justify-between font-semibold text-lg text-gray-900 dark:text-gray-100">
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

                {errorMessage && (
                    <div className="p-3 mb-3 text-sm text-white bg-red-500 dark:bg-red-600 rounded-lg">
                        {errorMessage}
                    </div>
                )}

                <button
                    type="button"
                    onClick={confirmOrder}
                    disabled={saving || !validation.ok}

                    className={`w-full rounded-xl font-semibold px-4 py-3 transition 
    ${validation.ok && addr.firstName && addr.lastName
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'}`}
                >
                    {saving ? '⏳ Elaborazione…' : 'Conferma ordine'}
                </button>

            </aside>
        </div>
    )
}
