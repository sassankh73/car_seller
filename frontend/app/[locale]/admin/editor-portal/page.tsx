"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { adminGetTickets, adminCreateTicket, adminGetEditors } from "@/lib/api/editor";
import type { Ticket, TicketListResponse, EditorUser, TicketCreate, TicketPriority } from "@/types/editor";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

export default function AdminEditorPortalPage() {
  const t = useTranslations("editor.admin");
  const ts = useTranslations("editor.tickets.status");
  const tp = useTranslations("editor.tickets.priority");
  const locale = useLocale();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [data, setData] = useState<TicketListResponse | null>(null);
  const [editors, setEditors] = useState<EditorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<TicketCreate>>({ priority: "normal" });
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, page_size: 20 };
    if (statusFilter) params.status = statusFilter;
    Promise.all([adminGetTickets(params), adminGetEditors()])
      .then(([d, e]) => { setData(d); setEditors(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, statusFilter, page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.title) return;
    setSaving(true);
    try {
      await adminCreateTicket(form as TicketCreate);
      setShowModal(false);
      setForm({ priority: "normal" });
      fetchData();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  // Stats
  const open = data?.items.filter((t) => t.status === "open").length ?? 0;
  const inProg = data?.items.filter((t) => t.status === "in_progress").length ?? 0;
  const review = data?.items.filter((t) => t.status === "review").length ?? 0;
  const thisWeek = data?.items.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) > new Date(Date.now() - 7 * 86400000)).length ?? 0;

  if (authLoading) return null;
  if (!isAuthenticated || user?.role !== "ADMIN") return null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">{t("dashboardTitle")}</h1>
        <div className="flex gap-2">
          <Link href={`/${locale}/admin/editor-portal/editors`} className="px-4 py-2 text-sm font-medium text-[#555] border border-[#e8e8e8] rounded-xl hover:bg-[#f5f5f7] transition-colors">{t("editorsTitle")}</Link>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm font-semibold text-white bg-[#CC2020] rounded-xl hover:bg-[#991818] transition-colors">{t("createTicket")}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: t("totalOpen"), count: open, color: "text-yellow-600" },
          { label: t("totalInProgress"), count: inProg, color: "text-blue-600" },
          { label: t("awaitingReview"), count: review, color: "text-purple-600" },
          { label: t("completedThisWeek"), count: thisWeek, color: "text-green-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e8e8e8] p-4">
            <p className="text-xs text-[#888] mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["", "open", "in_progress", "review", "done", "rejected"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? "bg-[#CC2020] text-white" : "bg-white border border-[#e8e8e8] text-[#555] hover:bg-[#f5f5f7]"}`}>
            {s === "" ? "All" : ts(s as any)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f0f0f0] text-xs text-[#888] font-semibold">
              {["ID", "Project", "Title", "Priority", "Status", "Assigned To", "Due", "Created"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#aaa]">Loading…</td></tr>}
            {!loading && data?.items.map((ticket) => (
              <tr key={ticket.id} className="border-b border-[#f9f9f9] hover:bg-[#fafafa] cursor-pointer" onClick={() => window.location.href = `/${locale}/admin/editor-portal/tickets/${ticket.id}`}>
                <td className="px-4 py-3 text-[#888]">#{ticket.id}</td>
                <td className="px-4 py-3 truncate max-w-[120px]">{ticket.project_name}</td>
                <td className="px-4 py-3 font-medium truncate max-w-[200px]">{ticket.title}</td>
                <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority]}`}>{tp(ticket.priority as any)}</span></td>
                <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status]}`}>{ts(ticket.status as any)}</span></td>
                <td className="px-4 py-3 text-[#888] truncate max-w-[120px]">{ticket.assigned_to_name || "—"}</td>
                <td className="px-4 py-3 text-[#888]">{ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-[#aaa]">{new Date(ticket.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex gap-2 justify-end mt-4">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-sm border border-[#e8e8e8] rounded-lg disabled:opacity-40 hover:bg-[#f5f5f7]">←</button>
          <span className="px-3 py-1.5 text-sm text-[#888]">{page} / {data.pages}</span>
          <button disabled={page === data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-sm border border-[#e8e8e8] rounded-lg disabled:opacity-40 hover:bg-[#f5f5f7]">→</button>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">{t("createTicket")}</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-[#888] mb-1">Project ID *</label>
                <input type="number" required onChange={(e) => setForm((f) => ({ ...f, project_id: Number(e.target.value) }))} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]" />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Title *</label>
                <input type="text" required onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]" />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">{t("assignEditor")}</label>
                <select onChange={(e) => setForm((f) => ({ ...f, assigned_to_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
                  <option value="">{t("noEditors")}</option>
                  {editors.map((ed) => <option key={ed.id} value={ed.id}>{ed.name || ed.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
                  {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{tp(p as any)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Instructions</label>
                <textarea onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-sm font-medium text-[#555]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors">{saving ? "…" : t("createTicket")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
