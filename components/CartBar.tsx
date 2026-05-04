'use client'

import { Link } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import clsx from 'clsx'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/lib/pricing'
import { motion, AnimatePresence } from 'framer-motion'
import { useStoreDeliveryMinSettings } from '@/hooks/useStoreDeliveryMinSettings'
import { deliveryMinOrderStatus } from '@/lib/minOrderDelivery'

type CartBarProps = {
  onCheckout?: () => void
}

const barClassName =
  'flex w-full items-center justify-between gap-2 sm:gap-3 rounded-[28px] border border-white/30 dark:border-white/10 bg-white/80 dark:bg-zinc-900/75 backdrop-blur-lg px-3 py-2 shadow-[0_10px_40px_-4px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_40px_-4px_rgba(0,0,0,0.45)] transition-colors'

const ctaClassName =
  'shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-sm font-semibold tracking-tight text-white shadow-md shadow-green-700/25 ring-1 ring-inset ring-white/20 dark:bg-green-600 dark:shadow-green-950/40 transition-all duration-100 active:scale-90 active:bg-green-700 active:shadow-sm'

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
  const cartTotal = useCartStore((s) => s.total)
  const deliverySettings = useStoreDeliveryMinSettings()
  const subtotal = cartTotal()
  const minOrderUx = deliveryMinOrderStatus(deliverySettings, subtotal)

  const fulfillmentType = 'delivery'
  const deliveryMinOrderEnabled = deliverySettings?.delivery_min_order_enabled ?? false
  const deliveryMinOrderAmount =
    deliverySettings?.delivery_min_order_amount !== null &&
    deliverySettings?.delivery_min_order_amount !== undefined
      ? Number(deliverySettings.delivery_min_order_amount)
      : null
  const isDeliveryMinOrderActive =
    deliveryMinOrderEnabled &&
    deliveryMinOrderAmount !== null &&
    Number.isFinite(deliveryMinOrderAmount) &&
    deliveryMinOrderAmount > 0
  const isMinActive = isDeliveryMinOrderActive
  const missingAmount =
    deliveryMinOrderAmount != null && Number.isFinite(deliveryMinOrderAmount)
      ? Math.max(deliveryMinOrderAmount - subtotal, 0)
      : 0
  const isDeliveryBlocked =
    fulfillmentType === 'delivery' &&
    deliverySettings?.delivery_enabled === true &&
    isDeliveryMinOrderActive &&
    missingAmount > 0

  if (!mounted) return null

  const count = items.length
  const formatted = formatPrice(subtotal, locale)

  const itemLabel =
    locale === 'en'
      ? count === 1
        ? 'item'
        : 'items'
      : count === 1
        ? 'articolo'
        : 'articoli'

  const cta =
    onCheckout ? (
      <button
        type="button"
        disabled={isDeliveryBlocked}
        onClick={isDeliveryBlocked ? undefined : onCheckout}
        title={isDeliveryBlocked ? t('checkoutBlockedMinOrder') : undefined}
        aria-label={isDeliveryBlocked ? t('checkoutBlockedMinOrder') : t('goToCart')}
        className={clsx(
          ctaClassName,
          isDeliveryBlocked &&
            'cursor-not-allowed bg-zinc-400 opacity-80 shadow-none ring-0 active:scale-100 dark:bg-zinc-600 dark:opacity-90'
        )}
      >
        {t('goToCart')}
      </button>
    ) : (
      <Link href="/cart" className={ctaClassName} aria-label={t('goToCart')}>
        {t('goToCart')}
      </Link>
    )

  const showMinProgress =
    isMinActive &&
    deliverySettings?.delivery_enabled === true &&
    deliveryMinOrderAmount != null &&
    deliveryMinOrderAmount > 0

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
          {minOrderUx.active && (
            <p
              className={
                minOrderUx.reached
                  ? 'mt-1 text-[11px] leading-tight text-emerald-600 dark:text-emerald-500'
                  : 'mt-1 text-[11px] leading-tight text-amber-600 dark:text-amber-500'
              }
            >
              {minOrderUx.reached
                ? t('minOrder.reached')
                : t('minOrder.missing', { amount: minOrderUx.missing.toFixed(2) })}
            </p>
          )}
        </div>
      </div>
      <div className="flex min-w-0 max-w-[52%] shrink flex-col items-end gap-1.5 sm:max-w-none">
        {onCheckout && showMinProgress && (
          <div className="w-full min-w-[9rem]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-500"
                style={{
                  width: `${Math.min(
                    (subtotal / (deliveryMinOrderAmount as number)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        {cta}
        {onCheckout && isDeliveryBlocked && (
          <p className="max-w-[14rem] text-right text-[11px] leading-snug text-amber-600 dark:text-amber-400">
            {t('checkoutBlockedMinOrder')}
          </p>
        )}
      </div>
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
          <div className={`${barClassName} pointer-events-auto`}>{inner}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
