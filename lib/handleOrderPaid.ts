import { supabaseServiceRole } from '@/lib/supabaseService'

/**
 * Gestisce le operazioni post-pagamento per un ordine pagato.
 * NOTA: Lo stock viene ora riservato alla creazione ordine (reserveOrderStock),
 * non più al pagamento. Questa funzione mantiene solo le altre logiche post-paid.
 * - Legge l'ordine dal database
 * - Esce se payment_status !== 'paid'
 * - Idempotente: può essere chiamata più volte senza effetti collaterali
 */
export async function handleOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const svc = supabaseServiceRole

    // Legge l'ordine dal database
    const { data: order, error: orderError } = await svc
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Ordine non trovato' }
    }

    // Esce se payment_status !== 'paid'
    if (order.payment_status !== 'paid') {
        return { ok: true } // Non è un errore, semplicemente non serve processare
    }

    // NOTA: Lo stock è già stato riservato alla creazione ordine (reserveOrderStock).
    // Non serve più scalare stock qui. Questa funzione è idempotente e può essere chiamata
    // più volte senza effetti collaterali.
    // Per ora non ci sono altre logiche post-paid da gestire.

    return { ok: true }
}

