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
        } | null

        if (!body) {
            return NextResponse.json({ error: 'Corpo richiesta non valido' }, { status: 400 })
        }

        const { orderId, total, items } = body
        if (!orderId || !items || items.length === 0) {
            return NextResponse.json({ error: 'Dati ordine mancanti' }, { status: 400 })
        }

        // Recupera l'ordine dal database per ottenere delivery_fee
        const { data: order, error: orderError } = await supabaseService
            .from('orders')
            .select('delivery_fee, total')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
        }

        const deliveryFee = Number(order.delivery_fee ?? 0)

        const proto = req.headers.get('x-forwarded-proto') ?? 'http'
        const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
        const siteUrl = host ? `${proto}://${host}` : 'http://localhost:3000'

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
