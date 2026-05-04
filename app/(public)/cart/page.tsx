'use client'

import clsx from 'clsx'
import { useCartStore } from '@/stores/cartStore'
import { formatPrice } from '@/lib/pricing'
import { formatQty } from '@/lib/qty'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useStoreDeliveryMinSettings } from '@/hooks/useStoreDeliveryMinSettings'
import { deliveryMinOrderStatus } from '@/lib/minOrderDelivery'

export default function CartPage() {
    const locale = useLocale()
    const { items, removeItem, clear, total } = useCartStore()
    const t = useTranslations('cartPage')
    const tCart = useTranslations('cart')
    const deliverySettings = useStoreDeliveryMinSettings()
    const subtotal = total()
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

    const showMinProgress =
        isMinActive &&
        deliverySettings?.delivery_enabled === true &&
        deliveryMinOrderAmount != null &&
        deliveryMinOrderAmount > 0

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <p className="text-gray-600 dark:text-zinc-300 mb-6">{t('empty')}</p>

                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg 
                       bg-green-600 hover:bg-green-700 
                       text-white text-sm font-medium 
                       transition-colors shadow-sm"
                    >
                        🏪 {t('backToStore')}
                    </Link>
                </div>
            ) : (

                <div className="space-y-6">
                    {items.map((i) => (
                        <div
                            key={i.id}
                            className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 pb-4"
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
                                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                                        {formatQty(
                                            Number(i.qty),
                                            i.unit ?? 'per_unit',
                                            i.qty_step,
                                            locale === 'en' ? 'en' : 'it'
                                        )}
                                    </p>
                                    <p className="text-sm font-medium text-gray-700">
                                        {formatPrice((i.salePrice && i.salePrice < i.price ? i.salePrice : i.price) * i.qty)}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => removeItem(i.id)}
                                className="text-red-500 hover:text-red-700 text-lg"
                                aria-label={t('remove')}
                            >
                                ❌
                            </button>
                        </div>
                    ))}

                    <div className="flex justify-between items-center mt-6">
                        <button
                            onClick={clear}
                            className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-300 px-4 py-2 rounded"
                        >
                            {t('clear')}
                        </button>
                        <p className="text-lg font-semibold">
                            {t('total')}: {formatPrice(subtotal)}
                        </p>
                    </div>

                    {minOrderUx.active && (
                        <div className="mt-2 text-sm">
                            {!minOrderUx.reached ? (
                                <p className="text-amber-600 dark:text-amber-500">
                                    {tCart('minOrder.missing', {
                                        amount: minOrderUx.missing.toFixed(2),
                                    })}
                                </p>
                            ) : (
                                <p className="text-emerald-600 dark:text-emerald-500">
                                    {tCart('minOrder.reached')}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col items-stretch sm:items-end text-right">
                        {showMinProgress && (
                            <div className="mb-3 w-full sm:ml-auto sm:max-w-sm">
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                                    <div
                                        className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                                        style={{
                                            width: `${Math.min(
                                                (subtotal / deliveryMinOrderAmount) * 100,
                                                100
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        {isDeliveryBlocked ? (
                            <button
                                type="button"
                                disabled
                                title={tCart('checkoutBlockedMinOrder')}
                                aria-label={tCart('checkoutBlockedMinOrder')}
                                className={clsx(
                                    'inline-flex justify-center rounded px-6 py-2.5 text-sm font-semibold text-white transition-colors sm:inline-block',
                                    'cursor-not-allowed bg-zinc-400 opacity-90 dark:bg-zinc-600'
                                )}
                            >
                                {t('checkout')}
                            </button>
                        ) : (
                            <Link
                                href="/checkout"
                                className="inline-flex justify-center rounded bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 sm:inline-block"
                            >
                                {t('checkout')}
                            </Link>
                        )}
                        {isDeliveryBlocked && (
                            <p className="mt-2 text-left text-sm text-amber-600 dark:text-amber-400 sm:text-right">
                                {tCart('checkoutBlockedMinOrder')}
                            </p>
                        )}
                    </div>
                    {/* ✅ Back to store button (responsive + dark mode) */}
                    <div className="mt-4 text-center">
                        <Link
                            href="/"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 
               text-sm font-medium text-gray-700 dark:text-zinc-300 
               hover:text-green-600 transition-colors py-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {t('continueShopping')}
                        </Link>
                    </div>


                </div>
            )}
        </div>
    )
}
