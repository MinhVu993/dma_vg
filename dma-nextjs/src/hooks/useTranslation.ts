'use client'

import { useSession } from '@/context/SessionContext'
import { dictionaries } from '@/locales'

export function useTranslation() {
  const { locale, setLocale } = useSession()
  const t = dictionaries[locale] || dictionaries.vi
  return { t, locale, setLocale }
}

