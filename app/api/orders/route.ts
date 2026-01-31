import { NextResponse } from 'next/server'
import { supabaseServiceRole } from '@/lib/supabaseService'
import type { OrderPayload, StoreSettings, PaymentMethod } from '@/lib/types'
import { geocodeAddress, computeDistanceFromStore } from '@/lib/geo'
import { calculateDeliveryFee } from '@/lib/delivery'
import { reserveOrderStock } from '@/lib/reserveOrderStock'
import { release_order_stock } from '@/lib/releaseOrderStock'
import { getStripe } from '@/lib/stripe'
import { cleanupExpiredReservations } from '@/lib/cleanupExpiredReservations'



export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function round2(n: number) {
    return Math.round(n * 100) / 100
}

// 🔎 Helper robusto per normalizzare numeri (accetta "8,5" e "8.5", number o string)
function parseDec(v: unknown, field: string): number {
    // Se è già un numero valido, restituiscilo direttamente
    if (typeof v === 'number') {
        if (isNaN(v) || !isFinite(v) || v <= 0) {
            throw new Error(`Invalid ${field}: must be a positive number`)
        }
        return parseFloat(v.toFixed(3)) // mantiene fino a 3 decimali
    }
    
    // Se è null/undefined, errore
    if (v === null || v === undefined) {
        throw new Error(`Invalid ${field}: value is required`)
    }
    
    // Converti a stringa e pulisci
    let s = String(v).trim()
    if (s === '' || s.toLowerCase() === 'nan') {
        throw new Error(`Invalid ${field}: empty or NaN`)
    }
    
    // Sostituisci virgola italiana con punto
    s = s.replace(',', '.')
    
    // Rimuovi eventuali spazi
    s = s.replace(/\s/g, '')
    
    // Parse
    const n = parseFloat(s)
    if (isNaN(n) || !isFinite(n)) {
        throw new Error(`Invalid ${field}: not a valid number`)
    }
    
    // Valida che sia positivo
    if (n <= 0) {
        throw new Error(`Invalid ${field}: must be greater than 0`)
    }
    
    return parseFloat(n.toFixed(3)) // mantiene fino a 3 decimali
}


async function loadSettings(): Promise<StoreSettings | null> {
    const { data, error } = await supabaseServiceRole
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

    const ss = await supabaseServiceRole
        .from('store_settings')
        .select('id, updated_at')
        .limit(1)

    const ord = await supabaseServiceRole
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
    try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json(
                { error: '❌ Variabili ENV mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' },
                { status: 500 }
            )
        }

        // Lazy cleanup (backup): rilascia ordini scaduti prima di creare nuovo ordine
        // Se il cron non gira, il primo utente che fa un ordine sblocca lo stock
        await cleanupExpiredReservations()

        const body = await req.json()

        // 🧾 Debug: log items payload
        console.log("🧾 /api/orders items payload:", JSON.stringify(body?.items ?? body?.order_items ?? null));

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

        // Costruisci baseUrl dal dominio della richiesta corrente (funziona sia in Preview che Production)
        const url = new URL(req.url)
        const baseUrl = `${url.protocol}//${url.host}`

        // Costruisci e valida query per geocodifica
        const query = [body.address.line1, body.address.cap, body.address.city]
            .filter(Boolean)
            .map((s: any) => String(s).trim())
            .filter((s: string) => s.length > 0)
            .join(', ')

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Indirizzo cliente incompleto' },
                { status: 400 }
            )
        }

        // Valida CAP e città con geocode prima di creare l'ordine
        const zip = body.address.cap ? String(body.address.cap).trim() : null
        const city = body.address.city ? String(body.address.city).trim() : null

        // Valida formato CAP
        if (!zip || !/^\d{5}$/.test(zip) || zip === '00000') {
            return NextResponse.json({ error: 'CAP non valido' }, { status: 400 })
        }

        // Chiama geocode con validazione CAP e città
        const geocodeUrl = `${baseUrl}/api/geocode?q=${encodeURIComponent(query.trim())}&zip=${encodeURIComponent(zip)}&city=${encodeURIComponent(city || '')}`
        let geocodeData: any = null
        try {
            const geocodeRes = await fetch(geocodeUrl)
            const text = await geocodeRes.text()
            geocodeData = JSON.parse(text)
        } catch (err) {
            console.error('❌ Errore geocodifica:', err)
            return NextResponse.json({ error: 'Impossibile geocodificare l\'indirizzo del cliente' }, { status: 400 })
        }

        if (!geocodeData.ok) {
            return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
        }

        const clientCoords = { lat: geocodeData.lat, lng: geocodeData.lng }
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


        // Normalizza gli items con validazione robusta
        let items: { id: string; quantity: number; price: number }[] = []
        try {
            items = body.items.map((it: {
                id: string
                price?: number | string
                qty?: number | string
                quantity?: number | string
            }) => {
                // Normalizza quantity: accetta number, string con virgola italiana, o string con punto
                const rawQty = it.qty ?? it.quantity ?? 1
                const normalizedQty = parseDec(rawQty, 'quantity')
                
                // Normalizza price
                const normalizedPrice = parseDec(it.price ?? 0, 'price')
                
                return {
                    id: it.id,
                    price: normalizedPrice,
                    quantity: normalizedQty, // Usa il valore normalizzato
                }
            })
        } catch (e: any) {
            return NextResponse.json(
                { error: e?.message ?? 'Formato numerico non valido' },
                { status: 400 }
            )
        }

        // Validazione items (doppio check per sicurezza)
        for (const it of items) {
            if (!it.id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
                return NextResponse.json({ error: 'Formato degli articoli non valido' }, { status: 400 })
            }
        }

        // Calcola totali (ignora delivery_fee dal frontend, usa quello calcolato lato server)
        const safeSubtotal = parseDec(body.subtotal, 'subtotal')
        const total = round2(safeSubtotal + deliveryFee)

        // Crea l'ordine direttamente
        // IMPORTANTE: stock_reserved deve essere false all'insert, viene settato a true solo da reserveOrderStock
        const { data: orderData, error: orderError } = await supabaseServiceRole
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
                stock_reserved: false, // Forzato a false: verrà settato a true solo da reserveOrderStock dopo decrement riuscito
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
        let stockCommitted = false // Track if reserveOrderStock succeeded

        // --- Inserimento degli order_items --- //
        for (const item of items) {
            const { id: productId, quantity, price } = item

            const { error: itemError } = await supabaseServiceRole
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

        // Riserva stock dopo l'inserimento di tutti gli order_items
        try {
            await reserveOrderStock(newOrderId)
            stockCommitted = true // Mark that stock reservation succeeded
        } catch (error) {
            // 📦 Debug: log stock check details before returning error
            const errorMessage = error instanceof Error ? error.message : 'Stock non disponibile per uno o più prodotti'
            
            // Extract product name from error message if it matches pattern "Stock insufficiente per <productName>"
            const stockErrorMatch = errorMessage.match(/Stock insufficiente per (.+)/)
            if (stockErrorMatch) {
                const productName = stockErrorMatch[1]
                
                // Query order_items with products to get full product details
                const { data: orderItemsWithProducts } = await supabaseServiceRole
                    .from('order_items')
                    .select('quantity, product_id, products(id, name, stock, unit_type, stock_unlimited)')
                    .eq('order_id', newOrderId)
                
                if (orderItemsWithProducts && orderItemsWithProducts.length > 0) {
                    // Find the product that matches the error
                    for (const oi of orderItemsWithProducts) {
                        let productData = (oi as any).products
                        if (Array.isArray(productData)) {
                            productData = productData[0] || null
                        }
                        if (productData && productData.name === productName) {
                            console.log("📦 Stock check", {
                                productId: oi.product_id,
                                productName: productData.name,
                                unitType: productData.unit_type || null,
                                stock: productData.stock ?? null,
                                stockUnlimited: productData.stock_unlimited ?? false,
                                requestedQty: oi.quantity
                            })
                            break
                        }
                    }
                }
            }
            
            // Cleanup: elimina order_items e ordine
            await supabaseServiceRole.from('order_items').delete().eq('order_id', newOrderId)
            await supabaseServiceRole.from('orders').delete().eq('id', newOrderId)
            
            // Stock insufficiente: HTTP 409 + code STOCK_INSUFFICIENT per UX dedicata
            const isStockError = errorMessage.includes('INSUFFICIENT_STOCK') || errorMessage.includes('Stock insufficiente')
            const status = isStockError ? 409 : 400
            const body = isStockError
                ? { ok: false, code: 'STOCK_INSUFFICIENT', message: 'Alcuni prodotti non sono più disponibili. Abbiamo aggiornato il carrello.' }
                : { error: errorMessage }
            return NextResponse.json(body, {
                status,
                headers: { 'Cache-Control': 'no-store' },
            })
        }

        // Wrap everything after reserveOrderStock in try/catch for rollback protection
        try {
            // Imposta stock_committed=true e reserve_expires_at in base al metodo di pagamento
            let reserveExpiresAt: string | null = null
            let stockReserved: boolean

            if (pm === 'card_online') {
              // TTL diverso per dev/prod
              const TTL_MINUTES =
                process.env.NODE_ENV === 'development' ? 1 : 15
            
              const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000)
              reserveExpiresAt = expiresAt.toISOString()
              stockReserved = true
            } else {
              // Per cash/pos_on_delivery: non è una riserva temporanea, quindi stock_reserved=false
              stockReserved = false
            }

            // Aggiorna ordine: stock_committed=true per tutti i metodi, stock_reserved e reserve_expires_at solo per card_online
            await supabaseServiceRole
                .from('orders')
                .update({
                    stock_committed: true,
                    stock_reserved: stockReserved,
                    reserve_expires_at: reserveExpiresAt,
                })
                .eq('id', newOrderId)

            // Se payment_method è card_online, crea Stripe Checkout Session
            let checkoutUrl: string | null = null
            if (pm === 'card_online') {
                try {
                    // Leggi order_items con join products per ottenere name, unit_type, image_url
                    const { data: orderItems, error: itemsError } = await supabaseServiceRole
                        .from('order_items')
                        .select('quantity, price, products(id, name, unit_type, image_url)')
                        .eq('order_id', newOrderId)

                    if (itemsError || !orderItems || orderItems.length === 0) {
                        throw new Error('Errore caricamento articoli per checkout')
                    }

                    // Costruisci line_items per Stripe
                    const line_items = orderItems.map((it: any) => {
                        // Normalizza product data
                        let productData = it.products
                        if (Array.isArray(productData)) {
                            productData = productData[0] || null
                        }

                        const productName = productData?.name || 'Prodotto'
                        const unitType = productData?.unit_type || 'per_unit'
                        const imageUrl = productData?.image_url || null
                        const quantity = Number(it.quantity) || 1
                        const price = Number(it.price) || 0

                        // Stripe accetta solo quantità intere
                        // Se il prodotto è "per_kg", ingloba la quantità nel prezzo
                        if (unitType === 'per_kg') {
                            return {
                                quantity: 1, // sempre 1 per i prodotti a peso
                                price_data: {
                                    currency: 'eur',
                                    unit_amount: Math.round(price * quantity * 100),
                                    product_data: {
                                        name: `${productName} (${quantity} kg)`,
                                        ...(imageUrl ? { images: [imageUrl] } : {}),
                                    },
                                },
                            }
                        }

                        // Prodotti venduti "a pezzo"
                        return {
                            quantity: Math.round(quantity),
                            price_data: {
                                currency: 'eur',
                                unit_amount: Math.round(price * 100),
                                product_data: {
                                    name: `${productName} (${quantity} pz)`,
                                    ...(imageUrl ? { images: [imageUrl] } : {}),
                                },
                            },
                        }
                    })

                    // Aggiungi delivery fee come line item separato se > 0
                    if (deliveryFee > 0) {
                        line_items.push({
                            quantity: 1,
                            price_data: {
                                currency: 'eur',
                                unit_amount: Math.round(deliveryFee * 100),
                                product_data: {
                                    name: 'Spese di consegna',
                                },
                            },
                        })
                    }

                    // Deriva siteUrl dal dominio della richiesta corrente
                    const url = new URL(req.url)
                    const siteUrl = `${url.protocol}//${url.host}`

                    const stripe = getStripe()

                    // Crea la sessione Stripe
                    const session = await stripe.checkout.sessions.create({
                        mode: 'payment',
                        payment_method_types: ['card'],
                        line_items,
                        success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
                        cancel_url: `${siteUrl}/checkout?cancelled=1&id=${newOrderId}`,
                        metadata: { orderId: newOrderId },
                    })

                    checkoutUrl = session.url

                    // Aggiorna ordine con stripe_session_id (non bloccare se fallisce)
                    void supabaseServiceRole
                        .from('orders')
                        .update({ stripe_session_id: session.id })
                        .eq('id', newOrderId)
                } catch (stripeError: any) {
                    // Re-throw to be caught by outer catch for rollback
                    throw new Error(stripeError?.message ?? 'Errore creazione sessione di pagamento')
                }
            }

            return NextResponse.json(
                {
                    ok: true,
                    order_id: newOrderId,
                    delivery_fee: deliveryFee,
                    total: total,
                    distance_km: round2(distanceKm),
                    ...(checkoutUrl ? { checkoutUrl } : {}),
                },
                { headers: { 'Cache-Control': 'no-store' } }
            )
        } catch (error) {
            // Compensating transaction: if stock was committed, release it
            if (stockCommitted) {
                console.error('❌ Errore dopo reserveOrderStock, rilascio stock per ordine:', newOrderId)
                await release_order_stock(newOrderId).catch((releaseError) => {
                    console.error('❌ Errore durante release_order_stock:', releaseError)
                })
            }
            
            // Cleanup: elimina order_items e ordine
            const { error: cleanupItemsError } = await supabaseServiceRole
                .from('order_items')
                .delete()
                .eq('order_id', newOrderId);
            if (cleanupItemsError && process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ Cleanup order_items error (non-blocking):', cleanupItemsError.message);
            }

            const { error: cleanupOrderError } = await supabaseServiceRole
                .from('orders')
                .delete()
                .eq('id', newOrderId);
            if (cleanupOrderError && process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ Cleanup orders error (non-blocking):', cleanupOrderError.message);
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Errore creazione ordine'
            const isStockError = errorMessage.includes('INSUFFICIENT_STOCK') || errorMessage.includes('Stock insufficiente')

            console.error('❌ Errore dopo reserveOrderStock:', errorMessage)
            const status = isStockError ? 409 : 500
            const body = isStockError
                ? { ok: false, code: 'STOCK_INSUFFICIENT', message: 'Alcuni prodotti non sono più disponibili. Abbiamo aggiornato il carrello.' }
                : { error: errorMessage }
            return NextResponse.json(body, {
                status,
                headers: { 'Cache-Control': 'no-store' },
            })
        }
    } catch (e: any) {
        console.error('❌ API ERROR /api/orders:', e)
        return NextResponse.json(
            { error: e?.message ?? 'Errore interno' },
            { status: 500 }
        )
    }
}
