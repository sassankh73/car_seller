"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import {
  adminGetTickets, adminCreateTicket, adminGetEditors,
  adminGetStats, adminListCustomers,
} from "@/lib/api/editor";
import type {
  Customer, EditorUser, Ticket, TicketListResponse,
  TicketCreate, TicketPriority,
} from "@/types/editor";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700",
  claimed: "bg-orange-100 text-orange-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

// ── Create Ticket Modal ─────────────────────────────────────────────────────
function CreateTicketModal({
  editors,
  onClose,
  onCreated,
}: {
  editors: EditorUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("editor.admin");
  const tp = useTranslations("editor.tickets.priority");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Partial<TicketCreate>>({ priority: "normal" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminListCustomers()
      .then(setCustomers)
      .catch(console.error)
      .finally(() => setLoadingCustomers(false));
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const toggleProject = (pid: number) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      await adminCreateTicket({
        ...form,
        customer_user_id: selectedCustomerId !== "" ? selectedCustomerId : undefined,
        project_ids: selectedProjectIds.size > 0 ? Array.from(selectedProjectIds) : undefined,
      } as TicketCreate);
      onCreated();
      onClose();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-bold text-lg mb-5">{t("createTicket")}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Step 1: Select customer */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">Customer</label>
            {loadingCustomers ? (
              <p className="text-sm text-[#aaa]">Loading customers…</p>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value === "" ? "" : Number(e.target.value));
                  setSelectedProjectIds(new Set());
                }}
                className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
              >
                <option value="">— no customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email} ({c.project_count} projects)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Select projects (shown only when customer selected) */}
          {selectedCustomer && selectedCustomer.projects.length > 0 && (
            <div>
              <label className="block text-xs text-[#888] mb-2 font-medium">
                Select Projects to Include
                <span className="ml-1 text-[#aaa]">({selectedProjectIds.size} selected)</span>
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-[#f0f0f0] rounded-xl p-3">
                {selectedCustomer.projects.map((proj) => (
                  <label key={proj.id} className="flex items-center gap-3 cursor-pointer hover:bg-[#f5f5f7] rounded-lg p-1.5">
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.has(proj.id)}
                      onChange={() => toggleProject(proj.id)}
                      className="rounded"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {proj.image_url && (
                        <img src={proj.image_url} alt="" className="w-8 h-8 object-cover rounded-lg shrink-0" />
                      )}
                      <span className="text-sm text-[#333] truncate">{proj.name}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedProjectIds.size === selectedCustomer.projects.length) {
                    setSelectedProjectIds(new Set());
                  } else {
                    setSelectedProjectIds(new Set(selectedCustomer.projects.map((p) => p.id)));
                  }
                }}
                className="mt-1 text-xs text-[#CC2020] hover:underline"
              >
                {selectedProjectIds.size === selectedCustomer.projects.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          )}
          {selectedCustomer && selectedCustomer.projects.length === 0 && (
            <p className="text-xs text-[#aaa]">This customer has no projects yet.</p>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">Title *</label>
            <input
              type="text"
              required
              value={form.title || ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            />
          </div>

          {/* Assign editor */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">{t("assignEditor")}</label>
            <select
              onChange={(e) => setForm((f) => ({ ...f, assigned_to_id: e.target.value ? Number(e.target.value) : null }))}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            >
              <option value="">{t("noEditors")}</option>
              {editors.map((ed) => (
                <option key={ed.id} value={ed.id}>{ed.name || ed.email}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            >
              {["low", "normal", "high", "urgent"].map((p) => (
                <option key={p} value={p}>{tp(p as any)}</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">Due Date</label>
            <input
              type="date"
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs text-[#888] mb-1 font-medium">Instructions</label>
            <textarea
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-sm font-medium text-[#555] hover:bg-[#f5f5f7] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title}
              className="flex-1 py-2.5 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors"
            >
              {saving ? "…" : t("createTicket")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
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
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminGetStats>> | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, page_size: 20 };
    if (statusFilter) params.status = statusFilter;
    Promise.all([adminGetTickets(params), adminGetEditors(), adminGetStats()])
      .then(([d, e, s]) => { setData(d); setEditors(e); setStats(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated, statusFilter, page]);

  const open = stats?.summary.open_tickets ?? 0;
  const inProg = stats?.summary.in_progress_tickets ?? 0;
  const review = stats?.summary.waiting_review ?? 0;
  const totalEditors = stats?.summary.total_editors ?? 0;

  if (authLoading) return null;
  if (!isAuthenticated || user?.role !== "ADMIN") return null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">{t("dashboardTitle")}</h1>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/admin/editor-portal/editors`}
            className="px-4 py-2 text-sm font-medium text-[#555] border border-[#e8e8e8] rounded-xl hover:bg-[#f5f5f7] transition-colors"
          >
            {t("editorsTitle")}
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#CC2020] rounded-xl hover:bg-[#991818] transition-colors"
          >
            {t("createTicket")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: t("totalOpen"), count: open, color: "text-yellow-600" },
          { label: t("totalInProgress"), count: inProg, color: "text-blue-600" },
          { label: t("awaitingReview"), count: review, color: "text-purple-600" },
          { label: "Total Editors", count: totalEditors, color: "text-[#1a1a1a]" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#e8e8e8] p-4">
            <p className="text-xs text-[#888] mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "open", "claimed", "in_progress", "review", "done", "delivered", "rejected"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === s ? "bg-[#CC2020] text-white" : "bg-white border border-[#e8e8e8] text-[#555] hover:bg-[#f5f5f7]"
            }`}
          >
            {s === "" ? "All" : ts(s as any)}
          </button>
        ))}
      </div>

      {/* Ticket table */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f0f0f0] text-xs text-[#888] font-semibold">
              {["ID", "Customer", "Title", "Priority", "Status", "Assigned To", "Due", "Created"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#aaa]">Loading…</td></tr>
            )}
            {!loading && data?.items.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-b border-[#f9f9f9] hover:bg-[#fafafa] cursor-pointer"
                onClick={() => window.location.href = `/${locale}/admin/editor-portal/tickets/${ticket.id}`}
              >
                <td className="px-4 py-3 text-[#888]">#{ticket.id}</td>
                <td className="px-4 py-3 truncate max-w-[120px] text-[#555]">
                  {ticket.customer_name || ticket.project_name || "—"}
                </td>
                <td className="px-4 py-3 font-medium truncate max-w-[200px]">{ticket.title}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority]}`}>
                    {tp(ticket.priority as any)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status]}`}>
                    {ts(ticket.status as any)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#888] truncate max-w-[120px]">{ticket.assigned_to_name || "—"}</td>
                <td className="px-4 py-3 text-[#888]">{ticket.due_date ? new Date(ticket.due_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-[#aaa]">{new Date(ticket.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!loading && data?.items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-[#aaa]">No tickets found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex gap-2 justify-end mt-4">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border border-[#e8e8e8] rounded-lg disabled:opacity-40 hover:bg-[#f5f5f7]">
            ←
          </button>
          <span className="px-3 py-1.5 text-sm text-[#888]">{page} / {data.pages}</span>
          <button disabled={page === data.pages} onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border border-[#e8e8e8] rounded-lg disabled:opacity-40 hover:bg-[#f5f5f7]">
            →
          </button>
        </div>
      )}

      {/* Editor Leaderboard */}
      {stats && stats.leaderboard.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0f0f0]">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Editor Leaderboard</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#888] font-semibold border-b border-[#f0f0f0]">
                {["Rank", "Editor", "Completed", "Open", "Avg Delivery", "Rating", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.leaderboard.map((ed, i) => (
                <tr key={ed.id} className="border-b border-[#f9f9f9] hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5 text-[#888] font-medium">#{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-[#1a1a1a] truncate max-w-[160px]">{ed.name}</p>
                    <p className="text-xs text-[#aaa] truncate max-w-[160px]">{ed.email}</p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-green-600">{ed.completed_tickets}</td>
                  <td className="px-4 py-2.5 text-[#555]">{ed.open_tickets}</td>
                  <td className="px-4 py-2.5 text-[#555]">
                    {ed.avg_delivery_minutes !== null ? `${ed.avg_delivery_minutes}m` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {ed.rating_count > 0 ? (
                      <span className="text-yellow-500 font-medium">
                        {ed.rating_avg.toFixed(1)} ★{" "}
                        <span className="text-[#aaa] font-normal text-xs">({ed.rating_count})</span>
                      </span>
                    ) : <span className="text-[#aaa]">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ed.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {ed.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <CreateTicketModal
          editors={editors}
          onClose={() => setShowModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
