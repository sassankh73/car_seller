"use client";

import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { memo } from "react";

// ── Type-safe key constraints matching translation file ────────────────
type HeroCategoryKey = "sedan" | "suv" | "wagon" | "coupe" | "pickupEv";
type HeroStudioKey = "whiteEpoxy" | "commercial" | "concrete" | "darkStudio" | "premiumGray";

interface HeroCardData {
  readonly id: number;
  readonly categoryKey: HeroCategoryKey;
  readonly studioKey: HeroStudioKey;
  readonly image: string;
  readonly darkOverlay: boolean;
}

// ── Static card data (keys must match translation file exactly) ───────
const HERO_CARDS: readonly HeroCardData[] = [
  {
    id: 1,
    categoryKey: "wagon",
    studioKey: "whiteEpoxy",
    image: "/hero/readystudio1.png",
    darkOverlay: false,
  },
  {
    id: 2,
    categoryKey: "coupe",
    studioKey: "commercial",
    image: "/hero/readystudio2.png",
    darkOverlay: false,
  },
  {
    id: 3,
    categoryKey: "suv",
    studioKey: "concrete",
    image: "/hero/readystudio3.png",
    darkOverlay: true,
  },
  {
    id: 4,
    categoryKey: "sedan",
    studioKey: "darkStudio",
    image: "/hero/readystudio4.png",
    darkOverlay: true,
  },
];

export default function HeroSection() {
  const t = useTranslations("landing.hero");
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Warm gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-b from-warm-100/80 via-white to-white pointer-events-none" />
      {/* Dot pattern overlay */}
      <div className="absolute inset-0 bg-dot-warm opacity-30 pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-28 pb-16 lg:pt-36 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div className="flex flex-col items-center md:items-start gap-6 animate-fadeInUp text-center md:text-left">
            {/* Eyebrow */}
            <div className="section-label">
              {t("eyebrow")}
            </div>

            {/* Headline — clamp for mobile */}
            <h1
              className="leading-[1.08] font-bold tracking-[-0.03em] text-charcoal-900"
              style={{ fontSize: "clamp(2rem, 8vw, 3.75rem)" }}
            >
              {t("headlineLine1")}
              <br />
              <span className="text-[#CC2020]">{t("headlineLine2")}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base md:text-lg lg:text-xl text-charcoal-500 leading-relaxed max-w-[480px]">
              {t("subheadline")}
            </p>

            {/* CTAs — stacked full-width on mobile, inline on md+ */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-2 w-full md:w-auto">
              <a
                href={`/${locale}/auth/register`}
                className="btn-primary text-center"
                style={{ minHeight: 44 }}
              >
                {t("startFreeTrial")}
              </a>
              <a
                href={`/${locale}/auth/register`}
                className="btn-outline text-center"
                style={{ minHeight: 44 }}
              >
                {t("viewDemo")}
              </a>
            </div>

            {/* Trusted by */}
            <p className="text-sm text-charcoal-400 mt-2">
              {t("trustedBy")}
            </p>
          </div>

          {/* Right — Vehicle Showcase Cards (hidden on mobile, 2×2 on md+) */}
          <div className="hidden md:grid grid-cols-2 gap-4 lg:gap-5">
            {HERO_CARDS.map((card) => (
              <HeroCard key={card.id} card={card} t={t} />
            ))}
          </div>

          {/* Mobile: single hero image instead of 2×2 grid */}
          <div className="md:hidden w-full">
            <HeroCard card={HERO_CARDS[0]} t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Memoised presentational card ──────────────────────────────────────
const HeroCard = memo(function HeroCard({
  card,
  t,
}: {
  card: HeroCardData;
  t: ReturnType<typeof useTranslations<"landing.hero">>;
}) {
  const isDark = card.darkOverlay;

  return (
    <div className="hero-card group relative rounded-2xl lg:rounded-3xl overflow-hidden aspect-[4/3] shadow-card-lg">
      {/* Vehicle in studio image */}
      <Image
        src={card.image}
        alt={`${t(`categories.${card.categoryKey}`)} — ${t(`studios.${card.studioKey}`)}`}
        fill
        sizes="(max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
      />

      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/5 pointer-events-none transition-opacity duration-500 group-hover:from-black/50"
        aria-hidden="true"
      />

      {/* Studio name badge — bottom left */}
      <div
        className={`absolute bottom-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 translate-y-0.5 ${
          isDark
            ? "bg-white/10 text-white/70"
            : "bg-white/70 text-charcoal-600"
        }`}
      >
        {t(`studios.${card.studioKey}`)}
      </div>

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-2xl lg:rounded-3xl ring-1 ring-inset ring-white/10 group-hover:ring-white/30 transition-all duration-500 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
});