'use client'

import { useCartStore } from '@/stores/cartStore'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'

type ProductMinimal = {
  id: string
  name: string
  price: number
  price_sale?: number | null
  image_url?: string | null
  images?: unknown[] | null
  image?: string | null
  stock?: number | string | null
  unit_type?: 'per_unit' | 'per_kg' | null
  qty_step?: number | string | null
}

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000

type Props = {
  product: Record<string, unknown>
  heroImage: string
}

export default function ProductDetailCTA({ product, heroImage }: Props) {
  const addItem = useCartStore((s) => s.addItem)

  const p = product as unknown as ProductMinimal
  const stockRaw = p.stock
  const stock =
    stockRaw == null ? null
    : typeof stockRaw === 'number' ? stockRaw
    : (Number(stockRaw) || 0)
  const pForStock = { ...p, stock }
  const stepRaw = (p as any).qty_step
  const stepNum = stepRaw == null ? null : Number(String(stepRaw).replace(',', '.'))
  const step =
    Number.isFinite(stepNum) && (stepNum as number) > 0
      ? (stepNum as number)
      : (p.unit_type === 'per_kg' ? 0.1 : 1)
  const stockNum = toDisplayStock(pForStock as any)
  const isUnlimited = stockNum === null
  const outOfStock = !isUnlimited && stockNum === 0

  const handleAdd = () => {
    if (outOfStock) return
    if (typeof stockNum === 'number' && round3(step) > round3(stockNum)) return
    addItem({
      id: String(p.id),
      name: p.name,
      price: Number(p.price) || 0,
      image: heroImage || undefined,
      qty: step,
      maxStock: stockNum,
      unit: p.unit_type ?? 'per_unit',
      qty_step: p.qty_step != null ? Number(p.qty_step) : null,
    })
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={outOfStock}
      className="w-full rounded-xl bg-green-600 hover:bg-green-700 px-4 py-3 text-center text-base font-semibold text-white disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:text-gray-600 dark:disabled:text-gray-400 transition-colors"
      title={outOfStock ? 'Prodotto esaurito' : 'Aggiungi al carrello'}
      aria-label="Aggiungi al carrello"
    >
      {outOfStock ? 'Esaurito' : 'Aggiungi al carrello'}
    </button>
  )
}
