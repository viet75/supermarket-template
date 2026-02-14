'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, Fragment } from 'react'
import { Package, ShoppingCart, Layers, Menu, X, Truck, Settings } from 'lucide-react'
import { supabaseClient } from '@/lib/supabaseClient'

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    setOpen(false)
    await supabaseClient().auth.signOut()
    router.push('/')
    router.refresh()
  }

  const links = [
    { href: '/admin/orders', label: 'Ordini', icon: ShoppingCart },
    { href: '/admin/products', label: 'Prodotti', icon: Package },
    { href: '/admin/categories', label: 'Categorie', icon: Layers },
    { href: '/admin/settings/delivery', label: 'Consegna', icon: Truck },
    { href: '/admin/settings', label: 'Impostazioni', icon: Settings, exact: true, separatorBefore: true },
  ]

  return (
    <>
      {/* Header mobile con hamburger, titolo e spazio */}
      <header
        className="fixed top-0 left-0 right-0 z-50 md:hidden
                   flex items-center justify-between
                   h-14 px-4
                   bg-white dark:bg-gray-900
                   border-b border-gray-200 dark:border-gray-700
                   shadow-sm"
      >
        {/* Hamburger a sinistra - larghezza fissa */}
        <button
          className="w-10 h-10 flex items-center justify-center
                     rounded-md
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? (
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          ) : (
            <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          )}
        </button>

        {/* Titolo al centro - flex-1, centrato, truncate */}
        <h1
          className="flex-1 min-w-0 text-center
                     text-lg font-semibold
                     text-gray-900 dark:text-gray-100
                     truncate px-2"
        >
          {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
        </h1>

        {/* Spazio a destra per bilanciamento - larghezza fissa */}
        <div className="w-10" />
      </header>

      {/* Overlay scuro animato su mobile */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out z-40 md:hidden
                    ${open ? 'bg-opacity-40 visible' : 'bg-opacity-0 invisible'}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64
                    bg-white dark:bg-gray-900
                    border-r border-gray-200 dark:border-gray-700
                    flex flex-col z-50 transform transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div
          className="p-4 text-center font-semibold text-lg
                     border-b border-gray-200 dark:border-gray-700
                     text-gray-900 dark:text-gray-100"
        >
          {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ href, label, icon: Icon, exact, separatorBefore }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Fragment key={href}>
                {separatorBefore && (
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2" />
                )}
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${
                      active
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              </Fragment>
            )
          })}

          <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer transition-colors"
            >
              <span aria-hidden>🚪</span>
              Logout
            </button>
          </div>
        </nav>

        {/* ============================
            SAFE-AREA FIX iOS PWA
            - evita che il CTA bottom venga tagliato
            - mantiene anche una separazione visiva
           ============================ */}
        <div className="border-t border-gray-200 dark:border-gray-700 mx-4" />

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 w-full
                       px-3 py-3 rounded-md text-sm font-medium
                       bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            🏪 Torna al sito
          </Link>
        </div>

        <div
          className="p-4 text-xs
                     text-gray-400 dark:text-gray-500
                     border-t border-gray-200 dark:border-gray-700"
        >
          Admin Panel v1.0
        </div>
      </aside>
    </>
  )
}
