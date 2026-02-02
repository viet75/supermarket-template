import Header from '@/components/Header'
import { getStoreSettings } from '@/lib/getStoreSettings'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
    const s = await getStoreSettings()
    const store_name = s?.store_name?.trim() || ''
    const address = s?.address?.trim() || ''
    const email = s?.email?.trim() || ''
    const phone = s?.phone?.trim() || ''
    const opening_hours = s?.opening_hours?.trim() || ''
    const maps_link = s?.maps_link?.trim() || ''
    const hasContacts = !!(store_name || address || email || phone || opening_hours || maps_link)

    return (
        <>
            <Header />
            <main className="min-h-screen w-full mx-auto px-3 md:px-4 lg:px-6 pb-24 md:pb-10 bg-white dark:bg-gray-900 transition-colors">
                {children}
            </main>
            {hasContacts && (
                <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:py-8 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        {store_name && <h3 className="font-semibold text-gray-900 dark:text-white">{store_name}</h3>}
                        {address && <div>📍 {address}</div>}
                        {phone && <div>📞 {phone}</div>}
                        {email && <div>✉️ {email}</div>}
                        {opening_hours && <div>🕒 {opening_hours}</div>}
                        {maps_link && (
                            <a href={maps_link} target="_blank" rel="noreferrer" className="inline-block text-green-600 dark:text-green-400 hover:underline">
                                Apri su Google Maps
                            </a>
                        )}
                    </div>
                </footer>
            )}
        </>
    )
}
