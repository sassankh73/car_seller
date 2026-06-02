"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function FeaturesSection() {
  const t = useTranslations("landing.features");

  const features = [
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: t("items.aiRemoval.title"),
      description: t("items.aiRemoval.description"),
      accent: "primary",
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      title: t("items.virtualStudios.title"),
      description: t("items.virtualStudios.description"),
      accent: "secondary",
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: t("items.realisticShadows.title"),
      description: t("items.realisticShadows.description"),
      accent: "gold",
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      title: t("items.hdExport.title"),
      description: t("items.hdExport.description"),
      accent: "primary",
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      title: t("items.logoBranding.title"),
      description: t("items.logoBranding.description"),
      accent: "secondary",
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: t("items.fastGeneration.title"),
      description: t("items.fastGeneration.description"),
      accent: "gold",
    },
  ];

  const getAccentColors = (accent: string) => {
    switch (accent) {
      case "primary":
        return {
          bg: "bg-primary-50",
          icon: "text-primary-500",
          border: "border-primary-100",
        };
      case "secondary":
        return {
          bg: "bg-secondary-50",
          icon: "text-secondary-500",
          border: "border-secondary-100",
        };
      case "gold":
        return {
          bg: "bg-accent-goldLight/30",
          icon: "text-accent-gold",
          border: "border-accent-goldLight",
        };
      default:
        return {
          bg: "bg-primary-50",
          icon: "text-primary-500",
          border: "border-primary-100",
        };
    }
  };

  return (
    <section className="py-24 md:py-32 bg-surface-warm">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-graphite-800 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-graphite-500 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
          <div className="section-divider mt-6" />
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const colors = getAccentColors(feature.accent);
            return (
              <motion.div
                key={index}
                className={`card-premium bg-white rounded-2xl p-8 border ${colors.border} shadow-card`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${colors.bg} mb-5`}>
                  <div className={colors.icon}>
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-graphite-800 mb-3">
                  {feature.title}
                </h3>
                <p className="text-graphite-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}