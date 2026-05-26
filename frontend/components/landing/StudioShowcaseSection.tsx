"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function StudioShowcaseSection() {
  const t = useTranslations("landing.studios");

  const studios = [
    {
      name: t("studios.luxuryShowroom.name"),
      description: t("studios.luxuryShowroom.description"),
      image:
        "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: t("studios.whiteMinimal.name"),
      description: t("studios.whiteMinimal.description"),
      image:
        "https://images.unsplash.com/photo-1590674899505-1c5c41951f89?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: t("studios.cinematicDark.name"),
      description: t("studios.cinematicDark.description"),
      image:
        "https://images.unsplash.com/photo-1601362840469-51e4d8d58784?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: t("studios.blackShowroom.name"),
      description: t("studios.blackShowroom.description"),
      image:
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: t("studios.luxuryExhibition.name"),
      description: t("studios.luxuryExhibition.description"),
      image:
        "https://images.unsplash.com/photo-1563720223185-11003d516934?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: t("studios.glossyReflective.name"),
      description: t("studios.glossyReflective.description"),
      image:
        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    },
  ];

  return (
    <section className="py-24 bg-gray-900">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {studios.map((studio, index) => (
            <motion.div
              key={index}
              className="group relative overflow-hidden rounded-2xl cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={studio.image}
                  alt={studio.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {studio.name}
                </h3>
                <p className="text-gray-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                  {studio.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
