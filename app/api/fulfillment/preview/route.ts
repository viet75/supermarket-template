import { NextResponse } from 'next/server'
import { supabaseServiceRole } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET: preview evasione (orari, cutoff, chiusure). Public, no auth. */
export async function GET() {
  try {
    // 1) Carica settings: qui decidiamo la priorità "delivery disabled"
    const { data: settings, error: settingsErr } = await supabaseServiceRole
      .from('store_settings')
      .select('delivery_enabled')
      .limit(1)
      .maybeSingle()

    if (settingsErr) {
      console.error('❌ load store_settings error:', settingsErr.message)
      return NextResponse.json(
        { ok: false, error: settingsErr.message ?? 'Errore lettura impostazioni' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // ✅ Priorità assoluta: se consegna disabilitata => blocca e NON chiamare la RPC orari
    if (settings?.delivery_enabled !== true) {
      return NextResponse.json(
        {
          ok: true,
          can_accept: false,
          is_open_now: false,
          after_cutoff: false,
          next_fulfillment_date: null,
          message: 'Le consegne sono temporaneamente disabilitate',
          code: 'DELIVERY_DISABLED',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // 2) Se consegna abilitata => usa la single source of truth: RPC
    const { data, error } = await supabaseServiceRole.rpc('get_fulfillment_preview')
    const preview = (Array.isArray(data) ? data[0] : data) ?? null

    if (error) {
      console.error('❌ get_fulfillment_preview RPC error:', error.message)
      return NextResponse.json(
        { ok: false, error: error.message ?? 'Errore preview evasione' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    if (!preview) {
      return NextResponse.json(
        { ok: false, error: 'Preview evasione non disponibile' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const can_accept = preview?.can_accept !== false
    let message = (preview?.message ?? '').trim()

    if (!can_accept && !message) {
      message = 'Negozio chiuso. Ordini non accettati in questo momento.'
    }

    return NextResponse.json(
      {
        ok: true,
        can_accept,
        is_open_now: !!preview?.is_open_now,
        after_cutoff: !!preview?.after_cutoff,
        next_fulfillment_date: preview?.next_fulfillment_date ?? null,
        message,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('❌ fulfillment preview error:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Errore preview evasione' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}