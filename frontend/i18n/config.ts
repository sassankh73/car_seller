export const locales = ["en", "sv"] as const;
export type Locale = (typeof locales)[number];
