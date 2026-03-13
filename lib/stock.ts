/**
 * Helper to handle stock display with minimum units.
 * 
 * NOTE: This file does not handle stock reservation.
 * Stock reservation is handled completely in the database via the RPC reserveOrderStock.
 * These functions are only for display and normalization UI/admin.
 */

type Product = {
    stock?: number | null
    stock_unit?: number | null
    unit_type?: 'per_unit' | 'per_kg' | null
}

/**
 * Returns product.stock for display (already in correct units)
 * - per_kg: stock is already in real kg (decimal)
 * - per_unit: stock is in pieces (integers)
 */
export function toDisplayStock(product: Product): number | null {
    if (product.stock == null) return null

    const stock = Number(product.stock)
    if (!Number.isFinite(stock)) return null

    // Stock is already in the correct form: real kg for per_kg, pieces for per_unit
    return stock
}

/**
 * Normalizes stock for insertion/update in DB
 * - per_unit: integer >= 0 (truncate)
 * - per_kg: number >= 0 with maximum 3 decimal places (round to 3 decimal places)
 * 
 * @throws Error if stock < 0 or invalid
 */
export function normalizeStock(unitType: 'per_unit' | 'per_kg' | null | undefined, rawStock: unknown): number | null {
    if (rawStock === null || rawStock === undefined || rawStock === '') {
        return null
    }

    const stock = Number(rawStock)
    if (!Number.isFinite(stock)) {
        throw new Error('Stock must be a valid number')
    }

    if (stock < 0) {
        throw new Error('Stock cannot be negative')
    }

    if (unitType === 'per_kg') {
        // per_kg: round to maximum 3 decimal places (real kg)
        return Math.round((stock + Number.EPSILON) * 1000) / 1000
    } else {
        // per_unit: truncate to integer
        return Math.trunc(stock)
    }
}

/**
 * Returns the unit label ('kg' or 'pz')
 */
export function getUnitLabel(
    product: Product,
    locale: string = 'it'
): string {
    if (product.unit_type === 'per_kg') {
        return 'kg'
    }

    return locale === 'en' ? 'pcs' : 'pz'
}

