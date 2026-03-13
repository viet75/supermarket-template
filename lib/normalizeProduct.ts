// lib/normalizeProduct.ts

/**
 * Converts a value to a number if possible,
 * otherwise returns null.
 */
function numOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/**
 * Converts a value to a required number.
 * Throws an error if invalid.
 */
function mustNumber(v: unknown, field = 'number'): number {
    const n = Number(v)
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid ${field}`)
    }
    return n
}

/**
 * Normalizes a product taken from the DB
 * by forcing numeric fields to consistent values.
 */
export function normalizeProduct(p: any) {
    return {
        ...p,
        price: mustNumber(p.price, 'price'),
        price_sale: p.price_sale == null ? null : mustNumber(p.price_sale, 'price_sale'),
        stock: numOrNull(p.stock),
    }
}
