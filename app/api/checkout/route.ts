// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { supabaseService } from '@/lib/supabaseService'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => null)) as {
            orderId?: string
            total?: number
            items?: {
                id: string
                name: string
                price: number
                quantity: number
                unit?: string
                image_url?: string
            }[]
            address?: {
                line1?: string
                city?: string
                cap?: string
            }
        } | null

        if (!body) {
            return NextResponse.json({ error: 'Corpo richiesta non valido' }, { status: 400 })
        }

        const { orderId, total, items } = body
        if (!orderId || !items || items.length === 0) {
            return NextResponse.json({ error: 'Dati ordine mancanti' }, { status: 400 })
        }

        // Recupera l'ordine dal database per ottenere delivery_fee e address
        const { data: order, error: orderError } = await supabaseService
            .from('orders')
            .select('delivery_fee, total, address')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
        }

        const deliveryFee = Number(order.delivery_fee ?? 0)

        // Determina i campi da validare: usa body.address se presente, altrimenti fallback su order.address
        const orderAddress = order.address as { cap?: string; line1?: string; city?: string } | null
        const bodyAddress = body.address
        
        // Se body.address contiene line1/city/cap non vuoti -> usa quelli, altrimenti fallback su order.address
        const line1 = (bodyAddress?.line1 && bodyAddress.line1.trim()) 
            ? String(bodyAddress.line1).trim() 
            : (orderAddress?.line1 ? String(orderAddress.line1).trim() : null)
        const city = (bodyAddress?.city && bodyAddress.city.trim()) 
            ? String(bodyAddress.city).trim() 
            : (orderAddress?.city ? String(orderAddress.city).trim() : null)
        const zip = (bodyAddress?.cap && bodyAddress.cap.trim()) 
            ? String(bodyAddress.cap).trim() 
            : (orderAddress?.cap ? String(orderAddress.cap).trim() : null)

        // Se city/zip mancanti -> 400 (non creare sessione Stripe)
        if (!city || !zip) {
            return NextResponse.json(
                { error: 'CAP non valido o indirizzo non trovato' },
                { status: 400 }
            )
        }

        // Valida formato CAP
        if (!/^\d{5}$/.test(zip) || zip === '00000') {
            return NextResponse.json(
                { error: 'CAP non valido o indirizzo non trovato' },
                { status: 400 }
            )
        }

        // Chiama geocode SEMPRE passando q, zip, city
        try {
            // Costruisci query indirizzo (solo line1 se disponibile, altrimenti usa zip+city)
            const query = line1 
                ? [line1, zip, city].filter(Boolean).join(', ')
                : [zip, city].filter(Boolean).join(', ')

            if (!query) {
                return NextResponse.json(
                    { error: 'CAP non valido o indirizzo non trovato' },
                    { status: 400 }
                )
            }

            // Deriva baseUrl da req.url invece di usare localhost hardcoded
            const url = new URL(req.url)
            const baseUrl = `${url.protocol}//${url.host}`
            const geocodeUrl = `${baseUrl}/api/geocode?q=${encodeURIComponent(query)}&zip=${encodeURIComponent(zip)}&city=${encodeURIComponent(city)}`

            const geocodeRes = await fetch(geocodeUrl)
            
            // Gestione sicura del parsing JSON
            let geocodeData: any = null
            try {
                const text = await geocodeRes.text()
                geocodeData = JSON.parse(text)
            } catch (parseError) {
                // Se il parsing fallisce, blocca il pagamento
                return NextResponse.json(
                    { error: 'CAP non valido o indirizzo non trovato' },
                    { status: 400 }
                )
            }

            // Se geocode non ok o mismatch -> return 400 e NON creare sessione Stripe
            if (!geocodeData.ok) {
                return NextResponse.json(
                    { error: 'CAP non valido o indirizzo non trovato' },
                    { status: 400 }
                )
            }
        } catch (geocodeError) {
            // Se il geocode fallisce, blocca comunque il pagamento
            return NextResponse.json(
                { error: 'CAP non valido o indirizzo non trovato' },
                { status: 400 }
            )
        }

        // Se body.address è presente (almeno uno tra line1/city/cap), aggiorna Supabase PRIMA di creare la sessione Stripe
        if (bodyAddress && (bodyAddress.line1 || bodyAddress.city || bodyAddress.cap)) {
            try {
                // Merge semplice: usa i valori finali determinati (line1, city, zip) che già hanno priorità body.address > order.address
                const mergedAddress = {
                    ...(orderAddress || {}),
                    ...(line1 ? { line1 } : {}),
                    ...(city ? { city } : {}),
                    ...(zip ? { cap: zip } : {}),
                }

                await supabaseService
                    .from('orders')
                    .update({
                        address: mergedAddress,
                    })
                    .eq('id', orderId)
            } catch (updateError) {
                // Se l'aggiornamento fallisce, blocca il pagamento per sicurezza
                console.error('Errore aggiornamento indirizzo:', updateError)
                return NextResponse.json(
                    { error: 'Errore aggiornamento indirizzo' },
                    { status: 500 }
                )
            }
        }

        // Deriva siteUrl da req.url invece di usare localhost hardcoded
        const url = new URL(req.url)
        const siteUrl = `${url.protocol}//${url.host}`

        // genera line_items da items del frontend con conversione numerica sicura
        const line_items = items.map((it) => {
            const price = parseFloat(String(it.price).replace(',', '.')) || 0
            const quantity = parseFloat(String(it.quantity ?? 1).replace(',', '.')) || 1

            // ✅ Stripe accetta solo quantità intere
            // se il prodotto è "per_kg", ingloba la quantità nel prezzo
            if (it.unit === 'per_kg') {
                return {
                    quantity: 1, // sempre 1 per i prodotti a peso
                    price_data: {
                        currency: 'eur',
                        // prezzo totale (prezzo al kg × quantità in kg)
                        unit_amount: Math.round(price * quantity * 100),
                        product_data: {
                            name: `${it.name ?? 'Prodotto'} (${quantity} kg)`,
                            ...(it.image_url ? { images: [it.image_url] } : {}),
                        },
                    },
                }
            }

            // ✅ prodotti venduti "a pezzo"
            return {
                quantity: Math.round(quantity),
                price_data: {
                    currency: 'eur',
                    unit_amount: Math.round(price * 100),
                    product_data: {
                        name: `${it.name ?? 'Prodotto'} (${quantity} pz)`,
                        ...(it.image_url ? { images: [it.image_url] } : {}),
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

        const stripe = getStripe()

        // crea la sessione Stripe
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items,
            success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/checkout?cancelled=1&id=${orderId}`,
            metadata: { orderId },

        })

            // aggiorna lo stato in background (non blocca il redirect)
            ; (async () => {
                try {
                    await supabaseService
                        .from('orders')
                        .update({
                            stripe_session_id: session.id,
                        })
                        .eq('id', orderId)
                } catch { }
            })()

        // redirect immediato a Stripe
        return NextResponse.json({ url: session.url, id: session.id })
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message ?? 'Errore creazione sessione di pagamento' },
            { status: 500 }
        )
    }
}
