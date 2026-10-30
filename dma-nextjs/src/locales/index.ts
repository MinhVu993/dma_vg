import { vi, TranslationDictionary } from './vi'
import { en } from './en'
import { cn } from './cn'

export type LocaleCode = 'vi' | 'en' | 'cn'

export const dictionaries: Record<LocaleCode, TranslationDictionary> = {
  vi,
  en,
  cn,
}

export { vi, en, cn }
export type { TranslationDictionary }

