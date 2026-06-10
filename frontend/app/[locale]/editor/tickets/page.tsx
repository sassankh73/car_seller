"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { claimTicket, getTickets } from "@/lib/api/editor";
import type { Ticket, TicketStatus } from "@/types/editor";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700",
  claimed: "bg-orange-100 text-orange-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

export default function EditorTicketsPage() {
  const t = useTranslations("editor.tickets");
  const tp = useTranslations("editor.tickets.priority");
  const ts = useTranslations("editor.tickets.status");
  const locale = useLocale();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [claiming, setClaiming] = useState<number | null>(null);

  const fetchTickets = (f: string) => {
    setLoading(true);
    setApiError(null);
    // "available" and "my_open" are client-side filters applied to unfiltered results
    const isClientFilter = f === "available" || f === "my_open";
    getTickets(isClientFilter || f === "all" ? {} : { status: f })
      .then((r) => setTickets(r.items))
      .catch((err) => { console.error(err); setApiError(err?.message || "Failed to load tickets"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(filter); }, [filter]);

  const handleClaim = async (e: React.MouseEvent, ticket: Ticket) => {
    e.preventDefault();
    if (!confirm(t("claimConfirm"))) return;
    setClaiming(ticket.id);
    try {
      await claimTicket(ticket.id);
      router.push(`/${locale}/editor/tickets/${ticket.id}`);
    } catch (err: any) {
      if (err.message?.includes("409") || err.message?.toLowerCase().includes("claimed")) {
        alert(t("alreadyClaimed"));
      } else {
        alert(err.message);
      }
      fetchTickets(filter);
    } finally {
      setClaiming(null);
    }
  };

  const filters: { key: string; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "available", label: t("availableTab") },
    { key: "my_open", label: t("myOpenTab") },
    { key: "in_progress", label: t("filterInProgress") },
    { key: "review", label: t("filterReview") },
    { key: "done", label: t("filterDone") },
  ];

  const visibleTickets = tickets.filter((ticket) => {
    if (filter === "available") return ticket.assigned_to_id === null;
    // "My Open" = tickets assigned to me, actively in work (claimed/in_progress/review)
    if (filter === "my_open") return ticket.assigned_to_id !== null &&
      ["claimed", "in_progress", "review"].includes(ticket.status);
    return true;
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1a1a1a] mb-6">{t("title")}</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#e8e8e8] pb-0 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              filter === f.key
                ? "border-[#CC2020] text-[#CC2020]"
                : "border-transparent text-[#666] hover:text-[#1a1a1a]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-[#CC2020] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700 font-medium">Error loading tickets: {apiError}</p>
          <button onClick={() => fetchTickets(filter)} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      )}

      {!loading && !apiError && visibleTickets.length === 0 && (
        <div className="text-center py-16 text-[#999]">
          <svg className="w-12 h-12 mx-auto mb-4 text-[#ddd]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>{t("empty")}</p>
        </div>
      )}

      <div className="space-y-3">
        {visibleTickets.map((ticket) => {
          const isClaimable = ticket.assigned_to_id === null;
          const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== "done";

          const cardContent = (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority] || "bg-gray-100 text-gray-600"}`}>
                    {tp(ticket.priority as any)}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status] || "bg-gray-100 text-gray-600"}`}>
                    {ts(ticket.status as any)}
                  </span>
                  {isClaimable && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Available
                    </span>
                  )}
                  {isOverdue && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      {t("overdue")}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-[#1a1a1a] truncate">{ticket.title}</p>
                {ticket.project_name && (
                  <p className="text-sm text-[#888] mt-0.5">{ticket.project_name}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="text-right text-xs text-[#aaa]">
                  {ticket.due_date && (
                    <p className={isOverdue ? "text-red-500 font-medium" : ""}>
                      {t("dueDate")}: {new Date(ticket.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <p>{t("createdAt")}: {new Date(ticket.created_at).toLocaleDateString()}</p>
                </div>
                {isClaimable && (
                  <button
                    onClick={(e) => handleClaim(e, ticket)}
                    disabled={claiming === ticket.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#CC2020] text-white text-xs font-semibold rounded-lg hover:bg-[#991818] disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    {claiming === ticket.id ? "…" : t("claim")}
                  </button>
                )}
              </div>
            </div>
          );

          if (isClaimable) {
            return (
              <div
                key={ticket.id}
                className="block bg-white rounded-xl border border-green-200 p-4 hover:border-green-400 hover:shadow-sm transition-all cursor-default"
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={ticket.id}
              href={`/${locale}/editor/tickets/${ticket.id}`}
              className="block bg-white rounded-xl border border-[#e8e8e8] p-4 hover:border-[#CC2020]/30 hover:shadow-sm transition-all"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
