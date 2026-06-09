"use client";

import GuidedCapture, { CapturedImage } from "@/components/GuidedCapture";

interface MobileCaptureProps {
  onCaptureComplete: (images: CapturedImage[]) => void;
  onCancel: () => void;
}

export default function MobileCapture({
  onCaptureComplete,
  onCancel,
}: MobileCaptureProps) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black"
      style={{ height: "100dvh" }}
    >
      <button
        onClick={onCancel}
        className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-colors"
        style={{ top: "calc(12px + env(safe-area-inset-top, 0px))" }}
        aria-label="Close"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <div className="h-full">
        <GuidedCapture
          onCaptureComplete={onCaptureComplete}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
