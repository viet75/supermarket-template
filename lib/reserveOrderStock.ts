import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Reserves stock for an order.
 * Thin wrapper: calls only the DB RPC public.reserve_order_stock(p_order_id).
 * All logic (order_items, lock, stock_unlimited, decrement, stock_committed) is in the DB.
 * route.ts handles stock_reserved / reserve_expires_at.
 *
 * Throws an error if the RPC fails (fail-fast).
 */
export async function reserveOrderStock(orderId: string): Promise<void> {
    if (!orderId) {
        const msg = 'orderId missing'
        console.error('❌ reserveOrderStock:', msg)
        throw new Error(msg)
    }

    const { error } = await supabaseServiceRole.rpc('reserve_order_stock', {
        order_id: orderId,
    })

    if (error) {
        console.error(`❌ reserveOrderStock: RPC error for order ${orderId}:`, error.message)
        throw new Error(error.message)
    }
}
