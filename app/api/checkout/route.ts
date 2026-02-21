
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
      return NextResponse.json({ error: 'Corpo richiesta non valido' }, { status: 400 })
    }

    const { orderId, items } = body
    if (!orderId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Dati ordine mancanti' }, { status: 400 })
    }

    // ============================================================
    // 0) BLOCCO CHECKOUT PRIMA DI QUALSIASI CHIAMATA GOOGLE / STRIPE
    // ============================================================
    const { data: preview, error: previewError } = await supabaseServiceRole.rpc(
      'get_fulfillment_preview'
    )

    if (previewError) {
      return NextResponse.json(
        { error: 'FULFILLMENT_PREVIEW_FAILED', details: previewError.message },
        { status: 500 }
      )
    }

    const p = preview as FulfillmentPreview | null
    if (p && p.can_accept === false) {
      return NextResponse.json(
        {
          code: 'CHECKOUT_DISABLED',
          message: p.message || 'Checkout non disponibile in questo momento.',
          next_fulfillment_date: p.next_fulfillment_date ?? null,
          after_cutoff: p.after_cutoff ?? null,
          is_open_now: p.is_open_now ?? null,
        },
        { status: 409 }
      )
    }

    // Check delivery_enabled (prima di Google/Stripe)
    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from('store_settings')
      .select('delivery_enabled')
      .limit(1)
      .single()

    if (settingsError) {
      return NextResponse.json(
        { error: 'SETTINGS_READ_FAILED', details: settingsError.message },
        { status: 500 }
      )
    }

    if (settings?.delivery_enabled === false) {
      return NextResponse.json(
        { code: 'DELIVERY_DISABLED', message: 'Le consegne sono temporaneamente disabilitate' },
        { status: 409 }
      )
    }

    // ============================================================
    // 1) Recupera ordine (delivery_fee + address)
    // ============================================================
    const { data: order, error: orderError } = await supabaseServiceRole
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

    // Se city/zip mancanti -> 400 (non creare sessione Stripe)
    if (!city || !zip) {
      return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
    }

    // Valida formato CAP
    if (!/^\d{5}$/.test(zip) || zip === '00000') {
      return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
    }

    // ============================================================
    // 2) GOOGLE GEOCODE SOLO DOPO I BLOCCANTI (preview + delivery)
    // ============================================================
    try {
      // Costruisci query indirizzo (solo line1 se disponibile, altrimenti usa zip+city)
      const query = line1 ? [line1, zip, city].filter(Boolean).join(', ') : [zip, city].join(', ')

      if (!query) {
        return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
      }

      // Deriva baseUrl da req.url invece di usare localhost hardcoded
      const url = new URL(req.url)
      const baseUrl = `${url.protocol}//${url.host}`
      const geocodeUrl =
        `${baseUrl}/api/geocode?q=${encodeURIComponent(query)}` +
        `&zip=${encodeURIComponent(zip)}` +
        `&city=${encodeURIComponent(city)}`

      const geocodeRes = await fetch(geocodeUrl)

      // Gestione sicura del parsing JSON
      let geocodeData: any = null
      try {
        const text = await geocodeRes.text()
        geocodeData = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
      }

      if (!geocodeData.ok) {
        return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'CAP non valido o indirizzo non trovato' }, { status: 400 })
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

        await supabaseServiceRole.from('orders').update({ address: mergedAddress }).eq('id', orderId)
      } catch (updateError) {
        console.error('Errore aggiornamento indirizzo:', updateError)
        return NextResponse.json({ error: 'Errore aggiornamento indirizzo' }, { status: 500 })
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
    ;(async () => {
      try {
        await supabaseServiceRole
          .from('orders')
          .update({
            stripe_session_id: session.id,
          })
          .eq('id', orderId)
      } catch {
        /* ignore */
      }
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