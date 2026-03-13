'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, Fragment } from 'react'
import { Package, ShoppingCart, Layers, Menu, X, Truck, Settings } from 'lucide-react'
import { supabaseClient } from '@/lib/supabaseClient'
import { useTranslations } from 'next-intl'

export default function AdminSidebar() {
  const t = useTranslations('adminNavigation')
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
    { href: '/admin/orders', label: t('orders'), icon: ShoppingCart },
    { href: '/admin/products', label: t('products'), icon: Package },
    { href: '/admin/categories', label: t('categories'), icon: Layers },
    { href: '/admin/settings/delivery', label: t('delivery'), icon: Truck },
    { href: '/admin/settings', label: t('settings'), icon: Settings, exact: true, separatorBefore: true },
  ]

  return (
    <>
      {/* Mobile header with hamburger, title and space */}
      <header
        className="fixed top-0 left-0 right-0 z-50 md:hidden
                   flex items-center justify-between
                   h-14 px-4
                   bg-white dark:bg-gray-900
                   border-b border-gray-200 dark:border-gray-700
                   shadow-sm"
      >
        {/* Left hamburger - fixed width */}
        <button
          className="w-10 h-10 flex items-center justify-center
                     rounded-md
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? (
            <X className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
          ) : (
            <Menu className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
          )}
        </button>

        {/* Center title - flex-1, centered, truncated */}
        <h1
          className="flex-1 min-w-0 text-center
                     text-lg font-semibold
                     text-gray-900 dark:text-zinc-100
                     truncate px-2"
        >
          {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
        </h1>

        {/* Right space for balancing - fixed width */}
        <div className="w-10" />
      </header>

      {/* Dark overlay animated on mobile */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out z-40 md:hidden
                    ${open ? 'bg-opacity-40 visible' : 'bg-opacity-0 invisible'}`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64
                    bg-white dark:bg-zinc-900
                    border-r border-gray-200 dark:border-zinc-800
                    flex flex-col z-50 transform transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div
          className="p-4 text-center font-semibold text-lg
                     border-b border-gray-200 dark:border-zinc-800
                     text-gray-900 dark:text-zinc-100"
        >
          {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ href, label, icon: Icon, exact, separatorBefore }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Fragment key={href}>
                {separatorBefore && (
                  <div className="border-t border-gray-200 dark:border-zinc-800 mt-2 pt-2" />
                )}
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${
                      active
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200'
                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              </Fragment>
            )
          })}

          <div className="border-t border-gray-200 dark:border-zinc-800 mt-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer transition-colors"
            >
              <span aria-hidden>🚪</span>
              {t('logout')}
            </button>
          </div>
        </nav>

        {/* ============================
            SAFE-AREA FIX iOS PWA
            - avoid that the bottom CTA is cut
            - also maintains a visual separation
           ============================ */}
        <div className="border-t border-gray-200 dark:border-zinc-800 mx-4" />

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 w-full
                       px-3 py-3 rounded-md text-sm font-medium
                       bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            🏪 {t('backToSite')}
          </Link>
        </div>

        <div
          className="p-4 text-xs
                     text-gray-400 dark:text-zinc-500
                     border-t border-gray-200 dark:border-zinc-800"
        >
          {t('adminPanel')} v1.0
        </div>
      </aside>
    </>
  )
}
