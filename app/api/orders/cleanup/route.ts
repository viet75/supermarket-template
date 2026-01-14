import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredReservations } from '@/lib/cleanupExpiredReservations'

export const runtime = 'nodejs'

/**
 * POST /api/orders/cleanup?secret=...
 * Rilascia stock per ordini card_online scaduti (TTL).
 * Protezione: richiede CRON_SECRET in query param.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET non configurato' },
        { status: 500 }
      )
    }

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Supporta sia ritorno "number" che oggetto (per robustezza)
    const result: any = await cleanupExpiredReservations()
    const releasedCount =
      typeof result === 'number'
        ? result
        : (result?.releasedCount ?? result?.released ?? 0)

    return NextResponse.json({
      ok: true,
      released: releasedCount,
    })
  } catch (err: any) {
    console.error('[cleanup] Errore:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Errore interno' },
      { status: 500 }
    )
  }
}

/**
 * GET non consentito: endpoint pensato per essere chiamato solo da scheduler.
 */
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
