import { supabaseService } from '@/lib/supabaseService'

/**
 * Rilascia stock riservato per un ordine (incrementa products.stock).
 * Idempotente: se stock_reserved=false, ritorna ok senza operazioni.
 * Atomicità: usa RPC functions per evitare race conditions.
 */
export async function releaseOrderStock(
    orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const svc = supabaseService

    // Verifica se già rilasciato (idempotenza)
    const { data: order, error: orderError } = await svc
        .from('orders')
        .select('stock_reserved')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Ordine non trovato' }
    }

    if (order.stock_reserved === false) {
        return { ok: true } // Già rilasciato, idempotente
    }

    // Legge order_items per ottenere quantity e product_id
    const { data: items, error: itemsError } = await svc
        .from('order_items')
        .select('quantity, product_id')
        .eq('order_id', orderId)

    if (itemsError) {
        return { ok: false, error: `Errore caricamento order_items: ${itemsError.message}` }
    }

    if (!items || items.length === 0) {
        // Nessun item: marca comunque come rilasciato per idempotenza
        const { error: updateError } = await svc
            .from('orders')
            .update({ stock_reserved: false, reserve_expires_at: null })
            .eq('id', orderId)
        if (updateError) {
            return { ok: false, error: updateError.message }
        }
        return { ok: true }
    }

    // Rilascia stock per ogni item usando RPC atomica
    for (const item of items) {
        const productId = item.product_id
        const qty = Number(item.quantity) || 0

        if (!productId || qty <= 0) {
            continue
        }

        // Chiama RPC atomica per incrementare stock
        const { data: success, error: rpcError } = await svc.rpc('rpc_increment_stock', {
            p_product_id: productId,
            p_qty: qty,
        })

        if (rpcError) {
            // Log errore ma continua con gli altri prodotti
            console.error(`[releaseOrderStock] Errore rilascio stock per product_id ${productId}:`, rpcError)
            // Non bloccare: continua con gli altri prodotti
        }

        // success è boolean: true se update riuscito
        if (success !== true) {
            console.warn(`[releaseOrderStock] Prodotto non trovato o non aggiornato: ${productId}`)
            // Non bloccare: continua con gli altri prodotti
        }
    }

    // Marca ordine come rilasciato e resetta reserve_expires_at (anche se alcuni prodotti potrebbero non essere stati aggiornati)
    const { error: updateError } = await svc
        .from('orders')
        .update({ stock_reserved: false, reserve_expires_at: null })
        .eq('id', orderId)

    if (updateError) {
        return { ok: false, error: `Errore aggiornamento flag stock_reserved: ${updateError.message}` }
    }

    return { ok: true }
}

