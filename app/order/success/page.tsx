// app/order/success/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OrderSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string }>
}) {
    const { id } = await searchParams

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
                {id ? (
                    <p className="text-sm text-gray-500 mb-6">
                        ID ordine: <span className="font-mono">{id}</span>
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
