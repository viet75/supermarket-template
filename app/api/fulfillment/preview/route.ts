import { NextResponse } from 'next/server'
import { supabaseServiceRole } from '@/lib/supabaseService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET: preview evasione (orari, cutoff, chiusure). Public, no auth. */
export async function GET() {
    try {
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

        let message: string = preview.message ?? ''
        if (!!preview.can_accept === false) {
            const { data: settingsRow } = await supabaseServiceRole
                .from('store_settings')
                .select('closed_message')
                .eq('singleton_key', true)
                .maybeSingle()
            const closedMsg = settingsRow?.closed_message
            if (typeof closedMsg === 'string' && closedMsg.trim()) {
                message = `${closedMsg.trim()}. Ordini non accettati in questo momento.`
            } else {
                message = message || 'Negozio chiuso. Ordini non accettati in questo momento.'
            }
        }

        return NextResponse.json(
            {
                ok: true,
                can_accept: !!preview.can_accept,
                is_open_now: !!preview.is_open_now,
                after_cutoff: !!preview.after_cutoff,
                next_fulfillment_date: preview.next_fulfillment_date ?? null,
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
