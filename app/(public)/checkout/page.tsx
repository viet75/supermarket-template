import { getStoreSettings } from '@/lib/getStoreSettings'
import CheckoutForm from './CheckoutForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CheckoutPage() {
    const settings = await getStoreSettings() // legge da store_settings lato server

    return (
        <main className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Checkout</h1>

            {/* 🔹 Pulsante per tornare al negozio */}
            <Link
                href="/"
                className="inline-flex items-center gap-2 mb-6 px-5 py-3 rounded-lg 
                           bg-green-600 hover:bg-green-700 
                           text-white text-sm font-medium 
                           transition-colors shadow-sm"
            >
                🏪 Torna al negozio
            </Link>

            {!settings ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                    Non è stato possibile caricare le impostazioni del negozio.
                </p>
            ) : (
                // 👇 Montiamo il Client Component passando i dati
                <CheckoutForm settings={settings} />
            )}
        </main>
    )
}
