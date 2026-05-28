import { getTranslations, Translations } from '@/locales';

/**
 * Returns the translation object for the current device locale.
 * Defaults to Italian (primary market). Falls back to Italian for any
 * unsupported locale.
 */
export function useTranslation(): Translations {
  return getTranslations();
}
