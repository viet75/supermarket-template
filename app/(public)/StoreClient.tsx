'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, Category } from '@/lib/types'
import CategoryChipsContainer from '@/components/CategoryChipsContainer'
import ProductsGrid from '@/components/ProductsGrid'
import { useForegroundRefresh } from '@/lib/useForegroundRefresh'
import { useSmartStickyScroll } from '@/hooks/useSmartStickyScroll'
import { supabaseClient } from '@/lib/supabaseClient'
import type {
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from '@supabase/supabase-js'

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

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

  // ✅ Realtime: update products in-place (stock, qty_step, price, etc.) without refresh
  useEffect(() => {
    const sb = supabaseClient()

    const channel = sb
      .channel('rt-products-store')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload: RealtimePostgresChangesPayload<Product>) => {
          const row = payload.new
          if (!row || typeof row !== 'object' || !('id' in row) || row.id == null) return
          const rowId = String(row.id)

          // Treat product as visible only if it matches storefront rules
          const isActive = ('is_active' in row ? row.is_active : true) === true
          const isArchived = ('archived' in row ? row.archived : false) === true
          const isDeleted = 'deleted_at' in row && row.deleted_at != null

          const shouldBeVisible = isActive && !isArchived && !isDeleted

          setProducts((prev) => {
            const idx = prev.findIndex((p) => String(p.id) === rowId)

            // Remove if not visible anymore
            if (!shouldBeVisible) {
              if (idx === -1) return prev
              const next = [...prev]
              next.splice(idx, 1)
              return next
            }

            // Patch with numeric normalization for fields commonly returned as strings
            const existing = idx >= 0 ? prev[idx] : ({} as Product)
            const r = row as Product
            const patch: Product = {
              ...existing,
              ...r,
              id: rowId,
              price: parseNum(r.price) ?? existing.price ?? 0,
              price_sale: r.price_sale == null ? null : parseNum(r.price_sale),
              qty_step: r.qty_step == null ? null : parseNum(r.qty_step),
              stock: r.stock == null ? null : parseNum(r.stock),
              stock_baseline: r.stock_baseline == null ? null : parseNum(r.stock_baseline),
              stock_unit: r.stock_unit == null ? null : parseNum(r.stock_unit),
            }

            // If product is new to current state (rare), add it
            if (idx === -1) return [patch, ...prev]

            const next = [...prev]
            next[idx] = patch
            return next
          })
        }
      )
      .subscribe((_status: REALTIME_SUBSCRIBE_STATES, _err?: Error) => {
        // Typed for enterprise; no logging in production.
      })

    return () => {
      sb.removeChannel(channel)
    }
  }, [])

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

  // Scroll-to-top quando cambio categoria (mantiene UX attuale su search)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // reset immediato: evita animazioni strane e mantiene comportamento consistente
    el.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeCategory])

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
    relative
    sticky top-[var(--app-header-h,0px)] z-50
    bg-white/95 dark:bg-zinc-900/92
    supports-[backdrop-filter]:backdrop-blur-md
    border-b border-gray-200/70 dark:border-white/10
    shadow-sm
  "
      >
        {/* Search */}
        <div className="flex justify-center px-4 pt-4 pb-2">
          <div className="relative w-full max-w-2xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">
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
          bg-white dark:bg-zinc-900/60
          text-gray-900 dark:text-zinc-100
          placeholder:text-gray-400 dark:placeholder:text-zinc-500
          shadow-sm
          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500
        "
            />
          </div>
        </div>

        <div
          className={[
            'absolute left-0 right-0 top-full z-50',
            'px-4 pb-2',
            'bg-white/95 dark:bg-zinc-900/92',
            'supports-[backdrop-filter]:backdrop-blur-md',
            'border-b border-gray-200/70 dark:border-zinc-800/70',
            'transition-all duration-200 ease-out',
            showCategories
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none',
          ].join(' ')}
        >
          <CategoryChipsContainer
            activeId={activeCategory}
            onChange={setActiveCategory}
            show={true}
          />
        </div>
      </div>

      {/* Spacer fisso per non far coprire i prodotti dall'overlay categorie */}
      <div className="h-[56px] md:h-[60px]" />

      {/* Content */}
      <div className="px-1 sm:px-2 md:px-4 pb-24">
        {filteredProducts.length > 0 ? (
          <ProductsGrid products={filteredProducts} />
        ) : (
          <p className="text-center text-gray-500 dark:text-zinc-400 mt-10">
            Nessun prodotto trovato
          </p>
        )}
      </div>
    </>
  )
}