'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, Category } from '@/lib/types'
import CategoryChipsContainer from '@/components/CategoryChipsContainer'
import ProductsGrid from '@/components/ProductsGrid'
import { useForegroundRefresh } from '@/lib/useForegroundRefresh'
import { useSmartStickyScroll } from '@/hooks/useSmartStickyScroll'

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

  useEffect(() => {
    setProducts(initialProducts)
  }, [initialProducts])

  useForegroundRefresh(() => router.refresh(), 3000)

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.is_active === true)

    if (activeCategory) {
      result = result.filter((p) => p.category_id === activeCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }

    return result
  }, [products, activeCategory, search])

  const scrollRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    // prende lo scroll host creato dal layout pubblico
    scrollRef.current =
      (window as any).__PUBLIC_SCROLL_EL__ ??
      (document.getElementById('public-scroll-container') as HTMLElement | null)
  }, [])

  const showCategories = useSmartStickyScroll(scrollRef, {
    threshold: 20,
    revealAtTopPx: 24,
    cooldownMs: 240,
    minDeltaPx: 1,
  })

  return (
    <>
      {/* HEADER sticky (NO blur: elimina fascia trasparente) */}
      <div
        className="
    sticky top-[var(--app-header-h,0px)] z-50
    bg-white/95 dark:bg-gray-900/92
    supports-[backdrop-filter]:backdrop-blur-md
    border-b border-gray-200/70 dark:border-white/10
    shadow-sm
  "
      >
        {/* Search */}
        <div className="flex justify-center px-4 pt-4 pb-2">
          <div className="relative w-full max-w-2xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              🔍
            </span>
            <input
              type="text"
              placeholder="Cerca prodotto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
          w-full pl-10 pr-4 py-2 rounded-full
          border border-gray-300 dark:border-white/10
          bg-white dark:bg-gray-800/60
          text-gray-900 dark:text-gray-100
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          shadow-sm
          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500
        "
            />
          </div>
        </div>

        {/* Categorie (montate solo quando visibili: zero fascia residua) */}
        {showCategories && (
          <div className="px-4 pb-2">
            <CategoryChipsContainer activeId={activeCategory} onChange={setActiveCategory} show />
          </div>
        )}
      </div>


      {/* Content */}
      <div className="px-1 sm:px-2 md:px-4 pb-24">
        {filteredProducts.length > 0 ? (
          <ProductsGrid products={filteredProducts} />
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-10">
            Nessun prodotto trovato
          </p>
        )}
      </div>
    </>
  )
}
