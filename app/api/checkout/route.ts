import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { supabaseServiceRole } from '@/lib/supabaseService'

export const runtime = 'nodejs'

type FulfillmentPreview = {
  ok: boolean
  can_accept: boolean
  is_open_now: boolean
  after_cutoff: boolean
  next_fulfillment_date: string
  message: string
}

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
      return NextResponse.json(
        { error_code: 'invalid_request_body', error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { orderId, items } = body

    const pathname = new URL(req.url).pathname
    const locale = pathname.startsWith('/it') ? 'it' : 'en'

    const fallbackProductName = locale === 'it' ? 'Prodotto' : 'Product'
    const deliveryFeeLabel = locale === 'it' ? 'Spese di consegna' : 'Delivery fee'
    const pieceLabel = locale === 'it' ? 'pz' : 'pcs'

    if (!orderId || !items || items.length === 0) {
      return NextResponse.json(
        { error_code: 'missing_order_data', error: 'Missing order data' },
        { status: 400 }
      )
    }

    // ============================================================
    // 0) BLOCK CHECKOUT BEFORE ANY GOOGLE / STRIPE CALL
    // ============================================================

    const { data: preview, error: previewError } = await supabaseServiceRole.rpc(
      'get_fulfillment_preview'
    )

    if (previewError) {
      return NextResponse.json(
        {
          error_code: 'fulfillment_preview_failed',
          error: 'Fulfillment preview failed',
          details: previewError.message,
        },
        { status: 500 }
      )
    }

    const p = preview as FulfillmentPreview | null

    if (p && p.can_accept === false) {
      return NextResponse.json(
        {
          error_code: 'checkout_disabled',
          error: 'Checkout not available',
          message: p.message || 'Checkout not available',
          next_fulfillment_date: p.next_fulfillment_date ?? null,
          after_cutoff: p.after_cutoff ?? null,
          is_open_now: p.is_open_now ?? null,
        },
        { status: 409 }
      )
    }

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from('store_settings')
      .select('delivery_enabled')
      .limit(1)
      .single()

    if (settingsError) {
      return NextResponse.json(
        {
          error_code: 'settings_read_failed',
          error: 'Failed to read store settings',
          details: settingsError.message,
        },
        { status: 500 }
      )
    }

    if (settings?.delivery_enabled === false) {
      return NextResponse.json(
        {
          error_code: 'delivery_disabled',
          error: 'Delivery temporarily disabled',
        },
        { status: 409 }
      )
    }

    // ============================================================
    // 1) Retrieve order
    // ============================================================

    const { data: order, error: orderError } = await supabaseServiceRole
      .from('orders')
      .select('delivery_fee, total, address')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error_code: 'order_not_found', error: 'Order not found' },
        { status: 404 }
      )
    }

    const deliveryFee = Number(order.delivery_fee ?? 0)

    const orderAddress = order.address as { cap?: string; line1?: string; city?: string } | null
    const bodyAddress = body.address

    const line1 =
      bodyAddress?.line1 && bodyAddress.line1.trim()
        ? String(bodyAddress.line1).trim()
        : orderAddress?.line1
        ? String(orderAddress.line1).trim()
        : null

    const city =
      bodyAddress?.city && bodyAddress.city.trim()
        ? String(bodyAddress.city).trim()
        : orderAddress?.city
        ? String(orderAddress.city).trim()
        : null

    const zip =
      bodyAddress?.cap && bodyAddress.cap.trim()
        ? String(bodyAddress.cap).trim()
        : orderAddress?.cap
        ? String(orderAddress.cap).trim()
        : null

    if (!city || !zip) {
      return NextResponse.json(
        { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
        { status: 400 }
      )
    }

    if (!/^\d{5}$/.test(zip) || zip === '00000') {
      return NextResponse.json(
        { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
        { status: 400 }
      )
    }

    // ============================================================
    // 2) GOOGLE GEOCODE
    // ============================================================

    try {
      const query = line1 ? [line1, zip, city].filter(Boolean).join(', ') : [zip, city].join(', ')

      if (!query) {
        return NextResponse.json(
          { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
          { status: 400 }
        )
      }

      const url = new URL(req.url)
      const baseUrl = `${url.protocol}//${url.host}`

      const geocodeUrl =
        `${baseUrl}/api/geocode?q=${encodeURIComponent(query)}` +
        `&zip=${encodeURIComponent(zip)}` +
        `&city=${encodeURIComponent(city)}`

      const geocodeRes = await fetch(geocodeUrl)

      let geocodeData: any = null

      try {
        const text = await geocodeRes.text()
        geocodeData = JSON.parse(text)
      } catch {
        return NextResponse.json(
          { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
          { status: 400 }
        )
      }

      if (!geocodeData.ok) {
        return NextResponse.json(
          { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error_code: 'invalid_zip', error: 'Invalid ZIP code or address not found' },
        { status: 400 }
      )
    }

    if (bodyAddress && (bodyAddress.line1 || bodyAddress.city || bodyAddress.cap)) {
      try {
        const mergedAddress = {
          ...(orderAddress || {}),
          ...(line1 ? { line1 } : {}),
          ...(city ? { city } : {}),
          ...(zip ? { cap: zip } : {}),
        }

        await supabaseServiceRole.from('orders').update({ address: mergedAddress }).eq('id', orderId)
      } catch (updateError) {
        console.error('Errore aggiornamento indirizzo:', updateError)

        return NextResponse.json(
          { error_code: 'address_update_failed', error: 'Failed to update address' },
          { status: 500 }
        )
      }
    }

    const url = new URL(req.url)
    const siteUrl = `${url.protocol}//${url.host}`

    const line_items = items.map((it) => {
      const price = parseFloat(String(it.price).replace(',', '.')) || 0
      const qRaw = parseFloat(String(it.quantity ?? 1).replace(',', '.'))
      const quantity = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1

      if (it.unit === 'per_kg') {
        const qty3 = Math.round((quantity + Number.EPSILON) * 1000) / 1000
        const isEttiExact =
          Number.isInteger(Math.round(qty3 * 10)) &&
          Math.abs(qty3 * 10 - Math.round(qty3 * 10)) < 1e-9
        const ettoCount = Math.round(qty3 * 10)

        const labelQty =
          locale === 'it'
            ? isEttiExact
              ? `${ettoCount} etti`
              : `${qty3} kg`
            : `${qty3} kg`

        return {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(price * qty3 * 100),
            product_data: {
              name: `${it.name ?? fallbackProductName} (${labelQty})`,
              ...(it.image_url ? { images: [it.image_url] } : {}),
            },
          },
        }
      }

      const qtyInt = Math.max(1, Math.round(quantity))

      return {
        quantity: qtyInt,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(price * 100),
          product_data: {
            name: `${it.name ?? fallbackProductName} (${qtyInt} ${pieceLabel})`,
            ...(it.image_url ? { images: [it.image_url] } : {}),
          },
        },
      }
    })

    if (deliveryFee > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(deliveryFee * 100),
          product_data: {
            name: deliveryFeeLabel,
          },
        },
      })
    }

    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${siteUrl}/${locale}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/${locale}/checkout?cancelled=1&id=${orderId}`,
      metadata: { orderId },
    })

    ;(async () => {
      try {
        await supabaseServiceRole
          .from('orders')
          .update({
            stripe_session_id: session.id,
          })
          .eq('id', orderId)
      } catch {}
    })()

    return NextResponse.json({ url: session.url, id: session.id })
  } catch (err: any) {
    return NextResponse.json(
      {
        error_code: 'stripe_session_creation_failed',
        error: err?.message ?? 'Failed to create payment session',
      },
      { status: 500 }
    )
  }
}