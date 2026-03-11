// app/order/success/page.tsx
import Link from 'next/link'
import { getStripe } from '@/lib/stripe'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function OrderSuccessPage({

    searchParams,
}: {
    searchParams: Promise<{ id?: string; session_id?: string }>
}) {
    const params = await searchParams
    const { id, session_id } = params
    const t = await getTranslations('orderSuccess')

    // Retrieve orderId from parameters or from Stripe session (only for display)
    let orderId = id
    if (!orderId && session_id) {
        try {
            const stripe = getStripe()
            const session = await stripe.checkout.sessions.retrieve(session_id)
            orderId = session.metadata?.order_id || session.metadata?.orderId || undefined
        } catch (err) {
            // Ignore errors - do not block the display of the page 
            console.error('Errore recupero session Stripe:', err)
        }
    }

    // NOTE: The stock is already reserved at order creation (reserveOrderStock).
    // No need to scale stock here - the Stripe webhook manages payment_status.

    return (
        <main className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-md p-8 w-full border border-gray-200 dark:border-zinc-800">
                <div className="flex justify-center mb-4">
                    <span className="text-5xl">✅</span>
                </div>
                <h1 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-3">
                    {t('title')}
                </h1>
                <p className="text-gray-600 dark:text-zinc-300 mb-6">
                    {t('message')}
                </p>
                {orderId ? (
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
                        {t('orderId')}: <span className="font-mono">{orderId}</span>
                    </p>
                ) : null}

                <Link
                    href="/"
                    className="inline-block rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 transition"
                >
                    {t('backToStore')}
                </Link>
            </div>
        </main>
    )
}
