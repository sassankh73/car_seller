/**
 * Returns the BCP 47 locale string for number/date formatting based on the UI locale.
 */
export function toFormatLocale(locale: string): string {
  return locale === "sv" ? "sv-SE" : "en-US";
}

/**
 * Format a number using the UI locale's number conventions.
 */
export function formatLocaleNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(toFormatLocale(locale), options);
}

/**
 * Format a date string using the UI locale's date conventions.
 */
export function formatLocaleDate(
  locale: string,
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(date).toLocaleDateString(toFormatLocale(locale), options);
}

/**
 * Format a datetime string using the UI locale's datetime conventions.
 */
export function formatLocaleDateTime(
  locale: string,
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(date).toLocaleString(toFormatLocale(locale), options);
}
