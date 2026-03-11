'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import Skeleton from '@/components/Skeleton'
import type { StoreSettings, PaymentMethod, OrderItem, OrderAddress, OrderPayload } from '@/lib/types'
import { validateDelivery, allowedPaymentMethods, normalizeDeliveryMaxKm } from '@/lib/delivery'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/lib/pricing'
import { formatQty } from '@/lib/qty'

type Props = { settings: StoreSettings }

const round2 = (n: number) => Math.round(n * 100) / 100
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

const isCapComplete = (cap: string) => String(cap ?? '').trim().length === 5
const isCapInvalidFull = (cap: string) => {
    const c = String(cap ?? '').trim()
    if (c.length !== 5) return false
    return !/^\d{5}$/.test(c) || c === '00000'
}
const isCapPartial = (cap: string) => {
    const c = String(cap ?? '').trim()
    return c.length > 0 && c.length < 5
}

const normalizeSpaces = (s: string) => s.replace(/\s+/g, ' ').trim()

// Requires: at least 1 word + number (e.g. "Via Roma 10", "machiavelli 21")
const looksLikeFullStreetAddress = (line1: string) => {
    const s = normalizeSpaces(String(line1 ?? ''))
    if (s.length < 6) return false
    // at least 1 digit (number)
    if (!/\d/.test(s)) return false
    // at least 4 consecutive letters (avoid "via 1")
    if (!/[a-zA-ZÀ-ÿ]{4,}/.test(s)) return false
    return true
}

const getPhoneDigits = (value: string) => (value ?? '').replace(/\D/g, '')
const getNationalDigits = (value: string) => {
    let d = getPhoneDigits(value)
    if (d.startsWith('0039')) d = d.slice(4)
    else if (d.startsWith('39')) d = d.slice(2)
    return d
}
const isPhoneValidNumber = (value: string) => {
    const digits = getNationalDigits(value)
    if (digits.length < 9) return false
    if (/^(\d)\1+$/.test(digits)) return false
    return true
}

export type FulfillmentPreview = {
    can_accept: boolean
    is_open_now: boolean
    after_cutoff: boolean
    next_fulfillment_date: string | null
    message: string
    message_code?: string | null
}

export default function CheckoutForm({ settings }: Props) {
    const router = useRouter()
    const t = useTranslations('checkoutForm')
    const locale = useLocale()
    const formatFulfillmentDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return ''
        const date = new Date(`${dateStr}T00:00:00`)
        return new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(date)
    }
    const getFulfillmentMessage = (f: FulfillmentPreview | null) => {
        if (!f) return ''

        const formattedDate = formatFulfillmentDate(f.next_fulfillment_date)
        const extractTimeFromMessage = (message: string | null | undefined) => {
            if (!message) return ''
            const match = message.match(/\b(\d{2}:\d{2})\b/)
            return match?.[1] ?? ''
        }
        const extractedTime = extractTimeFromMessage(f.message)

        switch (f.message_code) {
            case 'delivery_today':
                return t('deliveryToday')

            case 'store_opens_later_today':
                return extractedTime
                    ? t('storeOpensLaterTodayAt', { time: extractedTime })
                    : t('storeOpensLaterToday')

            case 'store_reopens_later_today':
                return extractedTime
                    ? t('storeReopensLaterTodayAt', { time: extractedTime })
                    : t('storeReopensLaterToday')

            case 'closed_with_reason_next_date':
                return f.message || t('storeClosedReasonNextDate', { date: formattedDate })

            case 'after_cutoff_next_date':
                return t('afterCutoffNextDate', { date: formattedDate })

            case 'store_closed_next_date':
                return t('storeClosedNextDate', { date: formattedDate })

            case 'store_closed_not_accepting_orders':
                return t('storeClosedNotAcceptingOrders')

            case 'delivery_on_date':
                return t('deliveryOnDate', { date: formattedDate })

            default:
                return f.message || ''
        }
    }
    const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { icon: string; label: string }> = {
        cash: { icon: '💵', label: t('paymentCash') },
        pos_on_delivery: { icon: '💳🏠', label: t('paymentPosOnDelivery') },
        card_online: { icon: '💳', label: t('paymentCardOnline') },
    }
    const CAP_ERR = t('capInvalidFull')
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
    const reconcileWithProducts = useCartStore((s) => s.reconcileWithProducts)

    const subtotal = useMemo(
        () =>
            round2(
                items.reduce((sum: number, it: any) => sum + Number(it.price || 0) * Number(it.qty || 0), 0)
            ),
        [items]
    )

    // 🔹 aggiunti firstName e lastName
    const [addr, setAddr] = useState<OrderAddress>({ firstName: '', lastName: '', line1: '', city: '', cap: '', note: '', phone: '' })
    const [distanceKm, setDistanceKm] = useState<number>(0)
    const [loadingDistance, setLoadingDistance] = useState(false)
    const [isAddressValid, setIsAddressValid] = useState(false)
    const [distanceError, setDistanceError] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Helper to determine the error message with priority
    const updateErrorMessage = (newError: string | null) => {
        if (!newError) {
            setErrorMessage(null)
            return
        }
        const errorLower = newError.toLowerCase()
        // Priority: if contains "invalid CAP" or CAP keywords -> show only that
        if (newError.includes("CAP non valido") ||
            errorLower.includes("cap") ||
            errorLower.includes("postal") ||
            errorLower.includes("codice postale") ||
            errorLower.includes("corrisponde")) {
            setErrorMessage(newError)
            return
        }
        // Priority: if contains "out of radius" or "not available" -> show only that
        if (newError.includes("fuori dal raggio") || newError.includes("non è disponibile")) {
            setErrorMessage(newError)
        } else {
            // Otherwise show only "address not recognized, insert complete street..."
            const geocodeError = t('fullAddressExample')
            // Update only if there is no "out of radius" error
            setErrorMessage((prev) => {
                if (prev && (prev.includes("fuori dal raggio") || prev.includes("non è disponibile"))) {
                    return prev
                }
                return geocodeError
            })
        }
    }

    const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    // Values calculated from backend (available only after order creation)
    const [backendDeliveryFee, setBackendDeliveryFee] = useState<number | null>(null)
    const [backendTotal, setBackendTotal] = useState<number | null>(null)
    const [backendDistanceKm, setBackendDistanceKm] = useState<number | null>(null)

    // Preview of delivery (calculated before order creation)
    const [previewDeliveryFee, setPreviewDeliveryFee] = useState<number | null>(null)
    const [previewDistanceKm, setPreviewDistanceKm] = useState<number | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)

    // Fulfillment: hours, cutoff, closures (single source of truth from RPC)
    const [fulfillment, setFulfillment] = useState<FulfillmentPreview | null>(null)
    const [loadingFulfillment, setLoadingFulfillment] = useState(true)

    // ============================================================
    // GATE UNIQUE: when checkout is disabled, do not make geocode
    // (neither client distance, nor server preview that geocodes)
    // ============================================================
    const canComputeGeo = useMemo(() => {
        if (!settings.delivery_enabled) return false
        if (loadingFulfillment) return false
        if (fulfillment?.can_accept === false) return false
        return true
    }, [settings.delivery_enabled, loadingFulfillment, fulfillment?.can_accept])

    // Reset backend values when address changes
    useEffect(() => {
        setBackendDeliveryFee(null)
        setBackendTotal(null)
        setBackendDistanceKm(null)
        setPreviewDeliveryFee(null)
        setPreviewDistanceKm(null)

        const capPartial = isCapPartial(addr.cap)
        const capInvalidFull = isCapInvalidFull(addr.cap)
        const capTrimmed = String(addr.cap ?? '').trim()

        if (capPartial) {
            setDistanceError((prev) => (prev === CAP_ERR ? null : prev))
            setErrorMessage((prev) => (prev === CAP_ERR ? null : prev))
            return
        }
        if (capTrimmed === '') {
            setDistanceError((prev) => (prev === CAP_ERR ? null : prev))
            setErrorMessage((prev) => (prev === CAP_ERR ? null : prev))
            return
        }
        if (isCapComplete(addr.cap) && !capInvalidFull) {
            setDistanceError((prev) => (prev === CAP_ERR ? null : prev))
            setErrorMessage((prev) => (prev === CAP_ERR ? null : prev))
        }
    }, [addr.line1, addr.city, addr.cap])

    // 🔧 Automatic distance calculation with Google Maps
    useEffect(() => {
        // HARD STOP: checkout disabled => no geocode call
        if (!canComputeGeo) {
            setLoadingDistance(false)
            setDistanceKm(0)
            setIsAddressValid(false)
            return
        }

        if (!addr.line1 || !addr.city || !addr.cap) return

        if (isCapPartial(addr.cap)) {
            setIsAddressValid(false)
            return
        }
        if (isCapInvalidFull(addr.cap)) {
            setIsAddressValid(false)
            setDistanceError(CAP_ERR)
            updateErrorMessage(CAP_ERR)
            setDistanceKm(0)
            return
        }

        // ✅ Do not geocode if a "complete" address with number is missing
        if (!looksLikeFullStreetAddress(addr.line1)) {
            setIsAddressValid(false)
            setDistanceKm(0)
            // neutral while typing: no red error
            setDistanceError(null)
            // optional: do not force errorMessage while typing
            // updateErrorMessage(null)
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

                    // If recent cache (less than 7 days), use it
                    const validCache = Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000
                    if (validCache) {
                        setDistanceKm(km)
                        const validation = validateDelivery(km, settings)
                        const maxKmSafe = normalizeDeliveryMaxKm(settings.delivery_max_km)
                        if (maxKmSafe !== null && km > maxKmSafe) {
                            setIsAddressValid(false)

                            const radiusError = t('deliveryOutOfRange', {
                                distance: km.toFixed(1),
                                max: maxKmSafe
                            })

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

                // ✅ STEP 2.2 — Geocode call with CAP and city validation
                try {
                    const geocodeUrl = `/api/geocode?q=${encodeURIComponent(full)}&zip=${encodeURIComponent(addr.cap)}&city=${encodeURIComponent(addr.city)}`
                    const geocodeRes = await fetch(geocodeUrl)

                    let geocodeData: any = null
                    try {
                        const text = await geocodeRes.text()
                        geocodeData = JSON.parse(text)
                    } catch {
                        setIsAddressValid(false)
                        const geocodeError = t('fullAddressExample')
                        setDistanceError(geocodeError)
                        updateErrorMessage(geocodeError)
                        setDistanceKm(0)
                        setLoadingDistance(false)
                        return
                    }

                    if (!geocodeData.ok) {
                        setIsAddressValid(false)
                        const geocodeError = t('fullAddressExample')
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
                    const maxKmSafe = normalizeDeliveryMaxKm(settings.delivery_max_km)
                    if (maxKmSafe !== null && km > maxKmSafe) {
                        setIsAddressValid(false)

                        const radiusError = t('deliveryOutOfRange', {
                            distance: km.toFixed(1),
                            max: maxKmSafe
                        })

                        setDistanceError(radiusError)
                        updateErrorMessage(radiusError)
                    } else {
                        setIsAddressValid(validation.ok)
                        setDistanceError(null)
                        updateErrorMessage(null)
                    }

                    // ✅ STEP 2.3 — Cache saving
                    localStorage.setItem(full, JSON.stringify({
                        coords,
                        km,
                        timestamp: Date.now()
                    }))
                } catch (err) {
                    setIsAddressValid(false)
                    const geocodeError = t('fullAddressExample')
                    setDistanceError(geocodeError)
                    updateErrorMessage(geocodeError)
                    setDistanceKm(0)
                }
            } catch (err) {
                console.error('Errore geocodifica:', err)
                setIsAddressValid(false)
                const geocodeError = t('fullAddressExample')
                setDistanceError(geocodeError)
                updateErrorMessage(geocodeError)
                setDistanceKm(0)
            } finally {
                setLoadingDistance(false)
            }
        }, 600) // light debounce for typing

        return () => clearTimeout(handler)
    }, [addr, settings, canComputeGeo])

    // 🔧 Preview of delivery fee (calculated on server)
    useEffect(() => {
        // HARD STOP: checkout disabled => no preview (which could call geocode on server)
        if (!canComputeGeo) {
            setPreviewDistanceKm(null)
            setPreviewDeliveryFee(null)
            setLoadingPreview(false)
            return
        }

        const capPartial = isCapPartial(addr.cap)
        const capInvalidFull = isCapInvalidFull(addr.cap)

        if (capPartial) {
            setPreviewDistanceKm(null)
            setPreviewDeliveryFee(null)
            setLoadingPreview(false)
            setDistanceError((prev) => (prev === CAP_ERR ? null : prev))
            setErrorMessage((prev) => (prev === CAP_ERR ? null : prev))
            return
        }

        if (capInvalidFull) {
            setDistanceError(CAP_ERR)
            updateErrorMessage(CAP_ERR)
            setPreviewDistanceKm(null)
            setPreviewDeliveryFee(null)
            setIsAddressValid(false)
            setLoadingPreview(false)
            return
        }

        if (!addr.line1 || !addr.city || !addr.cap) {
            setPreviewDeliveryFee(null)
            setPreviewDistanceKm(null)
            return
        }

        // ✅ Do not make server preview until there is a number
        if (!looksLikeFullStreetAddress(addr.line1)) {
            setPreviewDeliveryFee(null)
            setPreviewDistanceKm(null)
            setIsAddressValid(false)
            setLoadingPreview(false)
            return
        }

        const handler = setTimeout(async () => {
            setLoadingPreview(true)

            // If capInvalid is false -> clear ONLY the CAP error if it was set
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
                    // If error 400, show specific message
                    if (res.status === 400) {
                        try {
                            const errorData = JSON.parse(text)
                            const errorText = errorData.error || ''

                            const errorTextLower = errorText.toLowerCase()

                            // If contains "out of radius" shows only that
                            if (errorText.includes("fuori dal raggio") || errorText.includes("non è disponibile")) {
                                setDistanceError(errorText)
                                setIsAddressValid(false)
                                updateErrorMessage(errorText)
                            } else if (errorTextLower.includes("cap") || errorTextLower.includes("postal") || errorTextLower.includes("codice postale")) {
                                // If contains CAP/postal errors, show serverErr directly
                                setDistanceError(errorText)
                                setIsAddressValid(false)
                                updateErrorMessage(errorText)
                            } else {
                                // Otherwise show only "insert complete street..."
                                const geocodeError = t('fullAddressExample')
                                setDistanceError(geocodeError)
                                setIsAddressValid(false)
                                // Avoid overwriting "out of radius"
                                updateErrorMessage(geocodeError)
                            }
                        } catch {
                            const geocodeError = t('fullAddressExample')
                            setDistanceError(geocodeError)
                            setIsAddressValid(false)
                            updateErrorMessage(geocodeError)
                        }
                    }
                    // Reset the preview
                    setPreviewDeliveryFee(null)
                    setPreviewDistanceKm(null)
                    return
                }

                const data = await res.json()

                // If data.ok === false, handle error and return
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
                // If the delivery preview succeeds, reset errorMessage (but keep "out of radius" errors if present)
                updateErrorMessage(null)
            } catch (err) {
                console.error('Errore preview consegna:', err)
                setPreviewDeliveryFee(null)
                setPreviewDistanceKm(null)
            } finally {
                setLoadingPreview(false)
            }
        }, 600) // debounce to avoid too many calls

        return () => clearTimeout(handler)
    }, [addr.line1, addr.city, addr.cap, settings.delivery_enabled, canComputeGeo])

    useEffect(() => {
        if (!settings.delivery_enabled) {
            setLoadingFulfillment(false)
            setFulfillment(null)
            return
        }
        let cancelled = false
        setLoadingFulfillment(true)
        fetch('/api/fulfillment/preview', { cache: 'no-store' })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return
                if (data?.ok === true) {
                    setFulfillment({
                        can_accept: !!data.can_accept,
                        is_open_now: !!data.is_open_now,
                        after_cutoff: !!data.after_cutoff,
                        next_fulfillment_date: data.next_fulfillment_date ?? null,
                        message: data.message ?? '',
                        message_code: data.message_code ?? null,
                    })
                } else {
                    setFulfillment(null)
                }
            })
            .catch(() => {
                if (!cancelled) setFulfillment(null)
            })
            .finally(() => {
                if (!cancelled) setLoadingFulfillment(false)
            })
        return () => { cancelled = true }
    }, [settings.delivery_enabled])

    const validation = useMemo(() => {
        // If delivery is disabled, the address is always valid (no need to validate distance)
        if (!settings.delivery_enabled) {
            return { ok: true }
        }
        if (isCapPartial(addr.cap)) {
            return { ok: false, reason: t('capRequired') }
        }
        // If delivery is enabled but the address is not complete, it is not yet valid
        if (!addr.line1 || !addr.city || !addr.cap) {
            return { ok: false, reason: t('fillAddressFields') }
        }
        // If distanceError exists -> validation.ok=false with reason=distanceError
        if (distanceError) {
            return { ok: false, reason: distanceError }
        }
        // If the preview is still calculating, wait before validating
        if (loadingPreview) {
            return { ok: false, reason: t('distanceCalculating') }
        }
        // If previewDistanceKm is null -> validation.ok=false
        if (previewDistanceKm === null) {
            return { ok: false, reason: t('fullAddressExample') }
        }
        // Validate distance using previewDistanceKm (not distanceKm client-side)
        return validateDelivery(previewDistanceKm, settings)
    }, [loadingPreview, distanceError, previewDistanceKm, settings, addr])

    const methods = allowedPaymentMethods(settings)
    const [pay, setPay] = useState<PaymentMethod>('cash')
    const emptyCart = hydrated && items.length === 0

    const [saving, setSaving] = useState(false)
    const [attemptedSubmit, setAttemptedSubmit] = useState(false)
    const [firstNameTouched, setFirstNameTouched] = useState(false)
    const [lastNameTouched, setLastNameTouched] = useState(false)
    const [phoneTouched, setPhoneTouched] = useState(false)
    const [line1Touched, setLine1Touched] = useState(false)
    const [cityTouched, setCityTouched] = useState(false)
    const [capTouched, setCapTouched] = useState(false)

    const firstNameInvalid = !(addr.firstName ?? '').trim()
    const lastNameInvalid = !(addr.lastName ?? '').trim()
    const showFirstNameError = (attemptedSubmit || firstNameTouched) && firstNameInvalid
    const showLastNameError = (attemptedSubmit || lastNameTouched) && lastNameInvalid

    const phoneDigits = getPhoneDigits(addr.phone ?? '')
    const isPhoneValid = isPhoneValidNumber(addr.phone ?? '')
    const showPhoneError = (attemptedSubmit || phoneTouched) && !isPhoneValid

    const line1Invalid = !(addr.line1 ?? '').trim()
    const line1HasText = !!(addr.line1 ?? '').trim()
    const line1MissingCivic = line1HasText && !looksLikeFullStreetAddress(addr.line1)
    const showLine1CivicError = (attemptedSubmit || line1Touched) && line1MissingCivic
    const cityInvalid = !(addr.city ?? '').trim()
    const capInvalid = !(addr.cap ?? '').trim() || (addr.cap ?? '').trim().length < 5
    const showLine1Error = (attemptedSubmit || line1Touched) && line1Invalid
    const showCityError = (attemptedSubmit || cityTouched) && cityInvalid
    const showCapError = (attemptedSubmit || capTouched) && capInvalid

    const confirmOrder = useCallback(async () => {
        setAttemptedSubmit(true)
        setMsg(null)
        setSaving(true) // 🔹 immediate feedback

        // ============================================================
        // GUARD: delivery disabled → block immediately (absolute priority)
        // ============================================================
        if (!settings.delivery_enabled) {
            setMsg({
                type: 'error',
                text: t('deliveryDisabled'),
            })
            setSaving(false)
            return
        }
        if (fulfillment?.can_accept === false) {
            setMsg({ type: 'error', text: fulfillment.message || t('storeClosed') })
            setSaving(false)
            return
        }
        if (errorMessage) {
            setMsg({ type: 'error', text: errorMessage })
            setSaving(false)
            return
        }
        if (items.length === 0) {
            setMsg({ type: 'error', text: t('cartEmpty') })
            setSaving(false)
            return
        }
        if (!validation.ok) {
            // Use errorMessage if available, otherwise validation.reason
            const errorText = errorMessage || validation.reason || t('invalidAddress')
            setMsg({ type: 'error', text: errorText })
            setSaving(false)
            return
        }
        if (!addr.firstName || !addr.lastName || !isPhoneValid || !addr.line1 || !addr.city || !addr.cap) {
            setMsg({ type: 'error', text: t('requiredFields') })
            setSaving(false)
            return
        }
        if (!isPhoneValid) {
            setMsg({ type: 'error', text: t('phoneInvalid') })
            setSaving(false)
            return
        }

        // Use previewDistanceKm from server instead of distanceKm client-side
        console.log('🧪 PAYMENT METHOD AL SUBMIT:', pay)
        console.log('🧪 AVAILABLE METHODS:', methods)

        const payload: OrderPayload & { customer_phone?: string } = {
            items: items.map((it) => ({
                id: it.id,
                name: it.name,
                price: Number(it.price),
                qty: it.unit === 'per_kg' ? round3(Number(it.qty) || 0) : Math.round(Number(it.qty) || 0),
                unit: it.unit,
            })) as OrderItem[],
            subtotal,
            delivery_fee: 0, // Ignored by backend, calculated on server
            total: 0, // Ignored by backend, calculated on server
            distance_km: previewDistanceKm ?? 0,
            payment_method: pay,
            address: addr,
            customer_phone: (addr.phone ?? '').trim() || undefined,
        }

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store',
            })

            if (!res.ok) {
                let apiMsg = `${t('apiError')} (${res.status})`
                try {
                    const data = await res.json()
                    apiMsg = data?.message || data?.error || apiMsg
                } catch {
                    // ignore JSON parse errors
                }
                setMsg({ type: 'error', text: apiMsg })
                setSaving(false)
                return
            }

            const data = await res.json()
            // 🔍 Temporary log of the response JSON
            console.log('📦 Response from /api/orders:', JSON.stringify(data, null, 2))

            // Save the values calculated from backend
            if (data?.delivery_fee !== undefined) setBackendDeliveryFee(data.delivery_fee)
            if (data?.total !== undefined) setBackendTotal(data.total)
            if (data?.distance_km !== undefined) setBackendDistanceKm(data.distance_km)

            // ✅ Aligned with the real structure of the response: use order_id instead of id
            const orderId = data?.order_id ?? data?.id ?? ''

            // If the response contains checkoutUrl (for card_online), redirect to Stripe
            if (data?.checkoutUrl) {
                clearCart()
                window.location.href = data.checkoutUrl
                return
            }

            // For other payment methods, redirect to success
            setMsg({ type: 'success', text: t('orderCreated') })
            clearCart()
            router.push(`/order/success?id=${encodeURIComponent(orderId)}`)
        } catch (e: any) {
            console.error(e)
            setMsg({ type: 'error', text: e?.message ?? t('unexpectedError') })
            setSaving(false)
        }
    }, [items, addr, subtotal, pay, settings, validation, fulfillment, clearCart, reconcileWithProducts, router, backendTotal, errorMessage, previewDistanceKm, isPhoneValid])

    if (!mounted) return <Skeleton />
    if (!hydrated && items.length === 0) return <Skeleton />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-md bg-white dark:bg-zinc-900">
                {msg && (
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                        <div
                            className={`rounded-md p-3 text-sm flex items-center justify-center flex-1 min-w-0 ${msg.type === 'error'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800'
                                }`}
                        >
                            {msg.type === 'error' ? '⚠️' : '✅'} {msg.text}
                        </div>
                        {msg.type === 'error' && msg.text.includes('aggiornato il carrello') && (
                            <Link
                                href="/cart"
                                className="shrink-0 rounded-md border border-red-300 dark:border-red-800 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors text-center"
                            >
                                {t('goToCart')}
                            </Link>
                        )}
                    </div>
                )}

                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{t('customerDataTitle')}</h2>
                <div className="grid gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('firstName')}</label>
                        <input
                            type="text"
                            required
                            onBlur={() => setFirstNameTouched(true)}
                            className={`mt-1 w-full rounded-lg border bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm ${showFirstNameError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-zinc-800'}`}
                            value={addr.firstName}
                            onChange={(e) => setAddr({ ...addr, firstName: e.target.value })}
                        />
                        {showFirstNameError && (
                            <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('firstNameRequired')}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('lastName')}</label>
                        <input
                            type="text"
                            required
                            onBlur={() => setLastNameTouched(true)}
                            className={`mt-1 w-full rounded-lg border bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm ${showLastNameError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-zinc-800'}`}
                            value={addr.lastName}
                            onChange={(e) => setAddr({ ...addr, lastName: e.target.value })}
                        />
                        {showLastNameError && (
                            <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('lastNameRequired')}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('phone')}</label>
                        <input
                            type="tel"
                            placeholder="+39 333 1234567"
                            value={addr.phone ?? ''}
                            onChange={(e) => setAddr((p) => ({ ...p, phone: e.target.value }))}
                            onBlur={() => setPhoneTouched(true)}
                            className={`mt-1 w-full rounded-lg border bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm ${showPhoneError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-zinc-800'}`}
                            required
                        />
                        {showPhoneError && (
                            <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('phoneInvalid')}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('addressLine')}</label>
                        <input
                            type="text"
                            required
                            onBlur={() => setLine1Touched(true)}
                            className={`mt-1 w-full rounded-lg border bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm ${showLine1CivicError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-zinc-800'}`}
                            value={addr.line1}
                            onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                        />
                        {showLine1Error && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('addressRequired')}
                            </p>
                        )}
                        {showLine1CivicError && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('addressExample')}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('city')}</label>
                        <input
                            type="text"
                            required
                            onBlur={() => setCityTouched(true)}
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2"
                            value={addr.city}
                            onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                        />
                        {showCityError && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('cityRequired')}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('cap')}</label>
                        <input
                            type="text"
                            pattern="[0-9]{5}"
                            title={t('capTitle')}
                            required
                            maxLength={5}
                            onBlur={() => setCapTouched(true)}
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2"
                            value={addr.cap}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "")
                                setAddr({ ...addr, cap: val })
                            }}
                        />
                        {showCapError && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {t('capRequired')}
                            </p>
                        )}
                        {isCapInvalidFull(addr.cap) && errorMessage && errorMessage.includes("CAP non valido") && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                {errorMessage}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{t('courierNotes')}</label>
                        <textarea
                            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 px-3 py-2 text-sm"
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
                        <h2 className="text-lg font-semibold mb-1 text-gray-900 dark:text-zinc-100">{t('distanceTitle')}</h2>
                        <div className="w-full rounded-lg border border-gray-300 dark:border-zinc-800 px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100">
                            {!canComputeGeo
                                ? t('distanceAvailableWhenEnabled')
                                : loadingDistance
                                    ? t('distanceCalculating')
                                    : distanceKm > 0
                                        ? `${distanceKm} km`
                                        : t('distanceEnterAddress')}
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
                        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-zinc-100">{t('paymentMethodTitle')}</h2>
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
                                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                                        {PAYMENT_METHOD_CONFIG[m]?.label || m}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <aside className="space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-md bg-white dark:bg-zinc-900 h-fit">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{t('orderSummaryTitle')}</h2>

                <ul className="divide-y divide-gray-200 dark:divide-zinc-800 text-sm">
                    {items.map((it: any) => (
                        <li key={it.id} className="flex justify-between py-2 text-gray-900 dark:text-zinc-100">
                            <span>{it.name} × {formatQty(Number(it.qty), it.unit ?? 'per_unit', it.qty_step)}</span>
                            <span>{formatPrice(Number(it.price) * it.qty)}</span>
                        </li>
                    ))}
                </ul>

                <div className="border-t border-gray-200 dark:border-zinc-800 pt-4 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-900 dark:text-zinc-100">
                        <span>{t('subtotal')}</span>
                        <span>{formatPrice(subtotal)}</span>
                    </div>
                    {settings.delivery_enabled && (
                        <div className="flex justify-between text-gray-900 dark:text-zinc-100">
                            <span>{t('delivery')}</span>
                            <span>
                                {backendDeliveryFee !== null
                                    ? backendDeliveryFee === 0
                                        ? t('freeDelivery')
                                        : `${formatPrice(backendDeliveryFee)} (${(backendDistanceKm ?? 0).toFixed(1)} km)`
                                    : previewDeliveryFee !== null
                                        ? previewDeliveryFee === 0
                                            ? t('freeDeliveryEstimate')
                                            : `${formatPrice(previewDeliveryFee)} (stima)`
                                        : loadingPreview || loadingDistance
                                            ? '...'
                                            : '—'}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg text-gray-900 dark:text-zinc-100">
                        <span>{t('total')}</span>
                        <span>
                            {backendTotal !== null
                                ? formatPrice(backendTotal)
                                : previewDeliveryFee !== null
                                    ? `${formatPrice(subtotal + previewDeliveryFee)} (stima)`
                                    : formatPrice(subtotal)}
                        </span>
                    </div>
                </div>

                {/* ============================================================ */}
                {/* GUARD UI: delivery disabled */}
                {/* ============================================================ */}
                {!settings.delivery_enabled && (
                    <div className="p-3 mb-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800">
                        ⚠️ {t('deliveryDisabled')}
                    </div>
                )}
                {settings.delivery_enabled && loadingFulfillment && (
                    <div className="p-3 mb-3 text-sm text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900/60 rounded-lg border border-gray-200 dark:border-zinc-800">
                        ⏳ {t('checkingAvailability')}
                    </div>
                )}
                {settings.delivery_enabled && !loadingFulfillment && fulfillment && fulfillment.can_accept === false && (
                    <div className="p-3 mb-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800">
                        ⚠️ {getFulfillmentMessage(fulfillment) || t('storeClosed')}
                    </div>
                )}
                {settings.delivery_enabled && !loadingFulfillment && fulfillment?.can_accept !== false && getFulfillmentMessage(fulfillment) && (
                    <div className="p-3 mb-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
                        ⚠️ {getFulfillmentMessage(fulfillment)}
                    </div>
                )}

                {settings.delivery_enabled && errorMessage && (
                    <div className="p-3 mb-3 text-sm text-white bg-red-500 dark:bg-red-600 rounded-lg">
                        {errorMessage}
                    </div>
                )}

                <div onClick={() => setAttemptedSubmit(true)}>
                    <button
                        type="button"
                        onClick={confirmOrder}
                        disabled={
                            saving ||
                            !validation.ok ||
                            fulfillment?.can_accept === false ||
                            !settings.delivery_enabled ||
                            !isPhoneValid
                        }

                        className={`w-full rounded-xl font-semibold px-4 py-3 transition 
    ${validation.ok &&
                                addr.firstName &&
                                addr.lastName &&
                                isPhoneValid &&
                                fulfillment?.can_accept !== false &&
                                settings.delivery_enabled
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400 cursor-not-allowed'}`}
                    >
                        {saving ? t('processing') : t('confirmOrder')}
                    </button>
                </div>

            </aside>
        </div>
    )
}