"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";

export default function FAQSection() {
  const t = useTranslations("landing.faq");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: t("items.generationTime.question"),
      answer: t("items.generationTime.answer"),
    },
    {
      question: t("items.phonePhotos.question"),
      answer: t("items.phonePhotos.answer"),
    },
    {
      question: t("items.colorAccuracy.question"),
      answer: t("items.colorAccuracy.answer"),
    },
    {
      question: t("items.logoBranding.question"),
      answer: t("items.logoBranding.answer"),
    },
    {
      question: t("items.cancelSubscription.question"),
      answer: t("items.cancelSubscription.answer"),
    },
    {
      question: t("items.commercialUse.question"),
      answer: t("items.commercialUse.answer"),
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
          <div className="section-divider mt-6" />
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-xl border border-graphite-200 overflow-hidden shadow-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-graphite-50 transition-colors duration-200"
              >
                <span className="text-graphite-800 font-medium pr-4">
                  {faq.question}
                </span>
                <motion.svg
                  className="w-5 h-5 text-primary-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </motion.svg>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-graphite-500 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}