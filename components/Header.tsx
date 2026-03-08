'use client'

import { Link, useRouter, usePathname } from '@/i18n/navigation'
import NextLink from 'next/link'
import { useCartStore } from '@/stores/cartStore'
import { supabaseClient } from '@/lib/supabaseClient'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations, useLocale } from 'next-intl'

export default function Header() {
  const router = useRouter()
  const t = useTranslations('header')
  const pathname = usePathname()
  const locale = useLocale()
  const { items } = useCartStore()
  const badgeCount = items.length

  const [openMenu, setOpenMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Admin = autenticato + email coincide con NEXT_PUBLIC_ADMIN_EMAIL (se definita)
  useEffect(() => {
    const supabase = supabaseClient()
    const adminEmail = typeof process.env.NEXT_PUBLIC_ADMIN_EMAIL === 'string'
      ? process.env.NEXT_PUBLIC_ADMIN_EMAIL.trim()
      : ''

    const updateAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const authed = !!session?.user
      setIsAuthed(authed)
      if (!adminEmail) {
        setIsAdmin(false)
        return
      }
      const email = (session?.user?.email ?? '').trim().toLowerCase()
      const allowed = adminEmail.trim().toLowerCase()
      setIsAdmin(authed && email === allowed)
    }

    updateAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      updateAuth()
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return

    const update = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--app-header-h', `${h}px`)
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)

    window.addEventListener('resize', update, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  // posizione dropdown (fixed) ancorata al bottone
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })

  const computePos = () => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()

    // dropdown: fixed, allineato a destra del bottone, sotto al bottone
    const top = r.bottom + 8
    const right = window.innerWidth - r.right
    setPos({ top, right })
  }

  useEffect(() => {
    if (!openMenu) return
    computePos()

    const onResize = () => computePos()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, { passive: true }) // se scrolla, riallinea

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize)
    }
  }, [openMenu])

  // chiudi se clic fuori + ESC
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      // se clicchi sul bottone o sul menu, non chiudere
      if (btnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpenMenu(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(false)
    }

    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  const handleLogout = async () => {
    setOpenMenu(false)
    await supabaseClient().auth.signOut()
    router.push('/', { locale })
    router.refresh()
  }

  const switchLocale = (nextLocale: 'it' | 'en') => {
    router.replace(pathname, { locale: nextLocale })
    router.refresh()
  }

  // contenuto dropdown
  const dropdown = (
    <AnimatePresence>
      {openMenu && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
          }}
          className="z-[999999] w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
          role="menu"
        >
          {isAdmin ? (
            <>
              <NextLink
                href="/admin/products"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('manageProducts')}
              </NextLink>
              <NextLink
                href="/admin/orders"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('manageOrders')}
              </NextLink>
              <NextLink
                href="/admin/categories"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('manageCategories')}
              </NextLink>
              <NextLink
                href="/admin/settings/delivery"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('manageDelivery')}
              </NextLink>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <NextLink
                href="/admin/settings"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('settings')}
              </NextLink>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer rounded-b-xl"
                role="menuitem"
              >
                <span aria-hidden>🚪</span>
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <NextLink
                href="/admin"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                {t('login')}
              </NextLink>
              {isAuthed && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer rounded-b-xl"
                    role="menuitem"
                  >
                    <span aria-hidden>🚪</span>
                    {t('logout')}
                  </button>
                </>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-zinc-800 shadow-sm"
    >
      <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        {process.env.NEXT_PUBLIC_STORE_NAME ?? t('defaultStoreName')}
      </h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => switchLocale('it')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition ${
              locale === 'it'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
            aria-pressed={locale === 'it'}
          >
            IT
          </button>

          <button
            type="button"
            onClick={() => switchLocale('en')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full transition ${
              locale === 'en'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
            aria-pressed={locale === 'en'}
          >
            EN
          </button>
        </div>

        <Link
          href="/cart"
          className="relative text-gray-700 dark:text-zinc-300 text-2xl hover:text-green-600 transition"
          aria-label={t('cart')}
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

        <div className="relative">
          <button
            ref={btnRef}
            onClick={() => {
              const next = !openMenu
              setOpenMenu(next)
              // calcola subito posizione quando apre
              if (next) requestAnimationFrame(computePos)
            }}
            className="flex items-center gap-1 text-gray-700 dark:text-zinc-300 text-2xl hover:text-green-600 transition cursor-pointer"
            aria-label={t('profile')}
            aria-expanded={openMenu}
            aria-haspopup="menu"
            type="button"
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

          {/* ✅ Portal su body: sempre sopra qualsiasi sticky */}
          {mounted ? createPortal(dropdown, document.body) : null}
        </div>
      </div>
    </header>
  )
}
