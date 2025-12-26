// lib/geo.ts
import type { StoreSettings } from '@/lib/types'

export type Coordinates = {
    lat: number
    lng: number
}

export async function geocodeAddress(q: string, baseUrl?: string) {
    // Lato client: usa sempre path relativo (funziona automaticamente con il dominio corrente)
    // Lato server: se baseUrl è fornito, usalo; altrimenti usa path relativo (Next.js lo risolve automaticamente)
    const url = baseUrl 
        ? `${baseUrl}/api/geocode?q=${encodeURIComponent(q)}`
        : `/api/geocode?q=${encodeURIComponent(q)}`
    
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const text = await res.text()
            console.error('❌ API error /api/geocode:', text)
            return null
        }
        const json = await res.json()
        return json.ok ? { lat: json.lat, lng: json.lng, formatted: json.formatted } : null
    } catch (err) {
        console.error('Errore geocodifica:', err)
        return null
    }
}

export function haversineDistance(a: Coordinates, b: Coordinates): number {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLon = (b.lng - a.lng) * Math.PI / 180
    const lat1 = (a.lat * Math.PI) / 180
    const lat2 = (b.lat * Math.PI) / 180

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function computeDistanceFromStore(
    store: StoreSettings,
    client: Coordinates | null
): number {
    if (!client) {
        console.warn("⚠️ computeDistanceFromStore: client null")
        return 0
    }

    // 🔥 FALLBACK AUTOMATICO dalle ENV
    const envLat = process.env.NEXT_PUBLIC_STORE_LAT
    const envLng = process.env.NEXT_PUBLIC_STORE_LNG

    const storeLat =
        store.store_lat ??
        (envLat ? parseFloat(envLat) : null)

    const storeLng =
        store.store_lng ??
        (envLng ? parseFloat(envLng) : null)

    if (storeLat == null || storeLng == null) {
        console.error("❌ computeDistanceFromStore: store_lat/store_lng mancanti (DB + ENV)")
        return 0
    }

    const dist = haversineDistance(
        { lat: storeLat, lng: storeLng },
        client
    )
    const rounded = Math.round(dist * 100) / 100
    console.log("📏 Distanza calcolata:", rounded, "km")
    return rounded
}
