import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredReservations } from '@/lib/cleanupExpiredReservations'

export const runtime = 'nodejs'

/**
 * POST /api/orders/cleanup?secret=...
 * Releases stock for expired card_online orders (TTL).
 * Protection: requires CRON_SECRET in query param.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Supports both "number" return and object (for robustness)
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
    console.error('[cleanup] Error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * GET not allowed: endpoint intended to be called only by scheduler.
 */
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
