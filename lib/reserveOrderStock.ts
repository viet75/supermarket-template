import { supabaseService } from '@/lib/supabaseService'

/**
 * Riserva stock per un ordine (scala products.stock immediatamente).
 * Idempotente: se stock_reserved=true, ritorna ok senza operazioni.
 * Atomicità: usa RPC functions per evitare race conditions.
 */
export async function reserveOrderStock(
    orderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    const svc = supabaseService

    // Verifica se già riservato (idempotenza)
    const { data: order, error: orderError } = await svc
        .from('orders')
        .select('stock_reserved')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Ordine non trovato' }
    }

    if (order.stock_reserved === true) {
        return { ok: true } // Già riservato, idempotente
    }

    // Legge order_items con join products per ottenere name, stock, unit_type
    const { data: items, error: itemsError } = await svc
        .from('order_items')
        .select('quantity, product_id, products(id, name, stock, unit_type)')
        .eq('order_id', orderId)

    if (itemsError) {
        return { ok: false, error: `Errore caricamento order_items: ${itemsError.message}` }
    }

    if (!items || items.length === 0) {
        // Nessun item: marca comunque come riservato per idempotenza
        const { error: updateError } = await svc
            .from('orders')
            .update({ stock_reserved: true })
            .eq('id', orderId)
        if (updateError) {
            return { ok: false, error: updateError.message }
        }
        return { ok: true }
    }

    // Array per tracciare quali prodotti sono stati riservati (per rollback in caso di errore)
    const reservedProducts: Array<{ productId: string; qty: number }> = []

    // Riserva stock per ogni item usando RPC atomica
    for (const item of items) {
        const productId = item.product_id
        const rawQty = item.quantity
        const qty = Number(rawQty) || 0

        if (!productId || qty <= 0) {
            continue
        }

        // Normalizza product data (Supabase può restituire come oggetto o array)
        let productData = (item as any).products
        if (Array.isArray(productData)) {
            productData = productData[0] || null
        }

        if (!productData) {
            // Prodotto non trovato: rilascia eventuali riserve già fatte prima di ritornare errore
            await rollbackReservations(reservedProducts)
            return { ok: false, error: `Prodotto non trovato per product_id: ${productId}` }
        }

        const productName = productData.name || 'Prodotto sconosciuto'

        // Chiama RPC atomica per decrementare stock
        // Forza p_qty come stringa numeric "safe" per Supabase
        const qtyStr = (Number.isFinite(qty) ? qty : 0).toString()
        const { data: dbg, error: rpcError } = await svc.rpc('rpc_decrement_stock_debug', {
            p_product_id: productId,
            p_qty: qtyStr,
        })

        if (rpcError) {
            // Errore RPC: rilascia eventuali riserve già fatte
            await rollbackReservations(reservedProducts)
            return { ok: false, error: `Errore riserva stock per ${productName}: ${rpcError.message}` }
        }

        if (!dbg || dbg.updated !== true) {
            // Stock insufficiente: la RPC ritorna updated=false se non aggiorna righe
            await rollbackReservations(reservedProducts)
            return { ok: false, error: `Stock insufficiente per ${productName}` }
        }

        // Traccia prodotto riservato per eventuale rollback
        reservedProducts.push({ productId, qty })
    }

    // Se arriviamo qui, tutte le riserve sono andate a buon fine
    // Marca ordine come riservato
    const { error: updateError } = await svc
        .from('orders')
        .update({ stock_reserved: true })
        .eq('id', orderId)

    if (updateError) {
        // Errore aggiornamento flag: rilascia riserve (rollback)
        await rollbackReservations(reservedProducts)
        return { ok: false, error: `Errore aggiornamento flag stock_reserved: ${updateError.message}` }
    }

    return { ok: true }
}

/**
 * Helper per rollback: rilascia stock già riservato in caso di errore
 */
async function rollbackReservations(
    reservedProducts: Array<{ productId: string; qty: number }>
): Promise<void> {
    if (reservedProducts.length === 0) return

    const svc = supabaseService

    // Rilascia stock per ogni prodotto già riservato
    for (const { productId, qty } of reservedProducts) {
        await svc.rpc('rpc_increment_stock', {
            p_product_id: productId,
            p_qty: qty,
        })
        // Ignora errori di rollback (log ma non bloccare)
    }
}

