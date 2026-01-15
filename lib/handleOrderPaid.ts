import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Gestisce le operazioni post-pagamento per un ordine pagato.
 * NOTA: Lo stock viene ora riservato alla creazione ordine (reserveOrderStock),
 * non più al pagamento. Questa funzione mantiene solo le altre logiche post-paid.
 * - Legge l'ordine dal database
 * - Esce se payment_status !== 'paid'
 * - Mantiene flag stock_scaled per compatibilità (se necessario)
 */
export async function handleOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const svc = supabaseServiceRole

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
        return { ok: true } // Non è un errore, semplicemente non serve processare
    }

    // Esce se stock_scaled === true (idempotenza per altre logiche post-paid)
    if (order.stock_scaled === true) {
        return { ok: true } // Già processato, idempotente
    }

    // NOTA: Lo stock è già stato riservato alla creazione ordine (reserveOrderStock).
    // Non serve più scalare stock qui. Manteniamo solo altre logiche post-paid se necessario.
    // Per ora, marcare come processato per idempotenza.
    const { error: updateError } = await svc
        .from('orders')
        .update({ stock_scaled: true })
        .eq('id', orderId)

    if (updateError) {
        return { ok: false, error: updateError.message }
    }

    return { ok: true }
}

