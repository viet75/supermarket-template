import { createClient } from '@supabase/supabase-js'

// Usa il service role per operazioni server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Nota: se le env mancano, fallisce in modo esplicito
const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null

// Scala lo stock per un ordine solo se non è già stato scalato.
export async function scaleStockForOrder(orderId: string) {
    if (!supabase) return { ok: false, error: 'Supabase non configurato (service role mancante)' }
    if (!orderId) return { ok: false, error: 'orderId mancante' }

    // Legge l'ordine con flag stock_scaled e gli articoli
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(
            `stock_scaled, order_items:order_items (product_id, quantity)`
        )
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return { ok: false, error: orderError?.message || 'Ordine non trovato' }
    }

    // Già scalato: idempotente
    if (order.stock_scaled) {
        return { ok: true, alreadyScaled: true }
    }

    const items = Array.isArray(order.order_items) ? order.order_items : []
    if (!items.length) {
        // Nessun item: marca comunque come scalato per evitare retry infiniti
        await supabase.from('orders').update({ stock_scaled: true }).eq('id', orderId)
        return { ok: true, alreadyScaled: false }
    }

    // Raccogli tutti i productIds validi
    const productIds = items
        .map(item => item.product_id)
        .filter((id): id is string => Boolean(id))

    if (productIds.length === 0) {
        await supabase.from('orders').update({ stock_scaled: true }).eq('id', orderId)
        return { ok: true, alreadyScaled: false }
    }

    // Precarica tutti i prodotti con una singola query
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, stock, unit_type, stock_unit')
        .in('id', productIds)

    if (productsError) {
        return { ok: false, error: `Errore caricamento prodotti: ${productsError.message}` }
    }

    // Crea una Map per accesso rapido ai prodotti
    const productsMap = new Map<string, any>()
    if (products) {
        for (const product of products) {
            productsMap.set(product.id, product)
        }
    }

    // Prepara gli aggiornamenti verificando lo stock disponibile
    const stockUpdates: Array<{ productId: string; newStock: number; productName: string }> = []

    for (const item of items) {
        const productId = item.product_id
        const quantity = Number(item.quantity) || 0
        if (!productId || quantity <= 0) continue

        const product = productsMap.get(productId)

        if (!product) {
            console.warn(`[scaleStockForOrder] Prodotto non trovato: ${productId}`)
            continue
        }
            

        const currentStock = Number(product.stock) || 0
        
        // Calcola la quantità da sottrarre in unità intere
        let qtyToSubtract: number
        if (product.unit_type === 'per_kg') {
            // per_kg: converti quantity (in kg) in unità usando stock_unit
            const stockUnit = Number(product.stock_unit) || 100
            qtyToSubtract = Math.round(quantity * (1000 / stockUnit))
        } else {
            // per_unit/piece: sottrai quantity normalmente
            qtyToSubtract = quantity
        }

        // Assicurati che qtyToSubtract sia sempre un intero
        qtyToSubtract = Math.round(qtyToSubtract)

        const newStock = currentStock - qtyToSubtract

        if (newStock < 0) {
            return { ok: false, error: `Stock insufficiente per il prodotto ${product.name}` }
        }

        stockUpdates.push({
            productId,
            newStock,
            productName: product.name,
        })
    }

    // Se non ci sono aggiornamenti (tutti i prodotti saltati), marca comunque come scalato
    if (stockUpdates.length === 0) {
        const { error: flagError } = await supabase
            .from('orders')
            .update({ stock_scaled: true })
            .eq('id', orderId)

        if (flagError) {
            return { ok: false, error: flagError.message }
        }

        return { ok: true, alreadyScaled: false }
    }

    // Esegue gli aggiornamenti sullo stock
    for (const update of stockUpdates) {
        const { error: updateError } = await supabase
            .from('products')
            .update({ stock: update.newStock })
            .eq('id', update.productId)

        if (updateError) {
            return { ok: false, error: `Errore aggiornamento stock per ${update.productName}: ${updateError.message}` }
        }
    }

    // Marca l'ordine come scalato
    const { error: flagError } = await supabase
        .from('orders')
        .update({ stock_scaled: true })
        .eq('id', orderId)

    if (flagError) {
        return { ok: false, error: flagError.message }
    }

    return { ok: true, alreadyScaled: false }
}
