import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Riserva stock per un ordine.
 * Thin wrapper: chiama solo la DB RPC public.reserve_order_stock(p_order_id).
 * Tutta la logica (order_items, lock, stock_unlimited, decrement, stock_committed) è nel DB.
 * route.ts gestisce stock_reserved / reserve_expires_at.
 *
 * Lancia Error se la RPC fallisce (fail-fast).
 */
export async function reserveOrderStock(orderId: string): Promise<void> {
    if (!orderId) {
        const msg = 'orderId mancante'
        console.error('❌ reserveOrderStock:', msg)
        throw new Error(msg)
    }

    const { error } = await supabaseServiceRole.rpc('reserve_order_stock', {
        order_id: orderId,
    })

    if (error) {
        console.error(`❌ reserveOrderStock: RPC errore ordine ${orderId}:`, error.message)
        throw new Error(error.message)
    }
}
