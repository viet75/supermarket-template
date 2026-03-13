import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { release_order_stock } from '@/lib/releaseOrderStock'


export const runtime = 'nodejs'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const whsec = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !whsec) {
    console.error('❌ Webhook misconfigured.')
    return NextResponse.json({ error: 'Webhook misconfigured' }, { status: 400 })
  }

  const stripe = getStripe()
  let event

  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, whsec)
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any
      // ✅ Read orderId exclusively from session.metadata.orderId
      const orderId = session.metadata?.orderId

      // ✅ If orderId is missing, log and return 200 (never 500)
      if (!orderId) {
        console.error('⚠️ orderId missing in Stripe session metadata:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ IDEMPOTENZA: Check order status before updating
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('payment_status, stock_reserved')
        .eq('id', orderId)
        .single()

      if (fetchError || !existingOrder) {
        console.error('❌ Order read error in webhook:', fetchError)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ If already paid, return 200 without side-effects (idempotency)
      if (existingOrder.payment_status === 'paid') {
        console.log(`✅ Order ${orderId} already paid, idempotent webhook`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // ✅ Guard-rail: Se stock_reserved=false (caso anomalo), fallback con riserva
      // Questo protegge da race conditions o errori nella creazione ordine
      if (existingOrder.stock_reserved === false) {
        console.warn(`⚠️ Order ${orderId} has no reserved stock, fallback reservation attempt`)
        try {
          const { reserveOrderStock } = await import('@/lib/reserveOrderStock')
          await reserveOrderStock(orderId)
          console.log(`✅ Fallback stock reservation successful for order ${orderId}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`❌ Fallback stock reservation failed for order ${orderId}:`, errorMessage)
          // Continue with payment_status update (do not block)
        }
      }

      // ✅ Update payment_status, status and stock_reserved/reserve_expires_at (do not touch stock)
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed', 
          stripe_payment_intent_id: session.payment_intent ?? null,
          stripe_session_id: session.id,
          stock_reserved: false,  // Temporary reservation expired: order paid
          reserve_expires_at: null,  // Reset TTL
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending') // Additional guard: update only if still pending

      if (error) {
        console.error('❌ Order update error in Supabase:', {
          orderId,
          sessionId: session.id,
          error: error.message,
          details: error
        })
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // NOTE: Do not touch stock here - stock was scaled at order creation
      // We only update the temporary reservation flags (now completed)
    }

    // Gestione checkout.session.expired, checkout.session.async_payment_failed, checkout.session.async_payment_succeeded
    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as any
      const orderId = session.metadata?.orderId

      if (!orderId) {
        console.error('⚠️ orderId missing in Stripe session metadata:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Verify that the order is not already paid and that the stock is committed
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('payment_status, stock_committed')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        console.error('❌ Order read error:', orderError)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Release stock only if not paid and stock committed
      if (order.payment_status !== 'paid' && order.stock_committed === true) {
        const releaseResult = await release_order_stock(orderId)
        if (releaseResult.ok) {
          console.log('✅ Stock released for expired/failed order:', orderId)
        } else {
          console.error('❌ Stock release error:', releaseResult.error)
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    console.error('❌ Internal webhook error:', err.message, err)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}

