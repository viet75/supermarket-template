'use client'

import { useCallback } from 'react'
import { useCartStore } from '@/stores/cartStore'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'

export type ProductForCart = {
  id: string | number
  name: string
  price: number | string
  image_url?: string | null
  images?: unknown[] | null
  stock?: number | string | null
  stock_unit?: number | null
  unit_type?: 'per_unit' | 'per_kg' | null
}

type Props = {
  p: ProductForCart
  img: string
  onAdded?: (name: string) => void
}

export default function AddToCartControls({ p, img, onAdded }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const removeItem = useCartStore((s) => s.removeItem)
  const qtyInCart = useCartStore((s) => {
    const it = s.items.find((i) => i.id === String(p.id))
    return it ? it.qty : 0
  })

  const stockNum = toDisplayStock(p as any)
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0
  const atLimit = !isUnlimited && !outOfStock && qtyInCart >= (stockNum ?? 0)
  const step = p.unit_type === 'per_kg' ? 0.5 : 1

  const handleAdd = useCallback(() => {
    if (outOfStock) return
    addItem({
      id: String(p.id),
      name: p.name,
      price: Number(p.price) || 0,
      image: img || undefined,
      qty: step,
      maxStock: stockNum,
      unit: (p.unit_type as 'per_unit' | 'per_kg') ?? 'per_unit',
    })
    onAdded?.(p.name)
  }, [addItem, p, step, img, stockNum, outOfStock, onAdded])

  const handleRemove = useCallback(() => {
    removeItem(String(p.id), step)
  }, [removeItem, p.id, step])

  const stopProp = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  if (qtyInCart > 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-zinc-800 p-1 bg-gray-50 dark:bg-zinc-900">
        <button
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-900 dark:text-gray-100 font-bold text-lg"
          onMouseDown={stopProp}
          onClick={(e) => {
            stopProp(e)
            handleRemove()
          }}
          aria-label="Rimuovi"
          type="button"
        >
          −
        </button>

        <div className="min-w-[3rem] text-center text-sm font-medium text-gray-900 dark:text-gray-100">
          {p.unit_type === 'per_kg' ? qtyInCart.toFixed(1) : qtyInCart}
          {!isUnlimited && typeof stockNum === 'number' ? (
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              / {stockNum} {getUnitLabel(p as any)}
            </span>
          ) : null}
        </div>

        <button
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:text-gray-600 dark:disabled:text-gray-400 text-white font-bold text-lg transition-colors"
          onMouseDown={stopProp}
          onClick={(e) => {
            stopProp(e)
            handleAdd()
          }}
          disabled={outOfStock || atLimit}
          title={
            outOfStock
              ? 'Prodotto esaurito'
              : atLimit
                ? 'Hai raggiunto la quantità disponibile'
                : 'Aggiungi un altro'
          }
          aria-label="Aggiungi un altro"
          type="button"
        >
          +
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onMouseDown={stopProp}
      onClick={(e) => {
        stopProp(e)
        handleAdd()
      }}
      disabled={outOfStock}
      title={outOfStock ? 'Prodotto esaurito' : 'Aggiungi al carrello'}
      aria-label="Aggiungi al carrello"
      className="w-full md:w-auto rounded-xl bg-green-600 hover:bg-green-700 
        px-3 py-2 md:px-4 md:py-2.5 
        text-center text-sm md:text-base font-semibold text-white 
        disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:text-gray-600 dark:disabled:text-gray-400 transition-colors"
    >
      {outOfStock ? 'Esaurito' : 'Aggiungi al carrello'}
    </button>
  )
}
