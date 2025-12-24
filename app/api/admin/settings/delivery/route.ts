import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import type { PaymentMethod } from '@/lib/types'

export const runtime = 'nodejs'

/* ===========================
   GET /api/admin/settings/delivery
   Ritorna le impostazioni di consegna
=========================== */
export async function GET() {
  try {
    const svc = supabaseServer()

    const { data, error } = await svc
      .from('store_settings')
      .select(
        `
        delivery_enabled,
        delivery_base_km,
        delivery_base_fee,
        delivery_extra_fee_per_km,
        delivery_max_km,
        payment_methods
        `
      )
      .limit(1)
      .single()

    if (error) throw error

    return NextResponse.json({ settings: data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Errore caricamento impostazioni consegna' },
      { status: 500 }
    )
  }
}

/* ===========================
   PUT /api/admin/settings/delivery
   Aggiorna le impostazioni di consegna
=========================== */
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const svc = supabaseServer()

    const update: Record<string, any> = {}

    if (typeof body.delivery_enabled === 'boolean') {
      update.delivery_enabled = body.delivery_enabled
    }

    if (typeof body.delivery_base_km !== 'undefined') {
      update.delivery_base_km = Number(body.delivery_base_km)
    }

    if (typeof body.delivery_base_fee !== 'undefined') {
      update.delivery_base_fee = Number(body.delivery_base_fee)
    }

    if (typeof body.delivery_extra_fee_per_km !== 'undefined') {
      update.delivery_extra_fee_per_km = Number(body.delivery_extra_fee_per_km)
    }

    if (typeof body.delivery_max_km !== 'undefined') {
      update.delivery_max_km = Number(body.delivery_max_km)
    }

    if (Array.isArray(body.payment_methods)) {
      // Validazione: payment_methods deve essere un array di stringhe valide
      const allowed: PaymentMethod[] = ['cash', 'card_online', 'pos_on_delivery']
      const isValidStringArray = body.payment_methods.every((m: any) => typeof m === 'string')
      if (isValidStringArray) {
        // Filtriamo solo i metodi validi
        update.payment_methods = body.payment_methods.filter((m: any): m is PaymentMethod =>
          allowed.includes(m as PaymentMethod)
        )
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo valido da aggiornare' },
        { status: 400 }
      )
    }

    update.updated_at = new Date().toISOString()

    // Aggiorna SEMPRE l’unica riga
    // Recupera l'id della riga
    const { data: settings, error: fetchError } = await svc
      .from('store_settings')
      .select('id')
      .limit(1)
      .single()

    if (fetchError || !settings) {
      throw new Error('Impossibile recuperare le impostazioni')
    }

    // Aggiorna usando l'id
    const { data, error } = await svc
      .from('store_settings')
      .update(update)
      .eq('id', settings.id)
      .select(
        `
        delivery_enabled,
        delivery_base_km,
        delivery_base_fee,
        delivery_extra_fee_per_km,
        delivery_max_km,
        payment_methods
        `
      )
      .single()

    if (error) throw error

    return NextResponse.json({ settings: data })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Errore salvataggio impostazioni consegna' },
      { status: 500 }
    )
  }
}
