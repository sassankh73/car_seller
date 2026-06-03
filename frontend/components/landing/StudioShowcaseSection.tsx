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
      <section className="py-32 md:py-40 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 mx-auto mb-4 border-b-2 border-graphite-800"></div>
            <p className="text-graphite-400 text-sm tracking-wide">Loading studio templates...</p>
          </div>
        </div>
      </section>
    );
  }

  const studioLabels: Record<string, { name: string; description: string }> = {
    white_corner_light_epoxy: {
      name: t("studios.whiteCornerLightEpoxy.name"),
      description: t("studios.whiteCornerLightEpoxy.description"),
    },
    white_corner_ceramic_tile: {
      name: t("studios.whiteCornerCeramicTile.name"),
      description: t("studios.whiteCornerCeramicTile.description"),
    },
    light_gray_corner_medium_epoxy: {
      name: t("studios.lightGrayCornerMediumEpoxy.name"),
      description: t("studios.lightGrayCornerMediumEpoxy.description"),
    },
    dark_gray_corner_concrete: {
      name: t("studios.darkGrayCornerConcrete.name"),
      description: t("studios.darkGrayCornerConcrete.description"),
    },
    black_corner_dark_epoxy: {
      name: t("studios.blackCornerDarkEpoxy.name"),
      description: t("studios.blackCornerDarkEpoxy.description"),
    },
    commercial_showroom_tile: {
      name: t("studios.commercialShowroomTile.name"),
      description: t("studios.commercialShowroomTile.description"),
    },
    industrial_concrete: {
      name: t("studios.industrialConcrete.name"),
      description: t("studios.industrialConcrete.description"),
    },
    matte_black_automotive: {
      name: t("studios.matteBlackAutomotive.name"),
      description: t("studios.matteBlackAutomotive.description"),
    },
  };

  return (
    <section className="py-32 md:py-40 lg:py-48 bg-white">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <motion.div
          className="mb-20 md:mb-24"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-sm tracking-[0.3em] uppercase text-graphite-400 mb-4">
            {t("subtitle")}
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-graphite-800 leading-tight">
            {t("title")}
          </h2>
        </motion.div>

        {/* Editorial grid - varied sizes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {studios.map((studio, index) => {
            const label = studioLabels[studio.key] || { name: studio.name, description: "" };
            const isLarge = index === 0 || index === 3;
            return (
              <motion.div
                key={studio.key}
                className={`group relative overflow-hidden cursor-pointer ${isLarge ? 'md:col-span-2 lg:col-span-2' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <div className={`relative ${isLarge ? 'aspect-[16/9]' : 'aspect-[4/3]'} overflow-hidden bg-graphite-100`}>
                  <img
                    src={studio.preview_image_url}
                    alt={studio.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      target.style.backgroundImage =
                        "linear-gradient(135deg, #f5f5f5 0%, #e5e7eb 100%)";
                    }}
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <h3 className="text-white text-lg font-semibold mb-1">
                      {label.name}
                    </h3>
                    <p className="text-white/70 text-sm">
                      {label.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}