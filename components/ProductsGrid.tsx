'use client'

import ProductCard from '@/components/ProductCard'
import type { Product } from '@/lib/types'

type Props = {
    products: Product[]
    className?: string
}

export default function ProductsGrid({ products, className }: Props) {
    return (
        <div className={`mx-auto max-w-screen-2xl ${className ?? ''}`}>
            {products.length === 0 ? (
                <p className="text-center text-gray-500 mt-10">
                    Nessun prodotto trovato
                </p>
            ) : (
                <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {products.map((p) => (
                        <ProductCard key={p.id} p={p} />
                    ))}
                </div>
            )}
        </div>
    )
}
