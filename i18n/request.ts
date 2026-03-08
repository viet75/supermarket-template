import {getRequestConfig} from 'next-intl/server'
import {hasLocale} from 'next-intl'
import {routing} from '@/i18n/routing'

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  const messages =
    locale === 'en'
      ? (await import('@/messages/en.json')).default
      : (await import('@/messages/it.json')).default

  return {
    locale,
    messages
  }
})
