'use client';

import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is < 768px.
 *
 * Uses window.innerWidth — the CSS viewport width — which is what
 * Chrome/Safari DevTools device emulation, real phones, and window resizing
 * all change correctly.
 *
 * BUG FIXED: the previous version used window.screen.width (physical monitor
 * resolution) which never changes in DevTools device emulation — so the mobile
 * layout was completely invisible in DevTools even at 375px width.
 *
 * Threshold 768px: phones (375–430px) → true. Tablets (768px+) → false.
 * Matches Tailwind's md: breakpoint exactly.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false); // SSR-safe: false until hydrated

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); // run immediately on mount so it reflects the actual viewport
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
