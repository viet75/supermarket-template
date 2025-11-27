'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { useCartStore } from '@/stores/cartStore'

type Product = {
    id: string | number
    name: string
    description?: string | null
    price: number | string
    price_sale?: number | string | null
    image_url?: string | null
    images?: any[] | null
    stock?: number | string | null
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
        if (p?.image_url) return p.image_url
        const first = Array.isArray(p?.images) ? p.images![0] : null
        if (!first) return null
        if (typeof first === 'string') return first
        if (typeof first === 'object' && first && 'url' in (first as any)) {
            return (first as any).url ?? null
        }
        return null
    }, [p?.image_url, p?.images])

    const stockNum =
        p?.stock == null || (p as any).stock === '' ? null : Number((p as any).stock)
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
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm relative transition-transform hover:scale-[1.02] hover:shadow-md flex flex-col">
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
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50">
                {img ? (
                    <img
                        src={img}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        Nessuna immagine
                    </div>
                )}
            </div>

            {/* Contenuto testuale */}
            <div className="flex flex-col flex-grow mt-3">
                <div className="line-clamp-2 text-sm font-medium text-gray-900 min-h-[2.5rem]">
                    {p.name}
                </div>

                {p.description && (
                    <div className="text-xs text-gray-500 min-h-[2rem]">
                        {expanded ? (
                            <>
                                <p>{p.description}</p>
                                <button
                                    className="mt-1 text-blue-600 underline"
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
                                        className="mt-1 text-blue-600 underline"
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
                    <span className="text-base font-semibold text-gray-900">
                        €{effective.toFixed(2)} / {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                    </span>
                    {sale != null && sale > 0 && sale < base && (
                        <span className="text-sm text-gray-500 line-through">
                            €{base.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* CTA SEMPRE IN FONDO */}
                <div className="mt-auto pt-3">
                    {qtyInCart > 0 ? (
                        <div className="flex items-center justify-between rounded-xl border border-gray-200 p-1 bg-gray-50">
                            <button
                                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold text-lg"
                                onClick={handleRemove}
                                aria-label="Rimuovi"
                            >
                                −
                            </button>

                            <div className="min-w-[3rem] text-center text-sm font-medium">
                                {p.unit_type === 'per_kg' ? qtyInCart.toFixed(1) : qtyInCart}
                                {!isUnlimited && typeof stockNum === 'number' ? (
                                    <span className="ml-1 text-xs text-gray-500">
                                        / {stockNum} {p.unit_type === 'per_kg' ? 'kg' : 'pz'}
                                    </span>
                                ) : null}
                            </div>

                            <button
                                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-600 text-white font-bold text-lg transition-colors"
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
             disabled:bg-gray-300 disabled:text-gray-600 transition-colors"
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
