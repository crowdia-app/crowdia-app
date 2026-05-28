import { getLocales } from 'expo-localization';
import it, { Translations } from './it';
import en from './en';

const translations: Record<string, Translations> = { it, en };

function getLocale(): string {
  try {
    const locales = getLocales();
    if (locales && locales.length > 0) {
      const lang = locales[0].languageCode ?? 'it';
      return lang in translations ? lang : 'it';
    }
  } catch {
    // expo-localization may not be available in all environments
  }
  return 'it';
}

export function getTranslations(): Translations {
  return translations[getLocale()] ?? it;
}

export type { Translations };
export { it, en };
