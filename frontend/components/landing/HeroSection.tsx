"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";

export default function HeroSection() {
  const t = useTranslations("landing.hero");
  const locale = useLocale();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-graphite-900">
      {/* Background image - visible and natural */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1920&q=80"
          alt="Luxury car in showroom"
          className="w-full h-full object-cover"
        />
        {/* Very light dark overlay for text readability only */}
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Content - centered, BMW-style single column */}
      <div className="relative z-10 container mx-auto px-6 py-32 md:py-40">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
              {t("headline")}
            </h1>
          </motion.div>

          <motion.p
            className="text-lg md:text-xl text-white/80 mb-12 leading-relaxed max-w-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {t("subheadline")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center gap-8"
          >
            <Link
              href={`/${locale}/auth/register`}
              className="px-10 py-4 bg-white text-graphite-800 font-semibold hover:bg-graphite-100 transition-all duration-300 text-base tracking-wide"
            >
              {t("startFreeTrial")}
            </Link>
            <Link
              href={`/${locale}/auth/register`}
              className="px-10 py-4 border border-white/40 text-white font-medium hover:bg-white/10 transition-all duration-300 text-base tracking-wide"
            >
              {t("uploadPhoto")}
            </Link>
          </motion.div>

          {/* Trust badge - minimal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-16"
          >
            <p className="text-sm text-white/50 tracking-widest uppercase">
              {t("trustedBy")}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade to white */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent z-10" />
    </section>
  );
}