import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Rilascia stock riservato per un ordine.
 * Thin wrapper: chiama solo la DB RPC public.release_order_stock(p_order_id).
 * Tutta la logica (order_items, increment, stock_committed, ecc.) è nel DB.
 * Idempotente: la RPC ritorna ok senza operazioni se già rilasciato.
 */
export async function release_order_stock(
    orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const { error } = await supabaseServiceRole.rpc('release_order_stock', {
        order_id: orderId,
    })

    if (error) {
        return { ok: false, error: error.message }
    }

    return { ok: true }
}
