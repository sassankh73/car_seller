"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";

export default function CTASection() {
  const t = useTranslations("landing.cta");
  const locale = useLocale();

  return (
    <section className="relative py-32 md:py-40 lg:py-48 bg-graphite-900 overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)", }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-white/60 mb-12 leading-relaxed">
            {t("subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${locale}/auth/register`}
              className="px-10 py-4 bg-white text-graphite-800 font-semibold hover:bg-graphite-100 transition-all duration-300 text-base tracking-wide"
            >
              {t("button")}
            </Link>
          </div>
          <p className="text-sm text-white/40 mt-6">{t("noCreditCard")}</p>
        </motion.div>
      </div>
    </section>
  );
}