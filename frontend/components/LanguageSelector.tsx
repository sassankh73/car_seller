'use client';

import {useRouter} from 'next/navigation';
import {useLocale} from 'next-intl';
import {motion} from 'framer-motion';

interface Language {
  code: 'en' | 'sv';
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Language[] = [
  {code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪'},
  {code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧'}
];

export default function LanguageSelector() {
  const router = useRouter();
  const locale = useLocale();

  const handleLanguageSelect = (langCode: 'en' | 'sv') => {
    // Save to localStorage
    localStorage.setItem('preferredLocale', langCode);

    // Navigate to the selected locale
    router.push(`/${langCode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.6}}
        className="text-center max-w-2xl"
      >
        {/* Logo / App Name */}
        <motion.h1
          className="text-5xl md:text-6xl font-bold text-white mb-4"
          initial={{opacity: 0, y: -20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, delay: 0.2}}
        >
          AutoStudio AI
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-gray-300 mb-12"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{duration: 0.6, delay: 0.4}}
        >
          Transform your mobile car photos into premium studio shots instantly
        </motion.p>

        {/* Language Selection */}
        <motion.div
          initial={{opacity: 0, y: 20}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.6, delay: 0.6}}
          className="mb-8"
        >
          <h2 className="text-2xl font-semibold text-white mb-6">
            Select your language / Välj ditt språk
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            {languages.map((lang, index) => (
              <motion.button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  locale === lang.code
                    ? 'border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/30'
                    : 'border-gray-600 bg-gray-800 hover:border-indigo-400 hover:bg-gray-700'
                }`}
                initial={{opacity: 0, scale: 0.9}}
                animate={{opacity: 1, scale: 1}}
                transition={{duration: 0.4, delay: 0.8 + index * 0.1}}
                whileHover={{scale: 1.02}}
                whileTap={{scale: 0.98}}
              >
                <div className="text-4xl mb-3">{lang.flag}</div>
                <div className="text-xl font-semibold text-white">{lang.nativeName}</div>
                <div className="text-sm text-gray-400 mt-1">{lang.name}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Info text */}
        <motion.p
          className="text-gray-500 text-sm"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{duration: 0.6, delay: 1}}
        >
          Your language preference will be saved for future visits
        </motion.p>
      </motion.div>
    </div>
  );
}
