"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function TestimonialsSection() {
  const t = useTranslations("landing.testimonials");

  const testimonials = [
    {
      quote: t("items.first.quote"),
      author: t("items.first.author"),
      role: t("items.first.role"),
      location: t("items.first.location"),
    },
    {
      quote: t("items.second.quote"),
      author: t("items.second.author"),
      role: t("items.second.role"),
      location: t("items.second.location"),
    },
    {
      quote: t("items.third.quote"),
      author: t("items.third.author"),
      role: t("items.third.role"),
      location: t("items.third.location"),
    },
  ];

  const metrics = [
    { value: "10,000+", label: t("metrics.photosProcessed") },
    { value: "500+", label: t("metrics.dealerships") },
    { value: "99.8%", label: t("metrics.satisfaction") },
    { value: "<2s", label: t("metrics.avgProcessing") },
  ];

  return (
    <section className="py-32 md:py-40 lg:py-48 bg-surface-warm">
      <div className="container mx-auto px-6">
        {/* Trust metrics row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-24 md:mb-32"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-graphite-800 mb-2">
                {metric.value}
              </div>
              <div className="text-sm text-graphite-400 tracking-wide">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <div className="border-t border-graphite-200 mb-20 md:mb-24" />

        {/* Section header */}
        <motion.div
          className="mb-16 md:mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-sm tracking-[0.3em] uppercase text-graphite-400 mb-4">
            {t("title")}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-graphite-800 leading-tight max-w-xl">
            {t("subtitle")}
          </h2>
        </motion.div>

        {/* Testimonials - clean, editorial layout */}
        <div className="grid md:grid-cols-3 gap-12 md:gap-16">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              {/* Large quotation mark */}
              <div className="text-5xl font-serif text-graphite-200 leading-none mb-6 select-none">
                &ldquo;
              </div>

              <p className="text-graphite-600 leading-relaxed mb-8 text-base">
                {testimonial.quote}
              </p>

              <div>
                <p className="font-semibold text-graphite-800">
                  {testimonial.author}
                </p>
                <p className="text-sm text-graphite-400 mt-1">
                  {testimonial.role}
                </p>
                <p className="text-sm text-graphite-400 mt-0.5">
                  {testimonial.location}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}