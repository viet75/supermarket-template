'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartItem = {
    id: string
    name: string
    price: number
    salePrice?: number | null
    image?: string
    qty: number
    unit: 'per_unit' | 'per_kg'
    maxStock?: number | null
}

// 🔎 Helper per normalizzare quantità (accetta anche stringhe tipo "0,5")
function normalizeQty(v: any): number {
    if (v === null || v === undefined || v === '') return 0
    let s = typeof v === 'string' ? v.trim() : String(v)
    s = s.replace(',', '.')
    const n = Number(s)
    return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0
}

/** Prodotto minimo da API per reconcile (id, stock, stock_unlimited opzionale) */
export type ProductForReconcile = {
    id: string
    stock?: number | null
    stock_unlimited?: boolean | null
}

type CartState = {
    items: CartItem[]

    // helpers
    count: () => { pezzi: number; kg: number }
    total: () => number
    qtyOf: (id: string | number) => number

    // azioni
    addItem: (item: CartItem) => void
    updateQty: (id: string, qty: number) => void
    removeItem: (id: string, qty?: number) => void
    clear: () => void
    reconcileWithProducts: (products: ProductForReconcile[]) => void
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],

            // helpers
            count: () => {
                const items = get().items
                const pezzi = items
                    .filter((it) => it.unit === 'per_unit')
                    .reduce((acc, it) => acc + (Number(it.qty) || 0), 0)

                const kg = items
                    .filter((it) => it.unit === 'per_kg')
                    .reduce((acc, it) => acc + (Number(it.qty) || 0), 0)

                return { pezzi, kg }
            },

            total: () =>
                get().items.reduce((acc, it) => {
                    const price =
                        it.salePrice && it.salePrice < it.price ? it.salePrice : it.price
                    return acc + price * it.qty
                }, 0),

            qtyOf: (id) => get().items.find((i) => i.id === String(id))?.qty ?? 0,

            // azioni
            addItem: (incoming) =>
                set((s) => {
                    const q = normalizeQty(incoming.qty ?? 1)
                    const id = String(incoming.id)
                    const i = s.items.findIndex((it) => it.id === id)

                    const max =
                        typeof incoming.maxStock === 'number' && incoming.maxStock >= 0
                            ? incoming.maxStock
                            : null

                    if (i >= 0) {
                        const cur = s.items[i]
                        const target = cur.qty + q
                        const clamped = max === null ? target : Math.min(target, max)

                        const next = [...s.items]
                        next[i] = {
                            ...cur,
                            qty: clamped,
                            maxStock: max ?? cur.maxStock ?? null,
                            unit: incoming.unit ?? cur.unit ?? 'per_unit', // 👈 fix unit sempre valido
                        }
                        return { items: next }
                    }

                    const startQty = max === null ? q : Math.min(q, max)
                    return {
                        items: [
                            ...s.items,
                            {
                                ...incoming,
                                id,
                                qty: startQty,
                                maxStock: max,
                                unit: incoming.unit ?? 'per_unit', // 👈 fix unit sempre valido
                            },
                        ],
                    }
                }),

            updateQty: (id, qty) =>
                set((s) => {
                    const idx = s.items.findIndex((it) => it.id === String(id))
                    if (idx === -1) return s
                    const cur = s.items[idx]

                    const max =
                        typeof cur.maxStock === 'number' && cur.maxStock >= 0
                            ? cur.maxStock
                            : null
                    const clamped = Math.max(
                        0,
                        max === null ? normalizeQty(qty) : Math.min(normalizeQty(qty), max)
                    )

                    if (clamped === 0) {
                        return { items: s.items.filter((it) => it.id !== String(id)) }
                    }

                    const next = [...s.items]
                    next[idx] = { ...cur, qty: clamped }
                    return { items: next }
                }),

            removeItem: (id, qty = 1) =>
                set((s) => {
                    const idx = s.items.findIndex((it) => it.id === String(id))
                    if (idx === -1) return s

                    const cur = s.items[idx]
                    const newQty = cur.qty - qty

                    if (newQty > 0) {
                        const next = [...s.items]
                        next[idx] = { ...cur, qty: newQty }
                        return { items: next }
                    } else {
                        return { items: s.items.filter((it) => it.id !== String(id)) }
                    }
                }),

            clear: () => set({ items: [] }),

            reconcileWithProducts: (products) =>
                set((s) => {
                    const byId = new Map(products.map((p) => [String(p.id), p]))
                    const next: CartItem[] = []

                    for (const item of s.items) {
                        const prod = byId.get(String(item.id))
                        if (!prod) continue

                        const isUnlimited = prod.stock_unlimited === true || prod.stock == null
                        if (isUnlimited) {
                            next.push({ ...item, maxStock: null })
                            continue
                        }

                        const stock = Number(prod.stock)
                        if (!Number.isFinite(stock)) {
                            next.push({ ...item, maxStock: null })
                            continue
                        }
                        if (stock <= 0) continue

                        const qty = normalizeQty(item.qty)
                        const clamped = Math.min(qty, stock)
                        if (clamped <= 0) continue

                        next.push({
                            ...item,
                            qty: clamped,
                            maxStock: stock,
                        })
                    }

                    return { items: next }
                }),
        }),
        {
            name: 'cart',
            version: 4,
            migrate: (persistedState, version) => {
                if (persistedState && Array.isArray((persistedState as any).items)) {
                    (persistedState as any).items = (persistedState as any).items.map((it: any) => ({
                        ...it,
                        unit: it.unit ?? 'per_unit', // 👈 garantiamo sempre che esista
                    }))
                }
                return persistedState as any
            },
        }
    )
)
