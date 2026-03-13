import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Releases reserved stock for an order.
 * Thin wrapper: calls only the DB RPC public.release_order_stock(p_order_id).
 * All logic (order_items, increment, stock_committed, etc.) is in the DB.
 * Idempotent: the RPC returns ok without operations if already released.
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
