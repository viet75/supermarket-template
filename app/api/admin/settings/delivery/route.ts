import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import type { PaymentMethod } from '@/lib/types'

export const runtime = 'nodejs'

const DEFAULT_WEEKLY_HOURS = {
  mon: [{ start: '09:00', end: '19:30' }],
  tue: [{ start: '09:00', end: '19:30' }],
  wed: [{ start: '09:00', end: '19:30' }],
  thu: [{ start: '09:00', end: '19:30' }],
  fri: [{ start: '09:00', end: '19:30' }],
  sat: [{ start: '09:00', end: '13:00' }],
  sun: [],
}

/** Normalizza riga store_settings per risposta coerente (null -> default, jsonb validi). */
function normalizeSettings(row: Record<string, unknown> | null): Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return {
      delivery_enabled: true,
      delivery_base_km: null,
      delivery_base_fee: 0,
      delivery_extra_fee_per_km: 0.5,
      delivery_max_km: null,
      payment_methods: ['cash', 'pos_on_delivery', 'card_online'],
      cutoff_time: '19:00',
      accept_orders_when_closed: true,
      timezone: 'Europe/Rome',
      preparation_days: 0,
      closed_dates: [],
      closed_ranges: [],
      weekly_hours: DEFAULT_WEEKLY_HOURS,
      closed_message: null,
    }
  }
  const s = row as Record<string, unknown>
  let weeklyHours = s.weekly_hours
  if (weeklyHours == null || typeof weeklyHours !== 'object') {
    weeklyHours = DEFAULT_WEEKLY_HOURS
  }
  return {
    ...s,
    cutoff_time: s.cutoff_time ?? '19:00',
    accept_orders_when_closed: s.accept_orders_when_closed ?? true,
    timezone: s.timezone ?? 'Europe/Rome',
    preparation_days: s.preparation_days ?? 0,
    closed_dates: Array.isArray(s.closed_dates) ? s.closed_dates : [],
    closed_ranges: Array.isArray(s.closed_ranges) ? s.closed_ranges : [],
    weekly_hours: weeklyHours,
    closed_message: typeof s.closed_message === 'string' ? s.closed_message : null,
  }
}

/* ===========================
   GET /api/admin/settings/delivery
   Ritorna le impostazioni di consegna. Fallback sicuro se DB/query fallisce.
=========================== */
export async function GET() {
  try {
    const svc = supabaseServer()
    const { data, error } = await svc
      .from('store_settings')
      .select(
        'delivery_enabled, delivery_base_km, delivery_base_fee, delivery_extra_fee_per_km, delivery_max_km, payment_methods, cutoff_time, accept_orders_when_closed, timezone, preparation_days, closed_dates, closed_ranges, weekly_hours, closed_message'
      )
      .eq('singleton_key', true)
      .maybeSingle()

    if (error) {
      console.error('[GET /api/admin/settings/delivery] Supabase error:', error.message)
      return NextResponse.json({
        settings: normalizeSettings(null),
        _fallback: true,
        _error: error.message,
      })
    }

    const settings = normalizeSettings(data as Record<string, unknown> | null)
    return NextResponse.json({ settings })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Errore caricamento impostazioni consegna'
    console.error('[GET /api/admin/settings/delivery]', message, e)
    return NextResponse.json({
      settings: normalizeSettings(null),
      _fallback: true,
      _error: message,
    })
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

    if (typeof body.cutoff_time === 'string') {
      update.cutoff_time = body.cutoff_time.trim() || null
    }
    if (typeof body.accept_orders_when_closed === 'boolean') {
      update.accept_orders_when_closed = body.accept_orders_when_closed
    }
    if (typeof body.timezone === 'string') {
      update.timezone = body.timezone.trim() || 'Europe/Rome'
    }
    if (typeof body.preparation_days === 'number' && Number.isInteger(body.preparation_days) && body.preparation_days >= 0) {
      update.preparation_days = body.preparation_days
    }
    if (Array.isArray(body.closed_dates)) {
      update.closed_dates = body.closed_dates
    }
    if (body.weekly_hours !== undefined && (body.weekly_hours === null || typeof body.weekly_hours === 'object')) {
      update.weekly_hours = body.weekly_hours
    }
    if (typeof body.closed_message === 'string') {
      update.closed_message = body.closed_message.trim() || null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo valido da aggiornare' },
        { status: 400 }
      )
    }

    update.updated_at = new Date().toISOString()
    const { data, error } = await svc
      .from('store_settings')
      .upsert(
        { singleton_key: true, ...update },
        { onConflict: 'singleton_key' }
      )
      .select(
        `
        delivery_enabled,
        delivery_base_km,
        delivery_base_fee,
        delivery_extra_fee_per_km,
        delivery_max_km,
        payment_methods,
        cutoff_time,
        accept_orders_when_closed,
        timezone,
        preparation_days,
        closed_dates,
        closed_ranges,
        weekly_hours,
        closed_message
        `
      )
      .single()

    if (error) {
      console.error('[PUT /api/admin/settings/delivery] Supabase upsert error', error)
      throw error
    }
    if (!data) {
      throw new Error('Nessuna riga aggiornata')
    }

    const normalized = normalizeSettings(data as Record<string, unknown>)
    return NextResponse.json({ settings: normalized })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Errore salvataggio impostazioni consegna' },
      { status: 500 }
    )
  }
}
