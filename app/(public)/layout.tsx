import Header from '@/components/Header'
import PublicScrollShell from '@/components/PublicScrollShell'
import { getStoreSettings } from '@/lib/getStoreSettings'
import ScrollToTopOnRouteChange from './ScrollToTopOnRouteChange'
import { getTranslations } from 'next-intl/server'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
    const t = await getTranslations('footer')
    const s = await getStoreSettings()
    const store_name = s?.store_name?.trim() || ''
    const address = s?.address?.trim() || ''
    const email = s?.email?.trim() || ''
    const phone = s?.phone?.trim() || ''
    const opening_hours = s?.opening_hours?.trim() || ''
    const maps_link = s?.maps_link?.trim() || ''
    const social_links = (s?.social_links && typeof s.social_links === 'object') ? s.social_links as Record<string, string> : {}
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
                            {opening_hours && (
                                <div className="flex items-start gap-2">
                                    <span className="mt-1" aria-hidden>🕒</span>
                                    <p className="whitespace-pre-line leading-relaxed text-gray-600 dark:text-zinc-400">
                                        {opening_hours}
                                    </p>
                                </div>
                            )}
                            {maps_link && (
                                <a href={maps_link} target="_blank" rel="noreferrer" className="inline-block text-green-600 dark:text-green-400 hover:underline">
                                    {t('openMaps')}
                                </a>
                            )}
                            {Object.keys(social_links).length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                    <span className="text-gray-600 dark:text-zinc-400">{t('followUs')}</span>
                                    {Object.entries(social_links).map(([key, href]) => {
                                        const url = (key === 'whatsapp' && href && !href.startsWith('http'))
                                            ? `https://wa.me/${href.replace(/\D/g, '')}`
                                            : (href?.trim() || '')
                                        if (!url) return null
                                        const labels: Record<string, string> = {
                                            instagram: t('instagram'),
                                            facebook: t('facebook'),
                                            whatsapp: t('whatsapp'),
                                            tiktok: t('tiktok'),
                                            youtube: t('youtube'),
                                            website: t('website')
                                        }
                                        return (
                                            <a key={key} href={url} target="_blank" rel="noreferrer noopener" className="text-green-600 dark:text-green-400 hover:underline text-sm">
                                                {labels[key] ?? key}
                                            </a>
                                        )
                                    })}
                                </div>
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
