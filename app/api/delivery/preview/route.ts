import { NextResponse } from 'next/server'
import { getStoreSettings } from '@/lib/getStoreSettings'
import { computeDistanceFromStore } from '@/lib/geo'
import { calculateDeliveryFee, normalizeDeliveryMaxKm } from '@/lib/delivery'
import type { StoreSettings } from '@/lib/types'

export const runtime = 'nodejs'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

/** POST: calculates a delivery preview (distance_km and delivery_fee) without creating an order */
export async function POST(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: 'Missing ENV variables (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
                { status: 500 }
            )
        }

        const body = await req.json()

        // Verify base fields
        if (!body.address || !body.city || !body.cap) {
            return NextResponse.json({ error: 'Incomplete address (required: address, city, zip)' }, { status: 400 })
        }

        // Load store settings
        const settings = await getStoreSettings()
        if (!settings) {
            return NextResponse.json({ error: 'Unable to load store settings' }, { status: 500 })
        }

        // Build baseUrl from the current request domain (works in Preview and Production)
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`

        // Costruisci e valida query per geocodifica
        const query = [body.address, body.cap, body.city]
            .filter(Boolean)
            .map((s: any) => String(s).trim())
            .filter((s: string) => s.length > 0)
            .join(', ')

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Incomplete customer address' },
                { status: 400 }
            )
        }

        // Call /api/geocode in strict mode
        const geocodeUrl = new URL(`${baseUrl}/api/geocode`)
        geocodeUrl.searchParams.set('q', `${query.trim()}, Italia`)
        if (body.cap) geocodeUrl.searchParams.set('zip', String(body.cap).trim())
        if (body.city) geocodeUrl.searchParams.set('city', String(body.city).trim())

        const geocodeRes = await fetch(geocodeUrl.toString())
        const geocodeText = await geocodeRes.text()
        let geocodeJson: any
        try {
            geocodeJson = JSON.parse(geocodeText)
        } catch (e) {
            return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
        }

        if (!geocodeRes.ok || geocodeJson.ok !== true) {
            return NextResponse.json(
                { error: geocodeJson.error || 'Invalid address' },
                { status: 400 }
            )
        }

        // Calculate distance customer ↔ store
        const clientCoords = { lat: geocodeJson.lat, lng: geocodeJson.lng }
        const distanceKm = computeDistanceFromStore(settings, clientCoords)

        // Validation of maximum radius from environment variable
        const MAX_RADIUS_KM = Number(process.env.NEXT_PUBLIC_DELIVERY_RADIUS_KM ?? 0)
        if (MAX_RADIUS_KM > 0 && distanceKm > MAX_RADIUS_KM) {
            return NextResponse.json(
                { error: 'Address outside delivery area' },
                { status: 400 }
            )
        }

        // Calculate delivery fee (same logic as /api/orders)
        let deliveryFee = 0
        if (settings.delivery_enabled) {
            // Read delivery fields from database (they may not be in the TypeScript type)
            const settingsData = settings as any
            const baseKm = Number(settingsData.delivery_base_km ?? 0)
            const baseFee = Number(settingsData.delivery_base_fee ?? settings.delivery_fee_base ?? 0)
            const extraFeePerKm = Number(settingsData.delivery_extra_fee_per_km ?? settings.delivery_fee_per_km ?? 0)
            const maxKmSafe = normalizeDeliveryMaxKm(settings.delivery_max_km)

            if (maxKmSafe !== null && distanceKm > maxKmSafe) {
                return NextResponse.json({ error: 'Address outside delivery area' }, { status: 400 })
            }

            try {
                deliveryFee = calculateDeliveryFee({
                    distanceKm,
                    baseKm,
                    baseFee,
                    extraFeePerKm,
                    maxKm: maxKmSafe,
                })
            } catch (error: any) {
                return NextResponse.json({ error: error.message || 'Delivery fee calculation error' }, { status: 400 })
            }
        }

        return NextResponse.json({
            distance_km: round2(distanceKm),
            delivery_fee: deliveryFee,
        })
    } catch (e: any) {
        console.error('❌ API ERROR /api/delivery/preview:', e)
        return NextResponse.json(
            { error: e?.message ?? 'Internal server error' },
            { status: 500 }
        )
    }
}

