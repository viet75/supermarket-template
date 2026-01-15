/**
 * @deprecated Questa funzione è deprecata e non modifica più products.stock.
 * Lo stock viene ora riservato alla creazione ordine tramite reserveOrderStock,
 * non più scalato al pagamento. Questa funzione è mantenuta solo per compatibilità
 * e ritorna sempre ok senza operazioni.
 * 
 * Per riservare stock: usare reserveOrderStock()
 * Per rilasciare stock: usare releaseOrderStock()
 */
export async function scaleStockForOrder(orderId: string) {
    if (!orderId) {
        return { ok: false, error: 'orderId mancante' }
    }

    console.warn(
        `[scaleStockForOrder] DEPRECATED: funzione chiamata per orderId ${orderId}. ` +
        `Lo stock non viene più scalato qui - è già riservato alla creazione ordine. ` +
        `Usare reserveOrderStock/releaseOrderStock invece.`
    )

    // No-op: ritorna sempre ok senza modificare stock
    return { ok: true, alreadyScaled: false }
}
