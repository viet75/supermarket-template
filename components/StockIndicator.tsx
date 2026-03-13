'use client'

import { useMemo } from 'react'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  product: {
    stock?: number | string | null
    stock_baseline?: number | string | null
    stock_unlimited?: boolean | null
    unit_type?: 'per_unit' | 'per_kg' | null
  } & Record<string, any>
  className?: string
  stockBaseline?: number | null
  /** text color stock class (e.g. from ProductCard: green/yellow/orange/red) */
  stockTextClassName?: string
}

export default function StockIndicator({ product, className, stockBaseline, stockTextClassName }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const stockNum = toDisplayStock(product as any) // null = unlimited
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0

  const unitLabel = getUnitLabel(product as any, locale)

  // Extract stockBaseline from prop or product.stock_baseline (backwards compatibility)
  const baseline = useMemo(() => {
    if (stockBaseline !== undefined) return stockBaseline
    const v = (product as any)?.stock_baseline
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [stockBaseline, product])

  // Calculate percentage only relative to stockBaseline
  const percent = useMemo(() => {
    if (isUnlimited) return 100
    if (baseline !== null && baseline > 0) {
      const v = Math.max(0, Math.min(1, (stockNum ?? 0) / baseline))
      return Math.round(v * 100)
    }
    return 0
  }, [isUnlimited, stockNum, baseline])

  // Color based only on percent (consistent with the bar)
  const colorClass = useMemo(() => {
    if (isUnlimited) return 'text-green-600 dark:text-green-400'
    if (percent >= 60) return 'text-green-600 dark:text-green-400'
    if (percent >= 30) return 'text-orange-500 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }, [isUnlimited, percent])

  const formatKg = (n: number) => {
    const s = (Math.round((n + Number.EPSILON) * 1000) / 1000).toFixed(3)
    return s.replace(/\.?0+$/, '')
  }

  return (
    <div className={className ?? ''}>
      {/* STOCK TEXT */}
      <div className={`text-xs font-medium ${stockTextClassName ?? colorClass}`}>
        {isUnlimited ? (
          <span>{t('product.availabilityUnlimited')}</span>
        ) : outOfStock ? (
          <span>{t('product.availableQuantity', { quantity: 0, unit: unitLabel })}</span>
        ) : (
          <span>{t('product.availableQuantity', { quantity: product.unit_type === 'per_kg' && typeof stockNum === 'number' ? formatKg(stockNum) : stockNum, unit: unitLabel })}</span>
        )}
      </div>

      {/* STOCK BAR */}
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
