"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function BeforeAfterSection() {
  const t = useTranslations("landing.beforeAfter");
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const position = ((clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, position)));
    }
  };

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  return (
    <section className="py-32 md:py-40 lg:py-48 bg-surface-warm">
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
            {t("before")}
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-graphite-800 leading-tight">
            {t("title")}
          </h2>
        </motion.div>

        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Comparison container - clean, no card wrapper */}
          <div
            ref={containerRef}
            className="relative w-full h-[300px] md:h-[500px] lg:h-[600px] cursor-col-resize select-none"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleMouseDown}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* After image (background) */}
            <div className="absolute inset-0 bg-graphite-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-white/10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-white/20 text-sm font-medium tracking-wider uppercase">{t("after")}</p>
                </div>
              </div>
            </div>

            {/* Before image (clipped) */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src="/demo-before.jpg"
                alt="Before - original car photo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-graphite-800/20" />
            </div>

            {/* Slider line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white z-20"
              style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
            >
              {/* Slider handle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                <div className="flex gap-[2px]">
                  <div className="w-[2px] h-4 bg-graphite-800 rounded-full" />
                  <div className="w-[2px] h-4 bg-graphite-800 rounded-full" />
                </div>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-6 left-6 z-30 px-4 py-2 bg-white/95 text-graphite-800 text-xs font-medium tracking-widest uppercase">
              {t("before")}
            </div>
            <div className="absolute top-6 right-6 z-30 px-4 py-2 bg-graphite-900/90 text-white text-xs font-medium tracking-widest uppercase">
              {t("after")}
            </div>
          </div>

          {/* Slider instruction */}
          <p className="text-center text-graphite-400 text-sm mt-8 tracking-wide">
            {t("dragSlider")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}