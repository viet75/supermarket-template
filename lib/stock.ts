/**
 * Helper per gestire la visualizzazione dello stock con unità minime
 */

type Product = {
    stock?: number | null
    stock_unit?: number | null
    unit_type?: 'per_unit' | 'per_kg' | null
}

/**
 * Converte product.stock (unità interne) in valore umano per la visualizzazione
 * - per_kg: stock / (1000 / stock_unit) = stock / 10 (se stock_unit = 100)
 * - per_unit: stock invariato
 */
export function toDisplayStock(product: Product): number | null {
    if (product.stock == null) return null
    
    const stock = Number(product.stock)
    if (!Number.isFinite(stock)) return null

    if (product.unit_type === 'per_kg') {
        const stockUnit = Number(product.stock_unit) || 100
        // Converti da unità interne a kg: stock / (1000 / stock_unit)
        return stock / (1000 / stockUnit)
    }
    
    // per_unit: stock rimane invariato (già in pezzi)
    return stock
}

/**
 * Restituisce l'etichetta dell'unità ('kg' o 'pz')
 */
export function getUnitLabel(product: Product): string {
    return product.unit_type === 'per_kg' ? 'kg' : 'pz'
}

