import Header from '@/components/Header'
import PublicScrollShell from '@/components/PublicScrollShell'
import { getStoreSettings } from '@/lib/getStoreSettings'
import ScrollToTopOnRouteChange from './ScrollToTopOnRouteChange'

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
        <PublicScrollShell
            header={<Header />}
            footer={
                hasContacts ? (
                    <footer className="border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60">
                        <div className="mx-auto max-w-screen-2xl px-4 py-6 md:py-8 space-y-2 text-sm text-gray-600 dark:text-zinc-300">
                            {store_name && <h3 className="font-semibold text-gray-900 dark:text-zinc-100">{store_name}</h3>}
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
                ) : null
            }
        >
            <main className="min-h-screen w-full mx-auto px-3 md:px-4 lg:px-6 pb-24 md:pb-10 bg-white dark:bg-zinc-900 transition-colors">
                <ScrollToTopOnRouteChange />
                {children}
            </main>
        </PublicScrollShell>
    )
}
