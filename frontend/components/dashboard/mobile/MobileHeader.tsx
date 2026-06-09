"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";

interface MobileHeaderProps {
  planName?: string;
}

export default function MobileHeader({ planName }: MobileHeaderProps) {
  const locale = useLocale();

  return (
    <header
      className="sticky top-0 z-10 bg-white border-b border-[#e8e8e8] flex items-center justify-between px-4"
      style={{ height: 48, paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <Link href={`/${locale}`} className="flex items-center">
        <Image
          src="/autostudio-logo.svg"
          alt="AutoStudio"
          width={100}
          height={20}
          className="h-[20px] w-auto"
          priority
        />
      </Link>

      {planName && (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#f5f5f7] text-[#111111] border border-[#e8e8e8]">
          {planName}
        </span>
      )}

      <Link
        href={`/${locale}/dashboard/account`}
        className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e8e8e8] flex items-center justify-center"
        aria-label="Account"
      >
        <svg
          className="w-4 h-4 text-[#555]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
      </Link>
    </header>
  );
}
