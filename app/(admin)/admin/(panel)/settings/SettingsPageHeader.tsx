'use client'

import { useTranslations } from 'next-intl'

export default function SettingsPageHeader() {
  const t = useTranslations('adminSettings')

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        {t('pageTitle')}
      </h1>

      <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
        {t('pageDescription')}
      </p>
    </>
  )
}