import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function OrderErrorPage({ searchParams }: any) {
    const msg =
        searchParams?.msg ||
        'Il pagamento non è andato a buon fine. Riprova o scegli un altro metodo.'

    return (
        <main className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-white shadow-md p-8 w-full">
                <div className="flex justify-center mb-4">
                    <span className="text-5xl">❌</span>
                </div>
                <h1 className="text-2xl font-bold text-red-700 mb-3">Errore nell’ordine</h1>
                <p className="text-gray-600 mb-6">{msg}</p>

                <Link
                    href="/"
                    className="inline-block rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 transition"
                >
                    Torna allo store
                </Link>

                <div className="mt-3">
                    <Link
                        href="/checkout"
                        className="inline-block text-sm text-gray-600 hover:underline"
                    >
                        Riprova il checkout
                    </Link>
                </div>
            </div>
        </main>
    )
}
