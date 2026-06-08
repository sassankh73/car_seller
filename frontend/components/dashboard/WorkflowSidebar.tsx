"use client";

import { useTranslations } from "next-intl";

type StepState = "completed" | "active" | "default";

interface WorkflowSidebarProps {
  activeStep: number;
  creditsRemaining: number | null;
  photosThisMonth: number;
  isUnlimited: boolean;
}

function StepCircle({ state }: { state: StepState }) {
  if (state === "completed") {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="w-6 h-6 rounded-full bg-[#e63946] flex items-center justify-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-[#e8e8e8] flex-shrink-0" />
  );
}

export default function WorkflowSidebar({
  activeStep,
  creditsRemaining,
  photosThisMonth,
  isUnlimited,
}: WorkflowSidebarProps) {
  const t = useTranslations("dashboard.redesign.sidebar");

  const steps = [
    t("steps.chooseStudio"),
    t("steps.uploadPhoto"),
    t("steps.photoGuide"),
    t("steps.processing"),
    t("steps.resultDownload"),
  ];

  const getState = (index: number): StepState => {
    const stepNum = index + 1;
    if (stepNum < activeStep) return "completed";
    if (stepNum === activeStep) return "active";
    return "default";
  };

  return (
    <aside className="w-[200px] bg-white border-r border-[#e8e8e8] flex flex-col overflow-y-auto flex-shrink-0">
      <div className="p-5 flex-1">
        <p className="text-[10px] font-bold text-[#888888] tracking-widest mb-5">
          {t("title")}
        </p>

        <div className="space-y-0">
          {steps.map((label, i) => {
            const state = getState(i);
            const isLast = i === steps.length - 1;
            return (
              <div key={i}>
                <div
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors ${
                    state === "active" ? "bg-red-50" : ""
                  }`}
                >
                  <StepCircle state={state} />
                  <span
                    className={`text-xs font-medium leading-tight ${
                      state === "active"
                        ? "text-[#e63946]"
                        : state === "completed"
                        ? "text-emerald-600"
                        : "text-[#888888]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {/* Connector line between steps */}
                {!isLast && (
                  <div className="ml-[18px] w-px h-3 bg-[#e8e8e8]" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div className="p-4 border-t border-[#e8e8e8] space-y-2.5">
        <div>
          <p className="text-[10px] text-[#888888] font-medium uppercase tracking-wider mb-0.5">
            {t("stats.creditsRemaining")}
          </p>
          <p className="text-sm font-bold text-[#111111]">
            {isUnlimited
              ? t("stats.unlimited")
              : creditsRemaining !== null
              ? creditsRemaining
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[#888888] font-medium uppercase tracking-wider mb-0.5">
            {t("stats.photosThisMonth")}
          </p>
          <p className="text-sm font-bold text-[#111111]">{photosThisMonth}</p>
        </div>
      </div>
    </aside>
  );
}
