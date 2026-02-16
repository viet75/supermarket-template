'use client'

import { useMemo } from 'react'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'

type Props = {
  product: {
    stock?: number | string | null
    stock_unlimited?: boolean | null
    unit_type?: 'per_unit' | 'per_kg' | null
  } & Record<string, any>
  className?: string
  // massimo stock "di riferimento" per la barra; se non passato usa una euristica
  maxForBar?: number
  /** classe colore testo stock (es. da ProductCard: verde/giallo/arancione/rosso) */
  stockTextClassName?: string
}

export default function StockIndicator({ product, className, maxForBar, stockTextClassName }: Props) {
  const stockNum = toDisplayStock(product as any) // null = illimitato
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0

  const unitLabel = getUnitLabel(product as any)

  // euristica barra: se maxForBar non passato, usa 20 (kg) o 30 (unit) come "scala"
  const computedMax = useMemo(() => {
    if (typeof maxForBar === 'number' && maxForBar > 0) return maxForBar
    return product?.unit_type === 'per_kg' ? 20 : 30
  }, [maxForBar, product?.unit_type])

  const pct = useMemo(() => {
    if (isUnlimited) return 100
    const v = Math.max(0, Math.min(1, (stockNum ?? 0) / computedMax))
    return Math.round(v * 100)
  }, [isUnlimited, stockNum, computedMax])

  return (
    <div className={className ?? ''}>
      {/* TESTO STOCK */}
      <div className={`text-xs font-medium ${stockTextClassName ?? 'text-gray-500 dark:text-gray-400'}`}>
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
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  )
}
