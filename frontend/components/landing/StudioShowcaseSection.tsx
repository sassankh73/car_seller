"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface Studio {
  key: string;
  name: string;
  preview_image_url: string;
}

export default function StudioShowcaseSection() {
  const t = useTranslations("landing.studios");
  const [studios, setStudios] = useState<Studio[]>([]);

  useEffect(() => {
    const fetchStudios = async () => {
      try {
        const response = await fetch("/api/studio");
        const data: Studio[] = await response.json();
        setStudios(data);
      } catch (error) {
        console.error("Failed to fetch studios:", error);
      }
    };
    fetchStudios();
  }, []);

  if (studios.length === 0) {
    return (
      <section className="py-24 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 mx-auto mb-4 border-b-2 border-indigo-500"></div>
            <p className="text-gray-400">Loading studio templates...</p>
          </div>
        </div>
      </section>
    );
  }

  const studioLabels: Record<string, { name: string; description: string }> = {
    luxury_showroom: {
      name: t("studios.luxuryShowroom.name"),
      description: t("studios.luxuryShowroom.description"),
    },
    white_minimal: {
      name: t("studios.whiteMinimal.name"),
      description: t("studios.whiteMinimal.description"),
    },
    cinematic_dark: {
      name: t("studios.cinematicDark.name"),
      description: t("studios.cinematicDark.description"),
    },
    black_showroom: {
      name: t("studios.blackShowroom.name"),
      description: t("studios.blackShowroom.description"),
    },
    luxury_exhibition: {
      name: t("studios.luxuryExhibition.name"),
      description: t("studios.luxuryExhibition.description"),
    },
    glossy_reflective: {
      name: t("studios.glossyReflective.name"),
      description: t("studios.glossyReflective.description"),
    },
  };

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
          {studios.map((studio, index) => {
            const label = studioLabels[studio.key] || { name: studio.name, description: "" };
            return (
              <motion.div
                key={studio.key}
                className="group relative overflow-hidden rounded-2xl cursor-pointer"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={studio.preview_image_url}
                    alt={studio.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundImage =
                        "linear-gradient(135deg, #1f2937 0%, #374151 100%)";
                    }}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {label.name}
                  </h3>
                  <p className="text-gray-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                    {label.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}