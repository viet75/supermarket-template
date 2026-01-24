// app/order/success/page.tsx
import Link from 'next/link'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export default async function OrderSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string; session_id?: string }>
}) {
    const params = await searchParams
    const { id, session_id } = params

    // Recupera orderId da parametri o da Stripe session (solo per visualizzazione)
    let orderId = id
    if (!orderId && session_id) {
        try {
            const stripe = getStripe()
            const session = await stripe.checkout.sessions.retrieve(session_id)
            orderId = session.metadata?.order_id || session.metadata?.orderId || undefined
        } catch (err) {
            // Ignora errori - non bloccare la visualizzazione della pagina
            console.error('Errore recupero session Stripe:', err)
        }
    }

    // NOTA: Lo stock è già riservato alla creazione ordine (reserveOrderStock).
    // Non serve più scalare stock qui - il webhook Stripe gestisce payment_status.

    return (
        <main className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-white shadow-md p-8 w-full">
                <div className="flex justify-center mb-4">
                    <span className="text-5xl">✅</span>
                </div>
                <h1 className="text-2xl font-bold text-green-700 mb-3">Ordine confermato</h1>
                <p className="text-gray-600 mb-6">
                    Grazie! Il tuo ordine è stato ricevuto correttamente.
                </p>
                {orderId ? (
                    <p className="text-sm text-gray-500 mb-6">
                        ID ordine: <span className="font-mono">{orderId}</span>
                    </p>
                ) : null}

                <Link
                    href="/"
                    className="inline-block rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 transition"
                >
                    Torna allo store
                </Link>
            </div>
        </main>
    )
}
