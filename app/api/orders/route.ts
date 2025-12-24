import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseService'
import type { OrderPayload, StoreSettings, PaymentMethod } from '@/lib/types'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { calculateDeliveryFee } from '@/lib/delivery'



export const runtime = 'nodejs'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

// 🔎 Nuovo helper per normalizzare numeri (accetta "8,5" e "8.5")
function parseDec(v: unknown, field: string): number {
    if (v === null || v === undefined) throw new Error(`Invalid ${field}`)
    let s = typeof v === 'string' ? v.trim() : String(v)
    if (s === '' || s.toLowerCase() === 'nan') throw new Error(`Invalid ${field}`)
    s = s.replace(',', '.')
    const n = parseFloat(s)
    if (isNaN(n)) throw new Error(`Invalid ${field}`)
    return parseFloat(n.toFixed(3)) // mantiene fino a 3 decimali, es: 0.5 → ok
}


async function loadSettings(): Promise<StoreSettings | null> {
    const { data, error } = await supabaseService
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('❌ Errore loadSettings:', error.message)
        return null
    }

    return (data ?? null) as StoreSettings | null
}

/** Normalizza i metodi di pagamento dal body */
function normalizePaymentMethod(pm: string): PaymentMethod | null {
    switch (pm) {
        case 'cash':
            return 'cash'
        case 'card':
            return 'pos_on_delivery'
        case 'online':
        case 'card_online':
            return 'card_online'
        case 'pos_on_delivery':
            return 'pos_on_delivery'
        default:
            return null
    }
}

/** GET: health check */
export async function GET() {
    const envOk = {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    const ss = await supabaseService
        .from('store_settings')
        .select('id, updated_at')
        .limit(1)

    const ord = await supabaseService
        .from('orders')
        .select(
            'id, items, subtotal, delivery_fee, total, address, distance_km, payment_method, status, created_at'
        )
        .limit(0)

    return NextResponse.json({
        ok: true,
        checks: {
            envOk,
            store_settings: { status: ss.error ? 'error' : 'ok', error: ss.error?.message ?? null },
            orders: { status: ord.error ? 'error' : 'ok', error: ord.error?.message ?? null },
        },
    })
}

/** POST: crea ordine con validazioni + calcolo distanza */
export async function POST(req: Request) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
            { error: '❌ Variabili ENV mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
            { status: 500 }
        )
    }

    let body: OrderPayload
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
    }

    // Verifica campi base
    if (!Array.isArray(body.items) || body.items.length === 0) {
        return NextResponse.json({ error: 'Il carrello è vuoto' }, { status: 400 })
    }
    if (!body.address?.line1 || !body.address?.city || !body.address?.cap) {
        return NextResponse.json({ error: 'Indirizzo incompleto' }, { status: 400 })
    }

    // Carica le impostazioni del negozio
    const settings = await loadSettings()
    if (!settings) {
        return NextResponse.json({ error: 'Impossibile caricare le impostazioni del negozio' }, { status: 500 })
    }

    // Calcola distanza cliente ↔ negozio
    const clientCoords = await geocodeAddress(
        `${body.address.line1}, ${body.address.cap} ${body.address.city}`
    )

    if (!clientCoords) {
        return NextResponse.json({ error: 'Impossibile geocodificare l’indirizzo del cliente' }, { status: 400 })
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

    // Calcolo delivery fee lato server (ignora qualsiasi delivery_fee dal frontend)
    let deliveryFee = 0
    if (settings.delivery_enabled) {
        // Leggi i campi delivery dal database (possono non essere nel tipo TypeScript)
        const settingsData = settings as any
        const baseKm = Number(settingsData.delivery_base_km ?? 0)
        const baseFee = Number(settingsData.delivery_base_fee ?? settings.delivery_fee_base ?? 0)
        const extraFeePerKm = Number(settingsData.delivery_extra_fee_per_km ?? settings.delivery_fee_per_km ?? 0)
        const maxKm = Number(settings.delivery_max_km ?? 0)

        // Validazione raggio massimo (già gestita da calculateDeliveryFee, ma facciamo un check preventivo)
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

    // Validazione metodo di pagamento con normalizzazione
    const pm = normalizePaymentMethod(body.payment_method as string)
    if (!pm || !settings.payment_methods.includes(pm)) {
        return NextResponse.json({ error: 'Metodo di pagamento non disponibile' }, { status: 400 })
    }


    // Normalizza gli items
    let items: { id: string; quantity: number; price: number }[] = []
    try {
        items = body.items.map((it) => ({
            id: it.id,
            price: parseDec(it.price ?? 0, 'price'),
            quantity: parseDec(it.qty ?? it.quantity ?? 1, 'qty'),
        }))
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? 'Formato numerico non valido' },
            { status: 400 }
        )
    }

    // Validazione items
    for (const it of items) {
        if (!it.id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
            return NextResponse.json({ error: 'Formato degli articoli non valido' }, { status: 400 })
        }
    }

    // Calcola totali (ignora delivery_fee dal frontend, usa quello calcolato lato server)
    const safeSubtotal = parseDec(body.subtotal, 'subtotal')
    const total = round2(safeSubtotal + deliveryFee)

    // Crea l'ordine direttamente
    const { data: orderData, error: orderError } = await supabaseService
        .from('orders')
        .insert({
            subtotal: safeSubtotal,
            delivery_fee: deliveryFee,
            total: total,
            address: body.address,
            payment_method: pm,
            payment_status: 'pending',
            status: 'pending',
            distance_km: round2(distanceKm),
        })
        .select('id')
        .single()

    if (orderError || !orderData) {
        console.error('❌ Errore creazione ordine:', JSON.stringify(orderError, null, 2))
        const msg = (orderError as any)?.message || 'Errore durante la creazione ordine'
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        )
    }

    const newOrderId = orderData.id

    // --- Inserimento degli order_items --- //
    for (const item of items) {
        const { id: productId, quantity, price } = item

        const { error: itemError } = await supabaseService
            .from('order_items')
            .insert({
                order_id: newOrderId,
                product_id: productId,
                quantity: quantity,
                price: price,
            })

        if (itemError) {
            console.error('Errore inserimento item:', itemError)
            return NextResponse.json(
                { error: 'Errore durante il salvataggio degli articoli' },
                { status: 500 }
            )
        }
    }

    return NextResponse.json({ 
        ok: true, 
        order_id: newOrderId,
        delivery_fee: deliveryFee,
        total: total,
        distance_km: round2(distanceKm)
    })


}

