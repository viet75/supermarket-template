import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredReservations } from '@/lib/cleanupExpiredReservations'

export const runtime = 'nodejs'

/**
 * GET /api/orders/cleanup
 * Rilascia stock per ordini card_online scaduti.
 * Protezione: richiede secret in query param.
 */
export async function GET(req: NextRequest) {
    try {
        // Protezione con secret
        const { searchParams } = new URL(req.url)
        const secret = searchParams.get('secret')
        const expectedSecret = process.env.CRON_SECRET

        if (!expectedSecret) {
            console.error('[cleanup] CRON_SECRET non configurato')
            return NextResponse.json(
                { error: 'Configurazione mancante' },
                { status: 500 }
            )
        }

        if (secret !== expectedSecret) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Esegue cleanup
        const releasedCount = await cleanupExpiredReservations()

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

