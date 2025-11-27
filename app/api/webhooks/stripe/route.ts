import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs' // obbligatorio per accesso body raw

export async function POST(req: Request) {
    const sig = req.headers.get('stripe-signature')
    const whsec = process.env.STRIPE_WEBHOOK_SECRET

    if (!sig || !whsec) {
        console.error('❌ Webhook non configurato correttamente.')
        return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 400 })
    }

    const stripe = getStripe()
    let event

    try {
        const rawBody = await req.text()
        event = stripe.webhooks.constructEvent(rawBody, sig, whsec)
        console.log('✅ Webhook ricevuto:', event.type)
    } catch (err: any) {
        console.error('⚠️ Errore verifica firma webhook:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any
            const orderId = session.metadata?.order_id

            if (!orderId) {
                console.warn('⚠️ Nessun order_id nella sessione.')
                return NextResponse.json({ received: true }, { status: 200 })
            }

            const { error } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    stripe_payment_intent_id: session.payment_intent ?? null,
                    stripe_session_id: session.id,
                })
                .eq('id', orderId)

            if (error) {
                console.error('❌ Errore aggiornamento ordine in Supabase:', error.message)
                return NextResponse.json({ error: 'Supabase update failed' }, { status: 500 })
            }

            console.log(`✅ Ordine ${orderId} aggiornato a "paid"`)
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (err: any) {
        console.error('❌ Errore interno webhook:', err.message)
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }
}
