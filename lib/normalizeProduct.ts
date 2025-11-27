// lib/normalizeProduct.ts

/**
 * Converte un valore in numero se possibile,
 * altrimenti ritorna null.
 */
function numOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/**
 * Converte un valore in numero obbligatorio.
 * Lancia un errore se non valido.
 */
function mustNumber(v: unknown, field = 'number'): number {
    const n = Number(v)
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid ${field}`)
    }
    return n
}

/**
 * Normalizza un prodotto preso dal DB
 * forzando i campi numerici in valori consistenti.
 */
export function normalizeProduct(p: any) {
    return {
        ...p,
        price: mustNumber(p.price, 'price'),
        price_sale: p.price_sale == null ? null : mustNumber(p.price_sale, 'price_sale'),
        stock: numOrNull(p.stock),
    }
}
