'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, Category } from '@/lib/types'
import CategoryChipsContainer from '@/components/CategoryChipsContainer'
import ProductsGrid from '@/components/ProductsGrid'
import { useForegroundRefresh } from '@/lib/useForegroundRefresh'

export default function StoreClient({
    products: initialProducts,
    categories,
}: {
    products: Product[]
    categories: Category[]
}) {
    const router = useRouter()
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    // ✅ Sincronizza lo stato quando initialProducts cambia
    useEffect(() => {
        setProducts(initialProducts)
    }, [initialProducts])

    // ✅ Foreground refresh: ricarica prodotti quando l'app torna visibile (no realtime)
    useForegroundRefresh(() => router.refresh(), 3000)

    // 🔎 Filtro live
    const filteredProducts = useMemo(() => {
        // Filtra solo prodotti attivi
        let result = products.filter((p) => p.is_active === true)

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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Cerca prodotto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
                    Nessun prodotto trovato
                </p>
            )}
        </div>
    )
}
