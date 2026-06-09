"use client";

import { useTranslations } from "next-intl";

interface WorkflowProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function WorkflowProgress({
  currentStep,
  totalSteps,
}: WorkflowProgressProps) {
  const t = useTranslations("dashboard.mobile.workflow");
  const pct = Math.min((currentStep / totalSteps) * 100, 100);

  return (
    <div
      className="sticky bg-white border-b border-[#e8e8e8] px-4 py-2.5 z-[9]"
      style={{ top: 48 }}
    >
      <p className="text-xs font-semibold text-[#111111] text-center mb-1.5">
        {t("stepOf", { current: currentStep, total: totalSteps })}
      </p>
      <div className="h-1 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#CC2020] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
