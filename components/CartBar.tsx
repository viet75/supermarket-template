'use client'

import { Link } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/lib/pricing'
import { motion, AnimatePresence } from 'framer-motion'

type CartBarProps = {
  onCheckout?: () => void
}

const barClassName =
  'flex w-full items-center justify-between gap-2 sm:gap-3 rounded-[28px] border border-white/30 dark:border-white/10 bg-white/80 dark:bg-zinc-900/75 backdrop-blur-lg px-3 py-2 shadow-[0_10px_40px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_40px_-4px_rgba(0,0,0,0.45)] transition-colors active:scale-[0.99]'

const ctaClassName =
  'shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold tracking-tight text-white shadow-md shadow-green-700/25 ring-1 ring-inset ring-white/20 dark:bg-green-600 dark:shadow-green-950/40'

const BOTTOM_STANDALONE = 'calc(env(safe-area-inset-bottom, 0px) + 0.15rem)'
const BOTTOM_BROWSER = 'calc(env(safe-area-inset-bottom, 0px) + 0.35rem)'

export default function CartBar({ onCheckout }: CartBarProps) {
  const t = useTranslations('cart')
  const locale = useLocale()
  const [mounted, setMounted] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(BOTTOM_BROWSER)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')

    const apply = () => {
      setBottomOffset(mq.matches ? BOTTOM_STANDALONE : BOTTOM_BROWSER)
    }

    apply()
    setMounted(true)

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }

    mq.addListener(apply)
    return () => mq.removeListener(apply)
  }, [])

  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())

  if (!mounted) return null

  const count = items.length
  const formatted = formatPrice(total, locale)

  const itemLabel =
    locale === 'en'
      ? count === 1
        ? 'item'
        : 'items'
      : count === 1
        ? 'articolo'
        : 'articoli'

  const inner = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-lg leading-none" aria-hidden>
          🛒
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-snug text-gray-500 dark:text-zinc-400">
            {count} {itemLabel}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight text-gray-900 dark:text-zinc-50">
            {formatted}
          </p>
        </div>
      </div>
      <span className={ctaClassName}>{t('goToCart')}</span>
    </>
  )

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="pointer-events-none fixed left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 md:hidden"
          style={{ bottom: bottomOffset }}
        >
          {onCheckout ? (
            <button
              type="button"
              onClick={onCheckout}
              className={`${barClassName} pointer-events-auto text-left`}
              aria-label={t('goToCart')}
            >
              {inner}
            </button>
          ) : (
            <Link
              href="/cart"
              className={`${barClassName} pointer-events-auto`}
              aria-label={t('goToCart')}
            >
              {inner}
            </Link>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
