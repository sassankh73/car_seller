"use client";

import { useTranslations } from "next-intl";

const STUDIO_CARDS = [
  {
    id: 1,
    label: "White Epoxy",
    image: "/static/studios/white_corner_light_epoxy_preview.png",
    gradient: "bg-[#E8E3DB]",
    span: "col-span-1 row-span-1",
  },
  {
    id: 2,
    label: "Dark Studio",
    image: "/static/studios/black_corner_dark_epoxy_preview.png",
    gradient: "bg-[#2A2A2A]",
    span: "col-span-1 row-span-1",
    textLight: true,
  },
  {
    id: 3,
    label: "Commercial Showroom",
    image: "/static/studios/commercial_showroom_tile_preview.png",
    gradient: "bg-[#F0EDE8]",
    span: "col-span-1 row-span-1",
  },
  {
    id: 4,
    label: "Concrete Studio",
    image: "/static/studios/dark_gray_corner_concrete_preview.png",
    gradient: "bg-[#D6CDC4]",
    span: "col-span-1 row-span-1",
  },
];

export default function HeroSection() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Warm gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-warm-100/80 via-white to-white pointer-events-none" />
      {/* Dot pattern overlay */}
      <div className="absolute inset-0 bg-dot-warm opacity-30 pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div className="flex flex-col items-start gap-6 animate-fadeInUp">
            {/* Eyebrow */}
            <div className="section-label">
              {t("eyebrow")}
            </div>

            {/* Headline */}
            <h1 className="text-[2.75rem] lg:text-[3.75rem] leading-[1.08] font-bold tracking-[-0.03em] text-charcoal-900">
              {t("headlineLine1")}
              <br />
              <span className="text-red-500">{t("headlineLine2")}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg lg:text-xl text-charcoal-500 leading-relaxed max-w-[480px]">
              {t("subheadline")}
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-4 mt-2">
              <a href="/register" className="btn-primary">
                {t("startFreeTrial")}
              </a>
              <a
                href="#demo"
                className="btn-outline"
              >
                {t("viewDemo")}
              </a>
            </div>

            {/* Trusted by */}
            <p className="text-sm text-charcoal-400 mt-4">
              {t("trustedBy")}
            </p>
          </div>

          {/* Right — Bento Grid of studio preview cards */}
          <div className="grid grid-cols-2 gap-4 lg:gap-5">
            {STUDIO_CARDS.map((card) => (
              <div
                key={card.id}
                className={`${card.span} relative rounded-2xl lg:rounded-3xl overflow-hidden aspect-[4/3] ${card.gradient} card-premium shadow-card-lg group`}
              >
                {/* Studio image */}
                <img
                  src={card.image}
                  alt={card.label}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback: hide image, show gradient background
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                
                {/* Subtle overlay for depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

                {/* Label */}
                <div
                  className={`absolute bottom-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-md ${
                    card.textLight
                      ? "bg-white/10 text-white/90"
                      : "bg-white/70 text-charcoal-700"
                  }`}
                >
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}