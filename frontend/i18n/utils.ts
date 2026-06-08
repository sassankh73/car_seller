/**
 * Utility functions for managing language preferences
 * These functions work with localStorage and cookies to persist user language choice
 */

export const SUPPORTED_LOCALES = ['sv', 'en'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: Locale = 'sv';

/**
 * Get the user's preferred locale from localStorage
 */
export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  try {
    const stored = localStorage.getItem('preferredLocale');
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch (error) {
    console.error('Failed to get preferred locale from localStorage:', error);
  }

  return DEFAULT_LOCALE;
}

/**
 * Save the user's preferred locale to localStorage
 */
export function savePreferredLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('preferredLocale', locale);
  } catch (error) {
    console.error('Failed to save preferred locale to localStorage:', error);
  }
}

/**
 * Get locale from browser's navigator language
 */
export function getBrowserLocale(): Locale | null {
  if (typeof window === 'undefined' || !navigator.language) {
    return null;
  }

  const browserLang = navigator.language.toLowerCase();

  // Check for exact match
  if (SUPPORTED_LOCALES.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  // Check for language code match (e.g., 'en-US' -> 'en')
  const langCode = browserLang.split('-')[0] as Locale;
  if (SUPPORTED_LOCALES.includes(langCode)) {
    return langCode;
  }

  return null;
}

/**
 * Validate if a locale string is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

/**
 * Get the locale name in its native language
 */
export function getLocaleNativeName(locale: Locale): string {
  const names: Record<Locale, string> = {
    sv: 'Svenska',
    en: 'English'
  };
  return names[locale];
}

/**
 * Get the locale display name
 */
export function getLocaleDisplayName(locale: Locale): string {
  const names: Record<Locale, string> = {
    sv: 'Swedish',
    en: 'English'
  };
  return names[locale];
}

/**
 * Get locale flag emoji
 */
export function getLocaleFlag(locale: Locale): string {
  const flags: Record<Locale, string> = {
    sv: '🇸🇪',
    en: '🇬🇧'
  };
  return flags[locale];
}
