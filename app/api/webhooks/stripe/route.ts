import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { release_order_stock } from '@/lib/releaseOrderStock'


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

      // ✅ IDEMPOTENZA: Verifica stato ordine prima di aggiornare
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('payment_status, stock_reserved')
        .eq('id', orderId)
        .single()

      if (fetchError || !existingOrder) {
        console.error('❌ Errore lettura ordine nel webhook:', fetchError)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ Se già pagato, ritorna 200 senza side-effects (idempotenza)
      if (existingOrder.payment_status === 'paid') {
        console.log(`✅ Ordine ${orderId} già pagato, webhook idempotente`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ Guard-rail: Se stock_reserved=false (caso anomalo), fallback con riserva
      // Questo protegge da race conditions o errori nella creazione ordine
      if (existingOrder.stock_reserved === false) {
        console.warn(`⚠️ Ordine ${orderId} non ha stock riservato, tentativo fallback riserva`)
        try {
          const { reserveOrderStock } = await import('@/lib/reserveOrderStock')
          await reserveOrderStock(orderId)
          console.log(`✅ Fallback riserva stock riuscito per ordine ${orderId}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
          console.error(`❌ Fallback riserva stock fallito per ordine ${orderId}:`, errorMessage)
          // Continua comunque con l'aggiornamento payment_status (non bloccare)
        }
      }

      // ✅ Aggiorna payment_status, status e stock_reserved/reserve_expires_at (NON toccare stock)
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed', 
          stripe_payment_intent_id: session.payment_intent ?? null,
          stripe_session_id: session.id,
          stock_reserved: false,  // Riserva temporanea scaduta: ordine pagato
          reserve_expires_at: null,  // Reset TTL
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending') // Guard aggiuntiva: aggiorna solo se ancora pending

      if (error) {
        console.error('❌ Errore aggiornamento ordine in Supabase:', {
          orderId,
          sessionId: session.id,
          error: error.message,
          details: error
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // NOTA: Non toccare stock qui - lo stock è già scalato alla creazione ordine
      // Solo aggiorniamo i flag di riserva temporanea (ora completata)
    }

    // Gestione checkout.session.expired, checkout.session.async_payment_failed, checkout.session.async_payment_succeeded
    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as any
      const orderId = session.metadata?.orderId

      if (!orderId) {
        console.error('⚠️ orderId mancante nella metadata Stripe session:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Verifica che l'ordine non sia già pagato e che lo stock sia committed
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('payment_status, stock_committed')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        console.error('❌ Errore lettura ordine:', orderError)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Rilascia stock solo se non pagato e stock committed
      if (order.payment_status !== 'paid' && order.stock_committed === true) {
        const releaseResult = await release_order_stock(orderId)
        if (releaseResult.ok) {
          console.log('✅ Stock rilasciato per ordine scaduto/fallito:', orderId)
        } else {
          console.error('❌ Errore rilascio stock:', releaseResult.error)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    console.error('❌ Errore interno webhook:', err.message, err)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

