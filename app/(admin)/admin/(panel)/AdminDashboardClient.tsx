'use client'

import Link from 'next/link'
import { ShoppingCart, Package, Layers, Truck } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AdminDashboardClient() {
  const t = useTranslations('adminDashboard')

  const cards = [
    {
      href: '/admin/orders',
      icon: ShoppingCart,
      label: t('orders'),
      subtitle: t('ordersSubtitle'),
    },
    {
      href: '/admin/products',
      icon: Package,
      label: t('products'),
      subtitle: t('productsSubtitle'),
    },
    {
      href: '/admin/categories',
      icon: Layers,
      label: t('categories'),
      subtitle: t('categoriesSubtitle'),
    },
    {
      href: '/admin/settings/delivery',
      icon: Truck,
      label: t('delivery'),
      subtitle: t('deliverySubtitle'),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
          {t('title')}
        </h1>
        <p className="text-gray-600 dark:text-zinc-400 mt-1">
          {t('description')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group relative bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6 hover:shadow-lg hover:border-green-500 dark:hover:border-green-600 transition-all duration-200"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <Icon className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    {card.label}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}