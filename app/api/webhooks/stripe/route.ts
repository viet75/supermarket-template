import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { handleOrderPaid } from '@/lib/handleOrderPaid'

export const runtime = 'nodejs'

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
      // ✅ Leggi orderId esclusivamente da session.metadata.orderId
      const orderId = session.metadata?.orderId

      // ✅ Se orderId manca, logga e ritorna 200 (mai 500)
      if (!orderId) {
        console.error('⚠️ orderId mancante nella metadata Stripe session:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ Proteggi l'update Supabase: se errore, logga e ritorna 200
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed', 
          stripe_payment_intent_id: session.payment_intent ?? null,
          stripe_session_id: session.id,
        })
        .eq('id', orderId)


      if (error) {
        console.error('❌ Errore aggiornamento ordine in Supabase:', {
          orderId,
          sessionId: session.id,
          error: error.message,
          details: error
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Gestisce lo scalaggio stock SUBITO DOPO l'update del database
      const handleResult = await handleOrderPaid(orderId)
      if (handleResult && !handleResult.ok) {
        console.error('❌ Scalaggio stock fallito dopo checkout.completed:', {
          orderId,
          error: handleResult.error,
        })
      } else if (handleResult && handleResult.ok) {
        console.log('✅ Stock gestito con successo per ordine:', orderId)
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    console.error('❌ Errore interno webhook:', err.message, err)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

