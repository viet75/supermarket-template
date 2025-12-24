// app/order/success/page.tsx
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { scaleStockForOrder } from '@/lib/scaleStockForOrder'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export default async function OrderSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string; session_id?: string }>
}) {
    const params = await searchParams
    const { id, session_id } = params

    // Fallback: verifica e scala lo stock se necessario
    // Questo assicura che lo stock venga scalato anche se il webhook non funziona
    let orderId = id
    if (!orderId && session_id) {
        try {
            const stripe = getStripe()
            const session = await stripe.checkout.sessions.retrieve(session_id)
            orderId = session.metadata?.order_id || session.metadata?.orderId || null

            // Se abbiamo l'orderId, verifica se lo stock deve essere scalato
            if (orderId) {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

                if (supabaseUrl && supabaseServiceKey) {
                    const supabase = createClient(supabaseUrl, supabaseServiceKey)
                    const { data: order } = await supabase
                        .from('orders')
                        .select('id, payment_status, stock_scaled')
                        .eq('id', orderId)
                        .single()

                    // Se l'ordine è paid ma lo stock non è scalato, scalalo
                    if (order && order.payment_status === 'paid' && !order.stock_scaled) {
                        await scaleStockForOrder(orderId)
                    }
                }
            }
        } catch (err) {
            // Ignora errori - non bloccare la visualizzazione della pagina
            console.error('Errore verifica/scalaggio stock:', err)
        }
    }

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
