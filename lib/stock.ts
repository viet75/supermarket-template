/**
 * Helper per gestire la visualizzazione dello stock con unità minime
 */

type Product = {
    stock?: number | null
    stock_unit?: number | null
    unit_type?: 'per_unit' | 'per_kg' | null
}

/**
 * Restituisce product.stock per la visualizzazione (già in unità corrette)
 * - per_kg: stock è già in kg reali (decimali)
 * - per_unit: stock è in pezzi (interi)
 */
export function toDisplayStock(product: Product): number | null {
    if (product.stock == null) return null
    
    const stock = Number(product.stock)
    if (!Number.isFinite(stock)) return null

    // Stock è già nella forma corretta: kg reali per per_kg, pezzi per per_unit
    return stock
}

/**
 * Normalizza lo stock per inserimento/aggiornamento in DB
 * - per_unit: intero >= 0 (truncate)
 * - per_kg: numero >= 0 con massimo 3 decimali (round a 3 decimali)
 * 
 * @throws Error se stock < 0 o non valido
 */
export function normalizeStock(unitType: 'per_unit' | 'per_kg' | null | undefined, rawStock: unknown): number | null {
    if (rawStock === null || rawStock === undefined || rawStock === '') {
        return null
    }

    const stock = Number(rawStock)
    if (!Number.isFinite(stock)) {
        throw new Error('Stock deve essere un numero valido')
    }

    if (stock < 0) {
        throw new Error('Stock non può essere negativo')
    }

    if (unitType === 'per_kg') {
        // per_kg: arrotonda a 3 decimali massimo (kg reali)
        return Math.round(stock * 1000) / 1000
    } else {
        // per_unit: tronca a intero
        return Math.trunc(stock)
    }
}

/**
 * Restituisce l'etichetta dell'unità ('kg' o 'pz')
 */
export function getUnitLabel(product: Product): string {
    return product.unit_type === 'per_kg' ? 'kg' : 'pz'
}

