import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Handles post-payment operations for a paid order.
 * NOTE: Stock is now reserved at order creation (reserveOrderStock), not at payment.
 * This function maintains only other post-paid logic.
 * - Reads the order from the database
 * - Exits if payment_status !== 'paid'
 * - Idempotent: can be called multiple times without side effects
 */
export async function handleOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId missing' }
    }

    const svc = supabaseServiceRole

    // Reads the order from the database
    const { data: order, error: orderError } = await svc
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Order not found' }
    }

    // Exits if payment_status !== 'paid'
    if (order.payment_status !== 'paid') {
        return { ok: true } // Not an error, simply do not process
    }

    // NOTE: Stock is already reserved at order creation (reserveOrderStock).
    // No need to scale stock here. This function is idempotent and can be called
    // multiple times without side effects.
    // For now, there is no other post-paid logic to handle.

    return { ok: true }
}

