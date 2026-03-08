import {NextIntlClientProvider, hasLocale} from 'next-intl'
import {setRequestLocale} from 'next-intl/server'
import {notFound} from 'next/navigation'
import {routing} from '@/i18n/routing'

type Props = {
  children: React.ReactNode
  params: Promise<{locale: string}>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)

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
