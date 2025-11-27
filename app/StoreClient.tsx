'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Product, Category } from '@/lib/types'
import CategoryChipsContainer from '@/components/CategoryChipsContainer'
import ProductsGrid from '@/components/ProductsGrid'

// 👉 Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ✅ Funzione di parsing sicuro
function safeParse<T>(val: any, fallback: T): T {
    try {
        if (!val) return fallback
        if (typeof val === "string") return JSON.parse(val)
        return val
    } catch {
        return fallback
    }
}

// ✅ Normalizza prodotto in arrivo dal realtime
function normalizeProduct(p: any): Product {
    return {
        ...p,
        images: safeParse(p.images, []),
    }
}

export default function StoreClient({
    products: initialProducts,
    categories,
}: {
    products: Product[]
    categories: Category[]
}) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    // ✅ Realtime: ascolta cambiamenti su `products`
    useEffect(() => {
        const channel = supabase
            .channel('products-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setProducts((prev) => {
                            const updated = [...prev, normalizeProduct(payload.new)]
                            return updated.sort(
                                (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
                            )
                        })
                    }

                    if (payload.eventType === 'UPDATE') {
                        setProducts((prev) => {
                            const updated = prev.map((p) =>
                                p.id === payload.new.id ? normalizeProduct(payload.new) : p
                            )
                            return updated.sort(
                                (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
                            )
                        })
                    }

                    if (payload.eventType === 'DELETE') {
                        setProducts((prev) =>
                            prev.filter((p) => p.id !== payload.old.id)
                        )
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // 🔎 Filtro live: attivi + categoria + testo
    const filteredProducts = useMemo(() => {
        let result = products.filter((p) => p.is_active)

        if (activeCategory) {
            result = result.filter((p) => p.category_id === activeCategory)
        }

        if (search.trim()) {
            result = result.filter((p) =>
                p.name.toLowerCase().includes(search.toLowerCase())
            )
        }

        return result
    }, [products, activeCategory, search])

    return (
        <div className="space-y-4">
            {/* Barra ricerca */}
            <div className="flex justify-center mt-6 mb-2 px-4">
                <div className="relative w-full max-w-2xl">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Cerca prodotto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Categorie */}
            <CategoryChipsContainer
                activeId={activeCategory}
                onChange={setActiveCategory}
            />

            {/* Prodotti filtrati */}
            {filteredProducts.length > 0 ? (
                <ProductsGrid products={filteredProducts} />
            ) : (
                <p className="text-center text-gray-500 mt-10">
                    Nessun prodotto trovato
                </p>
            )}
        </div>
    )
}
