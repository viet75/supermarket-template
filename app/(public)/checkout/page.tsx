import { getStoreSettings } from '@/lib/getStoreSettings'
import CheckoutForm from './CheckoutForm'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'


export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CheckoutPage() {
    const t = await getTranslations('checkout')
    const settings = await getStoreSettings() // read from server-side store_settings

    return (
        <main className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-zinc-100">
                {t('title')}
            </h1>

            {/* 🔹 Button to return to the store */}
            <Link
                href="/"
                className="inline-flex items-center gap-2 mb-6 px-5 py-3 rounded-lg 
                           bg-green-600 hover:bg-green-700 
                           text-white text-sm font-medium 
                           transition-colors shadow-sm"
            >
                🏪 {t('backToStore')}
            </Link>

            {!settings ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {t('settingsError')}
                </p>
            ) : (
                // 👇 Mount the Client Component passing the data
                <CheckoutForm settings={settings} />
            )}
        </main>
    )
}
