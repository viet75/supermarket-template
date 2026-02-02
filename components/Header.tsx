'use client'

import Link from 'next/link'
import { useCartStore } from '@/stores/cartStore'
import { motion } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

export default function Header() {
    const { items } = useCartStore()
    const badgeCount = items.length // numero articoli diversi


    const [openMenu, setOpenMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Chiude il menu se clicchi fuori
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Traduzione semplice metodo pagamento
    const isAdmin = true // 👈 per ora forzato, in futuro useremo user.email === process.env.ADMIN_EMAIL

    return (
        <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">

            {/* Logo / titolo */}
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
            </h1>


            {/* Azioni a destra */}
            <div className="flex items-center gap-4">
                {/* Carrello */}
                <Link
                    href="/cart"
                    className="relative text-gray-700 dark:text-gray-200 text-2xl hover:text-green-600 transition"
                >
                    🛒
                    {badgeCount > 0 && (
                        <motion.span
                            key={badgeCount}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                            className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow"
                        >
                            {badgeCount}
                        </motion.span>
                    )}

                </Link>

                {/* Omino con menu a click */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setOpenMenu((prev) => !prev)}
                        className="flex items-center gap-1 text-gray-700 dark:text-gray-200 text-2xl hover:text-green-600 transition cursor-pointer"
                        aria-label="Profilo"
                    >
                        👤
                        <motion.span
                            animate={{ rotate: openMenu ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-sm"
                        >
                            ▼
                        </motion.span>
                    </button>

                    {openMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50"
                        >
                            {/* 👇 Solo link admin (per ora sempre visibili, poi faremo check email Supabase) */}
                            {true && (
                                <>
                                    <Link
                                        href="/admin/products"
                                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setOpenMenu(false)}
                                    >
                                        Gestione Prodotti
                                    </Link>
                                    <Link
                                        href="/admin/orders"
                                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setOpenMenu(false)}
                                    >
                                        Gestione Ordini
                                    </Link>
                                    <Link
                                        href="/admin/categories"
                                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setOpenMenu(false)}
                                    >
                                        Gestione Categorie
                                    </Link>
                                    <Link
                                        href="/admin/settings/delivery"
                                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setOpenMenu(false)}
                                    >
                                        Gestione Consegna
                                    </Link>
                                    <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                                    <Link
                                        href="/admin/settings"
                                        className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setOpenMenu(false)}
                                    >
                                        Impostazioni
                                    </Link>
                                </>
                            )}
                        </motion.div>
                    )}
                </div>

            </div>
        </header>
    )
}
