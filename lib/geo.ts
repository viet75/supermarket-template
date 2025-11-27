// lib/geo.ts
import type { StoreSettings } from '@/lib/types'

export type Coordinates = {
    lat: number
    lng: number
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
    function normalize(str: string) {
        return str
            .trim()
            .replace(/\s+/g, " ")
            .replace(/[^a-zA-Z0-9À-ÿ ,]/g, "")
    }

    async function tryFetch(query: string): Promise<Coordinates | null> {
        try {
            // Se siamo in server-side (Node) serve URL assoluto
            // ✅ Determina l'URL base per la chiamata API, anche su Vercel
            const baseUrl =
                typeof window === "undefined"
                    ? process.env.NEXT_PUBLIC_SITE_URL ||
                    "https://supermercato-pwa-six.vercel.app" // fallback automatico in produzione
                    : ""


            // 🔍 LOG per debug in console server Vercel
            console.log("🌍 geocode baseUrl:", baseUrl)

            const res = await fetch(`${baseUrl}/api/geocode?q=${encodeURIComponent(query)}`)

            if (!res.ok) {
                console.error("❌ Errore API geocode:", res.status)
                return null
            }

            let data: any
            try {
                data = await res.json()
            } catch (err) {
                console.error("❌ Errore parse JSON:", err)
                return null
            }

            if (!Array.isArray(data) || data.length === 0) {
                console.warn("⚠️ Nessun risultato valido dal geocode:", data)
                return null
            }

            const best = data[0]
            console.log("📍 DEBUG geocode:", best.display_name, best.address)

            // ✅ Verifica che sia in Puglia
            const state = best.address?.state || ""
            const region = best.address?.region || ""
            const county = best.address?.county || ""

            const validStates = ["Puglia"]
            const validRegions = ["Puglia"]
            const validCounties = [
                "Taranto",
                "Provincia di Taranto",
                "Bari",
                "Provincia di Bari",
                "Brindisi",
                "Provincia di Brindisi",
                "Lecce",
                "Provincia di Lecce",
                "Foggia",
                "Provincia di Foggia",
                "Barletta-Andria-Trani",
                "Provincia di Barletta-Andria-Trani",
            ]


            const isPuglia =
                validStates.includes(state) ||
                validRegions.includes(region) ||
                validCounties.includes(county)

            if (!isPuglia) {
                console.warn("⚠️ Indirizzo trovato ma fuori dalla Puglia:", best.display_name)
                return null
            }

            return {
                lat: parseFloat(best.lat),
                lng: parseFloat(best.lon),
            }
        } catch (err) {
            console.error("❌ Errore fetch /api/geocode:", err)
            return null
        }
    }

    // 🔎 Tentativi multipli
    const cleanAddress = normalize(address)
    const attempts = [
        `${cleanAddress}, Puglia, Italia`,
        `${cleanAddress}, Italia`,
        cleanAddress,
    ]

    for (const attempt of attempts) {
        console.log("🔎 Tentativo geocoding:", attempt)
        const coords = await tryFetch(attempt)
        if (coords) {
            console.log("✅ Indirizzo valido:", attempt, coords)
            return coords
        }
        const delay = Number(process.env.GEOCODE_RATE_MS ?? 1200)
        await new Promise((r) => setTimeout(r, delay)) // rispetto rate limit

    }

    console.error("❌ Geocoding fallito per:", address)
    return null
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
    if (store.store_lat == null || store.store_lng == null) {
        console.error("❌ computeDistanceFromStore: store_lat/store_lng mancanti")
        return 0
    }

    const dist = haversineDistance(
        { lat: store.store_lat, lng: store.store_lng },
        client
    )
    const rounded = Math.round(dist * 100) / 100
    console.log("📏 Distanza calcolata:", rounded, "km")
    return rounded
}
