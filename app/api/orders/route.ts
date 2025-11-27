import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabaseService'
import type { OrderPayload, StoreSettings, PaymentMethod } from '@/lib/types'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'



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
        case 'card_on_delivery':
            return 'card_on_delivery'
        case 'online':
        case 'card_online':
            return 'card_online'
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

    // Validazione raggio massimo
    if (settings.delivery_enabled && distanceKm > settings.delivery_max_km) {
        return NextResponse.json({ error: '⚠️ Indirizzo fuori dal raggio di consegna' }, { status: 400 })
    }

    // Calcolo fee consegna
    let fee = settings.delivery_enabled
        ? round2(settings.delivery_fee_base + distanceKm * settings.delivery_fee_per_km)
        : 0

    if (settings.delivery_enabled && settings.free_over > 0 && parseDec(body.subtotal, 'subtotal') >= settings.free_over) {
        fee = 0
    }

    // Validazione metodo di pagamento con normalizzazione
    const pm = normalizePaymentMethod(body.payment_method as string)
    if (!pm || !settings.payment_methods.includes(pm)) {
        return NextResponse.json({ error: 'Metodo di pagamento non disponibile' }, { status: 400 })
    }


    // Ricostruisci gli items come JSON array con numeri puliti
    let rpcItems: { id: string; name: string; price: number; quantity: number; unit?: string }[] = []
    try {
        rpcItems = body.items.map((it) => ({
            id: it.id,
            name: it.name,
            price: parseDec(it.price ?? 0, 'price'),
            quantity: parseDec(it.qty ?? it.quantity ?? 1, 'qty'),
            // 👈 qty dal frontend → quantity nel DB
            unit: it.unit ?? undefined,              // 👈 fix TS: mai null
        }))
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message ?? 'Formato numerico non valido' },
            { status: 400 }
        )
    }


    for (const it of rpcItems) {
        if (!it.id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
            return NextResponse.json({ error: 'Formato degli articoli non valido' }, { status: 400 })
        }
    }


    // Salva ordine via funzione RPC in Supabase
    const safeSubtotal = parseDec(body.subtotal, 'subtotal')
    const { data, error } = await supabaseService.rpc('fn_create_order', {
        items_json: rpcItems,
        subtotal: safeSubtotal,
        delivery_fee: fee,
        total: round2(safeSubtotal + fee),
        address_json: body.address,
        payment_method: pm,
        distance_km: distanceKm,
    })

    if (error || !data) {
        // 🔎 Log più dettagliato dell'errore
        console.error('❌ Errore Supabase dettagliato:', JSON.stringify(error, null, 2))

        const msg = (error as any)?.message || 'Errore durante la creazione ordine'
        const insufficient = /Insufficient stock/i.test(msg)
        return NextResponse.json(
            { error: insufficient ? '❌ Stock insufficiente per uno o più prodotti' : msg },
            { status: insufficient ? 409 : 500 }
        )
    }


    // ✅ Correzione: la funzione fn_create_order restituisce solo l'UUID
    return NextResponse.json(
        {
            id: data, // l'UUID dell'ordine
            total: round2(safeSubtotal + fee),
            status: pm === 'card_online' ? 'pending' : 'confirmed',
            created_at: new Date().toISOString(), // opzionale, per coerenza
        },
        { status: 201 }
    )


}

