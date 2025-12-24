import { supabaseService } from '@/lib/supabaseService'
import { scaleStockForOrder } from '@/lib/scaleStockForOrder'

/**
 * Gestisce lo scalaggio stock per un ordine pagato.
 * - Legge l'ordine dal database
 * - Esce se payment_status !== 'paid'
 * - Esce se stock_scaled === true
 * - Chiama scaleStockForOrder(orderId)
 */
export async function handleOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const svc = supabaseService


    // Legge l'ordine dal database
    const { data: order, error: orderError } = await svc
        .from('orders')
        .select('payment_status, stock_scaled')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Ordine non trovato' }
    }

    // Esce se payment_status !== 'paid'
    if (order.payment_status !== 'paid') {
        return { ok: true } // Non è un errore, semplicemente non serve scalare
    }

    // Esce se stock_scaled === true
    if (order.stock_scaled === true) {
        return { ok: true } // Già scalato, idempotente
    }

    // Chiama scaleStockForOrder(orderId)
    const scaleResult = await scaleStockForOrder(orderId)

    if (scaleResult && !scaleResult.ok) {
        return { ok: false, error: scaleResult.error || 'Errore scalaggio stock' }
    }

    return { ok: true }
}

