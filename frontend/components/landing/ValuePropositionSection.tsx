"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function ValuePropositionSection() {
  const t = useTranslations("landing.valueProp");

  const values = [
    {
      number: "01",
      title: t("items.upload.title"),
      description: t("items.upload.description"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      number: "02",
      title: t("items.studios.title"),
      description: t("items.studios.description"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      number: "03",
      title: t("items.download.title"),
      description: t("items.download.description"),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
  ];

  const features = [
    {
      title: t("items.backgroundRemoval.title"),
      description: t("items.backgroundRemoval.description"),
    },
    {
      title: t("items.realisticShadows.title"),
      description: t("items.realisticShadows.description"),
    },
    {
      title: t("items.hdExport.title"),
      description: t("items.hdExport.description"),
    },
  ];

  return (
    <section className="py-32 md:py-40 lg:py-48 bg-white">
      <div className="container mx-auto px-6">
        {/* Section header - BMW style */}
        <motion.div
          className="mb-24 md:mb-32"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-sm tracking-[0.3em] uppercase text-graphite-400 mb-4">
            {t("eyebrow")}
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-graphite-800 leading-tight max-w-3xl">
            {t("title")}
          </h2>
        </motion.div>

        {/* Three-step process - clean, typography-driven */}
        <div className="grid md:grid-cols-3 gap-16 md:gap-20 mb-32 md:mb-40">
          {values.map((item, index) => (
            <motion.div
              key={item.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-medium text-graphite-300 tracking-wider">{item.number}</span>
                <div className="h-[1px] flex-1 bg-graphite-200" />
                <div className="text-graphite-800">
                  {item.icon}
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-graphite-800 mb-3">
                {item.title}
              </h3>
              <p className="text-graphite-500 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Feature highlights - horizontal line layout */}
        <div className="border-t border-graphite-200 pt-20 md:pt-24">
          <div className="grid md:grid-cols-3 gap-12 md:gap-16">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <h3 className="text-lg font-semibold text-graphite-800 mb-2">
                  {feature.title}
                </h3>
                <p className="text-graphite-500 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}