// lib/geo.ts
import type { StoreSettings } from '@/lib/types'

export type Coordinates = {
    lat: number
    lng: number
}

export async function geocodeAddress(q: string, baseUrl?: string) {
    // Query validation
    if (!q || typeof q !== 'string' || !q.trim()) {
        console.error('❌ geocodeAddress: query vuota o non valida:', q)
        return null
    }

    // Client-side: always use relative path (automatically resolves with current domain)
    // Server-side: if baseUrl is provided, use it; otherwise use relative path (Next.js resolves it automatically)
    // On the server side: if baseUrl is provided, use it; otherwise use a relative path (Next.js resolves it automatically)
    const url = baseUrl 
        ? `${baseUrl}/api/geocode?q=${encodeURIComponent(q.trim())}`
        : `/api/geocode?q=${encodeURIComponent(q.trim())}`
    
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const text = await res.text()
            console.error('❌ API error /api/geocode:', { status: res.status, url, text })
            return null
        }
        const json = await res.json()
        if (!json.ok) {
            console.error('❌ geocodeAddress: API restituito ok=false:', json)
            return null
        }
        return { lat: json.lat, lng: json.lng, formatted: json.formatted }
    } catch (err) {
        console.error('❌ Errore geocodifica:', { err, url, query: q })
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

    // 🔥 Automatic fallback from ENV variables
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
