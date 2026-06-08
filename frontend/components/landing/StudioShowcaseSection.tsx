"use client";

import { useTranslations } from "next-intl";

const STUDIOS = [
  {
    key: "whiteEpoxy",
    image: "/static/studios/white_corner_light_epoxy_preview.png",
    fallbackBg: "bg-[#E8E3DB]",
  },
  {
    key: "commercial",
    image: "/static/studios/commercial_showroom_tile_preview.png",
    fallbackBg: "bg-[#F0EDE8]",
  },
  {
    key: "darkStudio",
    image: "/static/studios/black_corner_dark_epoxy_preview.png",
    fallbackBg: "bg-[#2A2A2A]",
  },
  {
    key: "concrete",
    image: "/static/studios/dark_gray_corner_concrete_preview.png",
    fallbackBg: "bg-[#D6CDC4]",
  },
  {
    key: "ceramicTile",
    image: "/static/studios/white_corner_ceramic_tile_preview.png",
    fallbackBg: "bg-[#F5F2ED]",
  },
  {
    key: "premiumGray",
    image: "/static/studios/light_gray_corner_medium_epoxy_preview.png",
    fallbackBg: "bg-[#E5E0DA]",
  },
];

export default function StudioShowcaseSection() {
  const t = useTranslations("landing.studios");

  return (
    <section id="studios" className="relative bg-warm-100/50 py-20 lg:py-32">
      {/* Subtle warm gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-warm-100/30 to-white pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className="flex flex-col items-center text-center mb-14 lg:mb-18">
          <div className="section-label mb-3">{t("label")}</div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-[-0.02em] text-charcoal-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-charcoal-500 max-w-[520px] leading-relaxed">
            {t("description")}
          </p>
        </div>

        {/* Studio cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {STUDIOS.map((studio) => {
            const name = t(`items.${studio.key}.name` as any) as string;
            const desc = t(`items.${studio.key}.description` as any) as string;

            return (
              <div
                key={studio.key}
                className="group relative rounded-2xl lg:rounded-3xl overflow-hidden bg-white border border-black/[0.06] card-premium shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                {/* Image area */}
                <div className={`relative aspect-[16/10] overflow-hidden ${studio.fallbackBg}`}>
                  <img
                    src={studio.image}
                    alt={name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Content */}
                <div className="p-5 lg:p-6">
                  <h3 className="text-base font-semibold text-charcoal-900 mb-1.5 tracking-[-0.01em]">
                    {name}
                  </h3>
                  <p className="text-sm text-charcoal-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* View all CTA */}
        <div className="flex justify-center mt-10">
          <a
            href={`#features`}
            className="btn-outline text-sm"
          >
            {t("viewAll")}
          </a>
        </div>
      </div>
    </section>
  );
}