import { NextResponse } from 'next/server'
import { getStoreSettings } from '@/lib/getStoreSettings'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { calculateDeliveryFee } from '@/lib/delivery'
import type { StoreSettings } from '@/lib/types'

export const runtime = 'nodejs'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

/** POST: calcola preview della consegna (distance_km e delivery_fee) senza creare ordini */
export async function POST(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: '❌ Variabili ENV mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
                { status: 500 }
            )
        }

        const body = await req.json()

        // Verifica campi base
        if (!body.address || !body.city || !body.cap) {
            return NextResponse.json({ error: 'Indirizzo incompleto (richiesti: address, city, cap)' }, { status: 400 })
        }

        // Carica le impostazioni del negozio
        const settings = await getStoreSettings()
        if (!settings) {
            return NextResponse.json({ error: 'Impossibile caricare le impostazioni del negozio' }, { status: 500 })
        }

        // Costruisci baseUrl dal dominio della richiesta corrente (funziona sia in Preview che Production)
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`

        // Calcola distanza cliente ↔ negozio
        const clientCoords = await geocodeAddress(
            `${body.address}, ${body.cap} ${body.city}`,
            baseUrl
        )

        if (!clientCoords) {
            return NextResponse.json({ error: 'Impossibile geocodificare l\'indirizzo del cliente' }, { status: 400 })
        }
        const distanceKm = computeDistanceFromStore(settings, clientCoords)

        // Validazione raggio massimo da variabile d'ambiente
        const MAX_RADIUS_KM = Number(process.env.NEXT_PUBLIC_DELIVERY_RADIUS_KM ?? 0)
        if (MAX_RADIUS_KM > 0 && distanceKm > MAX_RADIUS_KM) {
            return NextResponse.json(
                { error: 'Indirizzo fuori dal raggio di consegna' },
                { status: 400 }
            )
        }

        // Calcolo delivery fee (stessa logica di /api/orders)
        let deliveryFee = 0
        if (settings.delivery_enabled) {
            // Leggi i campi delivery dal database (possono non essere nel tipo TypeScript)
            const settingsData = settings as any
            const baseKm = Number(settingsData.delivery_base_km ?? 0)
            const baseFee = Number(settingsData.delivery_base_fee ?? settings.delivery_fee_base ?? 0)
            const extraFeePerKm = Number(settingsData.delivery_extra_fee_per_km ?? settings.delivery_fee_per_km ?? 0)
            const maxKm = Number(settings.delivery_max_km ?? 0)

            // Validazione raggio massimo
            if (distanceKm > maxKm) {
                return NextResponse.json({ error: '⚠️ Indirizzo fuori dal raggio di consegna' }, { status: 400 })
            }

            try {
                deliveryFee = calculateDeliveryFee({
                    distanceKm,
                    baseKm,
                    baseFee,
                    extraFeePerKm,
                    maxKm,
                })
            } catch (error: any) {
                return NextResponse.json({ error: error.message || 'Errore calcolo delivery fee' }, { status: 400 })
            }
        }

        return NextResponse.json({
            distance_km: round2(distanceKm),
            delivery_fee: deliveryFee,
        })
    } catch (e: any) {
        console.error('❌ API ERROR /api/delivery/preview:', e)
        return NextResponse.json(
            { error: e?.message ?? 'Errore interno' },
            { status: 500 }
        )
    }
}

