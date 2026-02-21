'use client'

import { useMemo } from 'react'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'

type Props = {
  product: {
    stock?: number | string | null
    stock_baseline?: number | string | null
    stock_unlimited?: boolean | null
    unit_type?: 'per_unit' | 'per_kg' | null
  } & Record<string, any>
  className?: string
  stockBaseline?: number | null
  /** classe colore testo stock (es. da ProductCard: verde/giallo/arancione/rosso) */
  stockTextClassName?: string
}

export default function StockIndicator({ product, className, stockBaseline, stockTextClassName }: Props) {
  const stockNum = toDisplayStock(product as any) // null = illimitato
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0

  const unitLabel = getUnitLabel(product as any)

  // Estrai stockBaseline dalla prop o da product.stock_baseline (retrocompatibilità)
  const baseline = useMemo(() => {
    if (stockBaseline !== undefined) return stockBaseline
    const v = (product as any)?.stock_baseline
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [stockBaseline, product])

  // Calcola percentuale SOLO rispetto a stockBaseline
  const percent = useMemo(() => {
    if (isUnlimited) return 100
    if (baseline !== null && baseline > 0) {
      const v = Math.max(0, Math.min(1, (stockNum ?? 0) / baseline))
      return Math.round(v * 100)
    }
    return 0
  }, [isUnlimited, stockNum, baseline])

  // Colore basato SOLO su percent (coerente con la barra)
  const colorClass = useMemo(() => {
    if (isUnlimited) return 'text-green-600 dark:text-green-400'
    if (percent >= 60) return 'text-green-600 dark:text-green-400'
    if (percent >= 30) return 'text-orange-500 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }, [isUnlimited, percent])

  return (
    <div className={className ?? ''}>
      {/* TESTO STOCK */}
      <div className={`text-xs font-medium ${stockTextClassName ?? colorClass}`}>
        {isUnlimited ? (
          <span>Disponibilità: illimitata</span>
        ) : outOfStock ? (
          <span>Disponibili: 0 {unitLabel}</span>
        ) : (
          <span>Disponibili: {stockNum} {unitLabel}</span>
        )}
      </div>

      {/* BARRA STOCK */}
      <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={[
            'h-full rounded-full transition-[width] duration-300',
            outOfStock ? 'bg-red-500' : 'bg-green-600',
          ].join(' ')}
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>
    </div>
  )
}
