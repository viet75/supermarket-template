export const locales = ['it', 'en'] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'it'

export function isValidLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale)
}
