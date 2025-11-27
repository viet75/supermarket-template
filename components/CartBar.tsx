'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCartStore } from '@/stores/cartStore'
import { motion, AnimatePresence } from 'framer-motion'

type CartBarProps = {
    onCheckout?: () => void
}

export default function CartBar({ onCheckout }: CartBarProps) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const items = useCartStore((s) => s.items)

    if (!mounted) return null // Evita errori di hydration

    const count = items.reduce((acc, it) => acc + it.qty, 0)
    const total = items.reduce((acc, it) => {
        const price =
            it.salePrice && it.salePrice < it.price ? it.salePrice : it.price
        return acc + price * it.qty
    }, 0)

    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 15 }}
                    className="fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2"
                >
                    {onCheckout ? (
                        <button
                            onClick={onCheckout}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-green-600 hover:to-emerald-700 transition-colors"
                        >
                            <span className="text-lg">🛒</span>
                            <span>
                                Vai al carrello ({count} – €{total.toFixed(2)})
                            </span>
                        </button>
                    ) : (
                        <Link
                            href="/checkout"
                            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-green-600 hover:to-emerald-700 transition-colors"
                        >
                            <span className="text-lg">🛒</span>
                            <span>
                                Vai al carrello ({count} – €{total.toFixed(2)})
                            </span>
                        </Link>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
