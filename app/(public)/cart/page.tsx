'use client'

import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/lib/pricing'
import Image from 'next/image'
import Link from 'next/link'

export default function CartPage() {
    const { items, removeItem, clear, total } = useCartStore()

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Carrello</h1>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <p className="text-gray-600 mb-6">Il carrello è vuoto.</p>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg 
                       bg-green-600 hover:bg-green-700 
                       text-white text-sm font-medium 
                       transition-colors shadow-sm"
                    >
                        🏪 Torna al negozio
                    </Link>
                </div>
            ) : (

                <div className="space-y-6">
                    {items.map((i) => (
                        <div
                            key={i.id}
                            className="flex items-center justify-between border-b border-gray-200 pb-4"
                        >
                            <div className="flex items-center space-x-4">
                                {i.image && (
                                    <Image
                                        src={i.image}
                                        alt={i.name}
                                        width={60}
                                        height={60}
                                        className="rounded-md object-cover"
                                    />
                                )}
                                <div>
                                    <h2 className="font-semibold">{i.name}</h2>
                                    <p className="text-sm text-gray-500">
                                        {i.unit === 'per_kg' ? `${i.qty} kg` : `x${i.qty}`}
                                    </p>
                                    <p className="text-sm font-medium text-gray-700">
                                        {formatPrice((i.salePrice && i.salePrice < i.price ? i.salePrice : i.price) * i.qty)}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => removeItem(i.id)}
                                className="text-red-500 hover:text-red-700 text-lg"
                                aria-label="Rimuovi"
                            >
                                ❌
                            </button>
                        </div>
                    ))}

                    <div className="flex justify-between items-center mt-6">
                        <button
                            onClick={clear}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded"
                        >
                            Svuota carrello
                        </button>
                        <p className="text-lg font-semibold">
                            Totale: {formatPrice(total())}
                        </p>
                    </div>

                    <div className="mt-6 text-right">
                        <Link
                            href="/checkout"
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
                        >
                            Procedi al pagamento
                        </Link>
                    </div>
                    {/* ✅ Pulsante per tornare allo store (responsive + dark mode) */}
                    <div className="mt-4 text-center">
                        <Link
                            href="/"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 
               text-sm font-medium text-gray-700 dark:text-gray-200 
               hover:text-green-600 transition-colors py-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Continua gli acquisti
                        </Link>
                    </div>


                </div>
            )}
        </div>
    )
}
