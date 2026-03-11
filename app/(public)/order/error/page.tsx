import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function OrderErrorPage({ searchParams }: any) {
    const t = await getTranslations('orderError')

    const msg =
        searchParams?.msg ||
        t('paymentFailed')

    return (
        <main className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-md p-8 w-full border border-gray-200 dark:border-zinc-800">
                <div className="flex justify-center mb-4">
                    <span className="text-5xl">❌</span>
                </div>

                <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-3">
                    {t('title')}
                </h1>

                <p className="text-gray-600 dark:text-zinc-300 mb-6">
                    {msg}
                </p>

                <Link
                    href="/"
                    className="inline-block rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 transition"
                >
                    {t('backToStore')}
                </Link>

                <div className="mt-3">
                    <Link
                        href="/checkout"
                        className="inline-block text-sm text-gray-600 dark:text-zinc-400 hover:underline"
                    >
                        {t('retryCheckout')}
                    </Link>
                </div>
            </div>
        </main>
    )
}