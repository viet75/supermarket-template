'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'
import { formatPrice } from '@/lib/pricing'
import { vtNavigate } from '@/lib/viewTransition'
import AddToCartControls from '@/components/AddToCartControls'
import StockIndicator from '@/components/StockIndicator'

type Product = {
  id: string | number
  name: string
  description?: string | null
  price: number | string
  price_sale?: number | string | null
  image_url?: string | null
  images?: any[] | null
  stock?: number | string | null
  stock_unit?: number | null
  unit_type?: 'per_unit' | 'per_kg' | null
  slug?: string | null
}

function ProductCard({ p, onAdded }: { p: Product; onAdded?: (name: string) => void }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const base = useMemo(() => Number(p?.price ?? 0), [p?.price])
  const sale = useMemo(() => (p?.price_sale != null ? Number(p.price_sale) : null), [p?.price_sale])
  const effective = sale != null && !Number.isNaN(sale) && sale > 0 ? sale : base

  const img = useMemo(() => {
    // 1) immagine caricata dall'admin via Supabase Storage
    if (p?.image_url?.trim()) return p.image_url.trim()

    // 2) prima immagine dell'array (se usi images[])
    const first = Array.isArray(p?.images) ? p.images[0] : null
    if (typeof first === 'string' && first.trim()) return first.trim()
    if (typeof first === 'object' && first && 'url' in (first as any)) {
      const url = (first as any).url
      if (url?.trim()) return url.trim()
    }

    // 3) immagine demo statica dal campo "image"
    if ((p as any).image?.trim()) return (p as any).image.trim()

    // 4) fallback al placeholder locale
    return '/placeholder-product.png'
  }, [p?.image_url, p?.images, (p as any)?.image])

  const stockNum = toDisplayStock(p as any)
  const stockColorClass = useMemo(() => {
    if (stockNum === null) return 'text-gray-500 dark:text-gray-400'
    if (stockNum === 0) return 'text-red-600 dark:text-red-400'
    if (stockNum <= 3) return 'text-orange-600 dark:text-orange-400'
    if (stockNum <= 10) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }, [stockNum])
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0

  const productKey = p.slug?.trim() ? p.slug.trim() : String(p.id)
  const href = useMemo(() => `/product/${encodeURIComponent(productKey)}`, [productKey])
  const goToDetail = useCallback(() => {
    vtNavigate(() => router.push(href))
  }, [router, href])

  if (!mounted) return null

  return (
    <div
      role="link"
      tabIndex={0}
      className="
        rounded-2xl border border-gray-200 dark:border-zinc-800
        bg-white dark:bg-zinc-900 p-3 shadow-sm relative
        transition-transform hover:scale-[1.02] hover:shadow-md
        flex flex-col cursor-pointer
      "
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          goToDetail()
        }
      }}
      aria-label={`Apri ${p.name}`}
    >
      {/* Badge esaurito / offerta */}
      {outOfStock && (
        <span className="absolute right-3 top-3 z-30 rounded-full bg-red-500/90 px-3 py-1 text-xs font-medium text-white shadow">
          Esaurito
        </span>
      )}
      {!outOfStock && sale != null && sale > 0 && sale < base && (
        <span className="absolute left-3 top-3 z-30 rounded-full bg-green-500/90 px-3 py-1 text-xs font-medium text-white shadow">
          Offerta
        </span>
      )}

      {/* Contenuto card sopra overlay */}
      <div className="relative z-20 flex flex-col flex-grow">
        {/* Immagine */}
        <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-900">
          <img
            src={img}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            style={{ viewTransitionName: `pimg-${p.id}` } as React.CSSProperties}
            loading="lazy"
            onError={(e) => {
              // Fallback a placeholder se l'URL è rotto
              const target = e.target as HTMLImageElement
              if (target.src !== '/placeholder-product.png') {
                target.src = '/placeholder-product.png'
              }
            }}
          />
        </div>

        {/* Contenuto testuale */}
        <div className="flex flex-col flex-grow mt-3">
          <div className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100 min-h-[2.5rem]">
            {p.name}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 min-h-[2rem]">
            {p.description ? (
              <p className="line-clamp-2">{p.description}</p>
            ) : (
              <span className="opacity-0 select-none">placeholder</span>
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {formatPrice(effective)} / {getUnitLabel(p as any)}
            </span>
            {sale != null && sale > 0 && sale < base && (
              <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                {formatPrice(base)}
              </span>
            )}
          </div>

          <StockIndicator product={p as any} className="mt-2" stockTextClassName={stockColorClass} />

          {/* CTA SEMPRE IN FONDO */}
          <div className="mt-auto pt-3">
            <AddToCartControls p={p} img={img} onAdded={onAdded} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
