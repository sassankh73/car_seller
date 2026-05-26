# Multi-language Support Implementation

## Overview

This document describes the multi-language (i18n) implementation for the AutoStudio AI platform using `next-intl` with Next.js.

## Supported Languages

- **English** (`en`) - Default
- **Swedish** (`sv`)

## Architecture

### File Structure

```
frontend/
├── app/
│   ├── [locale]/                    # Localized routes
│   │   ├── layout.tsx               # Locale-aware layout
│   │   ├── page.tsx                 # Home page (translated)
│   │   ├── select-language/         # Language selection screen
│   │   └── dashboard/
│   │       ├── page.tsx             # Dashboard (translated)
│   │       └── billing/
│   │           └── page.tsx         # Billing page (translated)
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Root redirect
│   └── globals.css                  # Global styles
├── components/
│   ├── LanguageSelector.tsx         # Full-screen language selector
│   └── LanguageSwitcher.tsx         # Dropdown language switcher
├── i18n/
│   ├── request.ts                   # i18n configuration
│   └── utils.ts                     # Utility functions
├── i18n.ts                          # Next-intl plugin config
├── messages/
│   ├── en.json                      # English translations
│   └── sv.json                      # Swedish translations
├── middleware.ts                    # Locale cookie middleware
└── next.config.js                   # Next.js config with i18n
```

## Routing

The platform uses locale-prefixed routing:

- `/en` - English home page
- `/sv` - Swedish home page
- `/en/dashboard` - English dashboard
- `/sv/dashboard` - Swedish dashboard
- `/en/dashboard/billing` - English billing page
- `/sv/dashboard/billing` - Swedish billing page
- `/select-language` - Language selection screen (root)

## Features

### 1. Language Selection Screen

When users first visit the platform, they are redirected to `/select-language` where they can choose their preferred language:
- Beautiful animated UI with Framer Motion
- Large, clear language buttons with flags
- Saves preference to localStorage

### 2. Language Preference Persistence

User language preferences are saved in multiple places:
- **localStorage**: `preferredLocale` key for client-side persistence
- **Cookies**: `NEXT_LOCALE` cookie for server-side rendering
- **User Profile**: Ready for backend integration

### 3. Dynamic Language Switching

Users can switch languages at any time using the language switcher dropdown:
- Located in the top-right corner of pages
- Instant language change without page reload
- Maintains current page context

### 4. Complete UI Translation

All UI elements are translated:
- Landing page (hero, tagline, CTA buttons)
- Dashboard (navigation, upload, studio selection, options)
- Billing page (pricing, usage, FAQ)
- Buttons, menus, and notifications
- Error messages and success states

### 5. SEO-Friendly Routing

- Locale-prefixed URLs for proper SEO indexing
- Server-side rendering with translated metadata
- Static generation for all locale pages

## Usage

### Adding New Translations

1. Add translation keys to both `messages/en.json` and `messages/sv.json`:

```json
{
  "myNewSection": {
    "title": "My New Title",
    "description": "My description"
  }
}
```

2. Use translations in components:

```tsx
import {useTranslations} from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('myNewSection');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Adding New Languages

1. Create a new translation file `messages/{locale}.json`
2. Copy the structure from an existing file
3. Translate all values
4. Add the locale to `i18n/request.ts`:

```ts
export const locales = ['en', 'sv', 'de'] as const;
```

5. Update the middleware to include the new locale
6. Add the language to `LanguageSelector.tsx` and `LanguageSwitcher.tsx`

### Utility Functions

The `i18n/utils.ts` file provides helpful utilities:

```ts
import {
  getPreferredLocale,
  savePreferredLocale,
  getBrowserLocale,
  isValidLocale,
  getLocaleNativeName,
  getLocaleDisplayName,
  getLocaleFlag
} from '@/i18n/utils';
```

## Translation Keys Structure

```
common.*           - Shared/common translations
home.*             - Home page
dashboard.*        - Dashboard page
billing.*          - Billing/Pricing page
language.*         - Language selection
notifications.*    - Toast/notification messages
footer.*           - Footer content
```

## Development

### Running the Development Server

```bash
cd frontend
npm run dev
```

Visit:
- http://localhost:3000 (redirects to language selection)
- http://localhost:3000/en
- http://localhost:3000/sv

### Building for Production

```bash
cd frontend
npm run build
npm start
```

## Technical Details

### Middleware

The middleware (`middleware.ts`) handles:
- Extracting locale from URL pathname
- Setting `NEXT_LOCALE` cookie for SSR
- Allowing next-intl to handle locale routing

### Server Components

All pages use Server Components for initial rendering with translations loaded server-side. Client components use the `useTranslations` hook.

### Client Components

Components that need interactivity (like LanguageSwitcher) are marked with `'use client'` directive.

## Future Enhancements

- RTL language support (Arabic, Hebrew)
- Date/time localization
- Number/currency formatting
- Pluralization rules
- Dynamic content translation from backend
