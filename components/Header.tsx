'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cartStore'
import { supabaseClient } from '@/lib/supabaseClient'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Header() {
  const router = useRouter()
  const { items } = useCartStore()
  const badgeCount = items.length

  const [openMenu, setOpenMenu] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
    router.push('/')
    router.refresh()
  }

  const isAdmin = true

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
          {isAdmin && (
            <>
              <Link
                href="/admin/products"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                Gestione Prodotti
              </Link>
              <Link
                href="/admin/orders"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                Gestione Ordini
              </Link>
              <Link
                href="/admin/categories"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                Gestione Categorie
              </Link>
              <Link
                href="/admin/settings/delivery"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                Gestione Consegna
              </Link>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <Link
                href="/admin/settings"
                className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setOpenMenu(false)}
                role="menuitem"
              >
                Impostazioni
              </Link>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer rounded-b-xl"
                role="menuitem"
              >
                <span aria-hidden>🚪</span>
                Logout
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        {process.env.NEXT_PUBLIC_STORE_NAME ?? 'Supermarket Template'}
      </h1>

      <div className="flex items-center gap-4">
        <Link
          href="/cart"
          className="relative text-gray-700 dark:text-gray-200 text-2xl hover:text-green-600 transition"
          aria-label="Carrello"
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
            className="flex items-center gap-1 text-gray-700 dark:text-gray-200 text-2xl hover:text-green-600 transition cursor-pointer"
            aria-label="Profilo"
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
