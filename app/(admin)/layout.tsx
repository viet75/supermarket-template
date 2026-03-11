// Admin layout: no public Header, only admin sidebar + content

import { NextIntlClientProvider } from 'next-intl'
import { cookies, headers } from 'next/headers'

export default async function AdminGroupLayout({
  children
}: {
  children: React.ReactNode
}) {

  const cookieStore = await cookies()
  const headersList = await headers()

  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value
  const acceptLanguage = headersList.get('accept-language') || ''

  const locale =
    localeCookie ??
    (acceptLanguage.startsWith('en') ? 'en' : 'it')

  const messages =
    locale === 'en'
      ? (await import('@/messages/en.json')).default
      : (await import('@/messages/it.json')).default

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}