'use client';

import { useState, useEffect } from 'react';

/**
 * Detects whether the current device is a phone (not a tablet or desktop).
 *
 * Uses Math.min(screen.width, screen.height) — the short physical side of the
 * screen — which is orientation-invariant. Phones top out at ~430px short-side
 * (iPhone 15 Plus, Pixel 9 XL). iPads start at 768px. A 500px threshold
 * cleanly separates every shipping phone from every tablet.
 *
 * This is intentionally separate from viewport width so that rotating an
 * iPhone into landscape (which pushes viewport width to 844–932px, above the
 * sm: 640px Tailwind breakpoint) does NOT flip to the tablet layout.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Math.min(window.screen.width, window.screen.height) <= 500;
  });

  useEffect(() => {
    const check = () => {
      const shortSide = Math.min(window.screen.width, window.screen.height);
      setIsMobile(shortSide <= 500);
    };

    check();
    // screen dimensions can change on foldables or when mirroring to an
    // external display, so we listen for resize as a safety net
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
