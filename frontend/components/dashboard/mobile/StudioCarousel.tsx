"use client";

import { useRef, useState, useEffect } from "react";

interface Studio {
  key: string;
  name: string;
  image_url: string;
  preview_image_url: string;
}

const STUDIO_COLORS: Record<string, string> = {
  white_corner_light_epoxy: "#f0f0f0",
  white_corner_ceramic_tile: "#e8e8e4",
  light_gray_corner_medium_epoxy: "#d4d4d4",
  dark_gray_corner_concrete: "#5a5a5a",
  black_corner_dark_epoxy: "#1a1a1a",
  commercial_showroom_tile: "#c8c8c8",
  industrial_concrete: "#8a8a7a",
  matte_black_automotive: "#222222",
};

const STUDIO_DESCRIPTIONS: Record<string, string> = {
  white_corner_light_epoxy: "Bright white studio, clean & minimal",
  white_corner_ceramic_tile: "Polished ceramic tile, elegant look",
  light_gray_corner_medium_epoxy: "Neutral gray, versatile tones",
  dark_gray_corner_concrete: "Industrial concrete, dramatic depth",
  black_corner_dark_epoxy: "Deep black studio, premium feel",
  commercial_showroom_tile: "Professional showroom environment",
  industrial_concrete: "Raw industrial aesthetic",
  matte_black_automotive: "Automotive-grade matte black",
};

interface StudioCarouselProps {
  studios: Studio[];
  selectedStudio: string;
  onSelect: (key: string) => void;
  studioLabel: (key: string) => string;
}

export default function StudioCarousel({
  studios,
  selectedStudio,
  onSelect,
  studioLabel,
}: StudioCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, studios.findIndex((s) => s.key === selectedStudio))
  );

  // Sync dot when user scrolls
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const cardWidth = el.scrollWidth / studios.length;
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActiveIndex(Math.min(idx, studios.length - 1));
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [studios.length]);

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / studios.length;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
  };

  return (
    <div className="w-full">
      {/* Carousel track */}
      <div
        ref={scrollRef}
        className="flex overflow-x-scroll snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {studios.map((studio, idx) => {
          const isSelected = selectedStudio === studio.key;
          return (
            <div
              key={studio.key}
              className="flex-none snap-start px-3 first:pl-4 last:pr-4"
              style={{ width: "85vw" }}
            >
              <button
                onClick={() => {
                  onSelect(studio.key);
                  setActiveIndex(idx);
                }}
                className={`w-full rounded-2xl overflow-hidden border-[3px] transition-all text-left ${
                  isSelected
                    ? "border-[#CC2020] shadow-lg shadow-red-500/15"
                    : "border-[#e8e8e8]"
                }`}
              >
                {/* Preview image */}
                <div
                  className="aspect-[16/9] bg-cover bg-center w-full"
                  style={{
                    backgroundImage: studio.preview_image_url
                      ? `url(${studio.preview_image_url})`
                      : "none",
                    backgroundColor: STUDIO_COLORS[studio.key] || "#e8e8e8",
                  }}
                />
                {/* Info */}
                <div className="px-4 py-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#111111] truncate">
                        {studioLabel(studio.key)}
                      </p>
                      <p className="text-xs text-[#888888] mt-0.5 truncate">
                        {STUDIO_DESCRIPTIONS[studio.key] || studio.name}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-[#CC2020] rounded-full flex items-center justify-center flex-shrink-0 ml-3 animate-[checkIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]">
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {studios.map((studio, idx) => (
          <button
            key={studio.key}
            onClick={() => scrollToIndex(idx)}
            className="transition-all"
            aria-label={studioLabel(studio.key)}
          >
            <div
              className={`rounded-full transition-all ${
                activeIndex === idx
                  ? "w-4 h-2 bg-[#CC2020]"
                  : "w-2 h-2 bg-[#e8e8e8]"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
