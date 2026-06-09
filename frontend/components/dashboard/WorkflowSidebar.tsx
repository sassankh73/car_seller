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
      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="w-5 h-5 rounded-full bg-[#CC2020] flex items-center justify-center flex-shrink-0 ring-2 ring-red-200">
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full border-2 border-[#e8e8e8] flex-shrink-0" />
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
      <div className="pt-5 px-3 pb-3 flex-1">
        <p className="text-[10px] font-bold text-[#888888] tracking-widest mb-4 uppercase px-1">
          {t("title")}
        </p>

        <div>
          {steps.map((label, i) => {
            const state = getState(i);
            const isLast = i === steps.length - 1;
            return (
              <div key={i}>
                <div className="relative">
                  {/* Left accent bar — absolute so it doesn't shift circle alignment */}
                  {state === "active" && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-[#CC2020]" />
                  )}
                  <div
                    className={`flex items-center gap-2 py-2 pl-3 pr-2 rounded-r-lg transition-colors ${
                      state === "active" ? "bg-red-50/60" : ""
                    }`}
                  >
                    <StepCircle state={state} />
                    <span
                      className={`text-[11px] font-bold flex-shrink-0 w-3 ${
                        state === "active"
                          ? "text-[#CC2020]"
                          : state === "completed"
                          ? "text-emerald-500"
                          : "text-[#cccccc]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-[11px] leading-tight ${
                        state === "active"
                          ? "text-[#CC2020] font-semibold"
                          : state === "completed"
                          ? "text-emerald-600 font-medium"
                          : "text-[#999999]"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
                {/* Connector line — ml aligns with circle center (pl-3=12px + half of w-5=10px = 22px → use 21px) */}
                {!isLast && (
                  <div
                    className={`ml-[21px] w-px h-3 ${
                      state === "completed" ? "bg-emerald-200" : "bg-[#e8e8e8]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div className="p-4 border-t border-[#e8e8e8] space-y-3">
        <div>
          <p className="text-[9px] font-bold text-[#888888] uppercase tracking-widest mb-0.5">
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
          <p className="text-[9px] font-bold text-[#888888] uppercase tracking-widest mb-0.5">
            {t("stats.photosThisMonth")}
          </p>
          <p className="text-sm font-bold text-[#111111]">{photosThisMonth}</p>
        </div>
      </div>
    </aside>
  );
}
