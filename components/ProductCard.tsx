'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { useCartStore } from '@/stores/cartStore'
import { toDisplayStock, getUnitLabel } from '@/lib/stock'
import { formatPrice } from '@/lib/pricing'

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
}

function ProductCard({ p, onAdded }: { p: Product; onAdded?: (name: string) => void }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const [expanded, setExpanded] = useState(false)

    const addItem = useCartStore((s) => s.addItem)
    const removeItem = useCartStore((s) => s.removeItem)
    const qtyInCart = useCartStore((s) => {
        const it = s.items.find((i) => i.id === String(p.id))
        return it ? it.qty : 0
    })

    const base = useMemo(() => Number(p?.price ?? 0), [p?.price])
    const sale = useMemo(
        () => (p?.price_sale != null ? Number(p.price_sale) : null),
        [p?.price_sale]
    )
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
    const isUnlimited = stockNum === null
    const outOfStock = !isUnlimited && stockNum === 0
    const atLimit = !isUnlimited && !outOfStock && qtyInCart >= (stockNum ?? 0)

    // step dinamico: 1 pezzo o 0.5 kg
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

    if (!mounted) return null

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm relative transition-transform hover:scale-[1.02] hover:shadow-md flex flex-col">
            {/* Badge esaurito / offerta... */}
            {outOfStock && (
                <span className="absolute right-3 top-3 rounded-full bg-red-500/90 px-3 py-1 text-xs font-medium text-white shadow">
                    Esaurito
                </span>
            )}
            {!outOfStock && sale != null && sale > 0 && sale < base && (
                <span className="absolute left-3 top-3 rounded-full bg-green-500/90 px-3 py-1 text-xs font-medium text-white shadow">
                    Offerta
                </span>
            )}

            {/* Immagine */}
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-zinc-900">
                <img
                    src={img}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
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

                {p.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 min-h-[2rem]">
                        {expanded ? (
                            <>
                                <p>{p.description}</p>
                                <button
                                    className="mt-1 text-blue-600 dark:text-blue-400 underline"
                                    onClick={() => setExpanded(false)}
                                >
                                    Mostra meno
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="line-clamp-2">{p.description}</p>
                                {p.description.length > 60 && (
                                    <button
                                        className="mt-1 text-blue-600 dark:text-blue-400 underline"
                                        onClick={() => setExpanded(true)}
                                    >
                                        Altro
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}



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

                {/* CTA SEMPRE IN FONDO */}
                <div className="mt-auto pt-3">
                    {qtyInCart > 0 ? (
                        <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-zinc-800 p-1 bg-gray-50 dark:bg-zinc-900">
                            <button
                                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-900 dark:text-gray-100 font-bold text-lg"
                                onClick={handleRemove}
                                aria-label="Rimuovi"
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
                                onClick={handleAdd}
                                disabled={outOfStock || atLimit}
                                title={
                                    outOfStock
                                        ? 'Prodotto esaurito'
                                        : atLimit
                                            ? 'Hai raggiunto la quantità disponibile'
                                            : 'Aggiungi un altro'
                                }
                                aria-label="Aggiungi un altro"
                            >
                                +
                            </button>
                        </div>
                    ) : (
                        <button
                            className="w-full md:w-auto rounded-xl bg-green-600 hover:bg-green-700 
             px-3 py-2 md:px-4 md:py-2.5 
             text-center text-sm md:text-base font-semibold text-white 
             disabled:bg-gray-300 dark:disabled:bg-zinc-700 disabled:text-gray-600 dark:disabled:text-gray-400 transition-colors"
                            onClick={handleAdd}
                            disabled={outOfStock}
                            title={outOfStock ? 'Prodotto esaurito' : 'Aggiungi al carrello'}
                            aria-label="Aggiungi al carrello"
                        >
                            {outOfStock ? 'Esaurito' : 'Aggiungi al carrello'}
                        </button>

                    )}
                </div>
            </div>
        </div>
    )

}

export default ProductCard
