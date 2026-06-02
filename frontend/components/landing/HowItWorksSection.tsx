"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function HowItWorksSection() {
  const t = useTranslations("landing.howItWorks");

  const steps = [
    {
      number: "01",
      key: "upload",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      number: "02",
      key: "choose",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      number: "03",
      key: "download",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
    },
  ];

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

        <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.key}
              className="relative text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary-200 to-secondary-200" />
              )}

              {/* Step number + icon */}
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-card border border-graphite-100 mb-6">
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center">
                  {step.number}
                </div>
                <div className="text-primary-500">
                  {step.icon}
                </div>
              </div>

              <h3 className="text-xl font-semibold text-graphite-800 mb-3">
                {t(`steps.${step.key}.title`)}
              </h3>
              <p className="text-graphite-500 leading-relaxed max-w-xs mx-auto">
                {t(`steps.${step.key}.description`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}