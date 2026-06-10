"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  adminAddNote, adminDeleteTicket, adminGetEditors, adminRateTicket,
  adminUpdateTicket, getTicket,
} from "@/lib/api/editor";
import type { EditorUser, Ticket, TicketImage, TicketPriority, TicketStatus } from "@/types/editor";
import { IMAGE_LABEL_DISPLAY } from "@/types/editor";

const STATUS_OPTIONS: TicketStatus[] = ["open", "claimed", "in_progress", "review", "done", "delivered", "rejected"];
const PRIORITY_OPTIONS: TicketPriority[] = ["low", "normal", "high", "urgent"];

const STATUS_COLOR: Record<string, string> = {
  open: "text-yellow-700 bg-yellow-50",
  claimed: "text-orange-700 bg-orange-50",
  in_progress: "text-blue-700 bg-blue-50",
  review: "text-purple-700 bg-purple-50",
  done: "text-green-700 bg-green-50",
  delivered: "text-emerald-800 bg-emerald-50",
  rejected: "text-red-700 bg-red-50",
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl transition-colors ${n <= value ? "text-yellow-500" : "text-[#ddd] hover:text-yellow-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function elapsedSince(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ── Image viewer for multi-image tickets ──────────────────────────────────
function AdminImageGallery({ images }: { images: TicketImage[] }) {
  return (
    <div className="space-y-5">
      {images.map((img) => {
        const labelDisplay = IMAGE_LABEL_DISPLAY[img.label] || img.label;
        return (
          <div key={img.id} className="border border-[#f0f0f0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 bg-[#f5f5f7] text-[#555] rounded-full">
                {labelDisplay}
              </span>
              {img.editor_result_url ? (
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Edited</span>
              ) : (
                <span className="text-xs text-[#aaa]">Not yet edited</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Original */}
              <div>
                <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Original</p>
                {img.original_image_url ? (
                  <>
                    <img src={img.original_image_url} alt="original"
                      className="w-full h-28 object-cover rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
                    <a href={img.original_image_url} download className="mt-1 text-[10px] text-[#CC2020] hover:underline block">
                      Download
                    </a>
                  </>
                ) : (
                  <div className="w-full h-28 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#ccc] text-xs">
                    No image
                  </div>
                )}
              </div>
              {/* AI Result */}
              <div>
                <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">AI Result</p>
                {img.ai_result_url ? (
                  <>
                    <img src={img.ai_result_url} alt="AI result"
                      className="w-full h-28 object-cover rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
                    <a href={img.ai_result_url} download className="mt-1 text-[10px] text-[#CC2020] hover:underline block">
                      Download
                    </a>
                  </>
                ) : (
                  <div className="w-full h-28 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#ccc] text-xs">
                    No AI result
                  </div>
                )}
              </div>
              {/* Editor Result */}
              <div>
                <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Editor Result</p>
                {img.editor_result_url ? (
                  <>
                    <img src={img.editor_result_url} alt="editor result"
                      className="w-full h-28 object-cover rounded-lg border border-green-200 bg-[#f5f5f7]" />
                    <a href={img.editor_result_url} download className="mt-1 text-[10px] text-[#CC2020] hover:underline block">
                      Download
                    </a>
                  </>
                ) : (
                  <div className="w-full h-28 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#ccc] text-xs">
                    Awaiting upload
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const locale = useLocale();
  const t = useTranslations("editor.admin");
  const ts = useTranslations("editor.tickets.status");
  const tp = useTranslations("editor.tickets.priority");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [editors, setEditors] = useState<EditorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [status, setStatus] = useState<TicketStatus>("open");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");

  // Rating
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingNote, setRatingNote] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingMsg, setRatingMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([getTicket(Number(id)), adminGetEditors()])
      .then(([tk, e]) => {
        setTicket(tk); setEditors(e);
        setTitle(tk.title); setPriority(tk.priority); setStatus(tk.status);
        setAssignedTo(tk.assigned_to_id ?? "");
        setDueDate(tk.due_date ? tk.due_date.split("T")[0] : "");
        if (tk.rating) { setRatingStars(tk.rating.stars); setRatingNote(tk.rating.note || ""); }
      }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const updated = await adminUpdateTicket(ticket.id, {
        title, priority, status,
        assigned_to_id: assignedTo === "" ? null : Number(assignedTo),
        due_date: dueDate || null,
      });
      setTicket(updated);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!ticket || !confirm(t("deleteConfirm"))) return;
    await adminDeleteTicket(ticket.id);
    window.location.href = `/${locale}/admin/editor-portal`;
  };

  const handlePostNote = async () => {
    if (!ticket || !noteBody.trim()) return;
    setPostingNote(true);
    try {
      const note = await adminAddNote(ticket.id, noteBody.trim(), isInternal);
      setTicket((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
      setNoteBody(""); setIsInternal(false);
    } catch (e: any) { alert(e.message); }
    finally { setPostingNote(false); }
  };

  const handleRating = async () => {
    if (!ticket || ratingStars === 0) return;
    setSubmittingRating(true);
    setRatingMsg("");
    try {
      const rating = await adminRateTicket(ticket.id, ratingStars, ratingNote || undefined);
      setTicket((prev) => prev ? { ...prev, rating } : prev);
      setRatingMsg(t("ratingUpdated"));
    } catch (e: any) { alert(e.message); }
    finally { setSubmittingRating(false); }
  };

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 border-2 border-[#CC2020] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!ticket) return <div className="p-8 text-[#999]">Ticket not found.</div>;

  const canRate = ticket.status === "done" && ticket.assigned_to_id !== null;
  const useMultiImage = ticket.images && ticket.images.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* ── Header: customer + ticket info ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#aaa]">Ticket #{ticket.id}</span>
          <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">
            {t("deleteTicket")}
          </button>
        </div>

        {/* Customer info */}
        {(ticket.customer_name || ticket.customer_email) && (
          <div className="pb-3 border-b border-[#f0f0f0]">
            <p className="text-xs text-[#aaa] mb-0.5">Customer</p>
            <p className="font-semibold text-[#1a1a1a]">{ticket.customer_name || "—"}</p>
            {ticket.customer_email && (
              <p className="text-xs text-[#888]">{ticket.customer_email}</p>
            )}
          </div>
        )}

        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-xl font-bold border-b border-[#e8e8e8] focus:outline-none focus:border-[#CC2020] pb-1"
        />

        {/* Timing */}
        <div className="grid grid-cols-4 gap-3 text-xs pt-1">
          <div>
            <p className="text-[#aaa] mb-0.5">Claimed</p>
            <p className="font-semibold text-[#555]">{fmtDate(ticket.claimed_at)}</p>
          </div>
          <div>
            <p className="text-[#aaa] mb-0.5">Started</p>
            <p className="font-semibold text-[#555]">{fmtDate(ticket.started_at)}</p>
          </div>
          <div>
            <p className="text-[#aaa] mb-0.5">Completed</p>
            <p className="font-semibold text-[#555]">{fmtDate(ticket.completed_at)}</p>
          </div>
          <div>
            <p className="text-[#aaa] mb-0.5">Delivered</p>
            <p className="font-semibold text-[#555]">{fmtDate(ticket.delivered_at)}</p>
          </div>
        </div>

        {/* Duration summary */}
        <div className="grid grid-cols-3 gap-3 text-xs pt-1 border-t border-[#f0f0f0]">
          <div>
            <p className="text-[#aaa] mb-0.5">Time Since Claim</p>
            <p className="font-semibold text-[#555]">{elapsedSince(ticket.claimed_at)}</p>
          </div>
          <div>
            <p className="text-[#aaa] mb-0.5">Editing Duration</p>
            <p className="font-semibold text-[#555]">{duration(ticket.started_at, ticket.completed_at)}</p>
          </div>
          <div>
            <p className="text-[#aaa] mb-0.5">Total Delivery</p>
            <p className="font-semibold text-[#555]">{duration(ticket.claimed_at, ticket.delivered_at)}</p>
          </div>
        </div>

        {/* Editable controls */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs text-[#888] mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{tp(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">{t("assignEditor")}</label>
            <select value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              <option value="">— unassigned —</option>
              {editors.map((e) => <option key={e.id} value={e.id}>{e.name || e.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors">
            {saving ? "…" : t("saveChanges")}
          </button>
          <button
            onClick={() => adminUpdateTicket(ticket.id, { status: "done" }).then(setTicket)}
            className="px-4 py-2.5 border border-green-300 text-green-700 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors">
            {t("markDone")}
          </button>
          <button
            onClick={() => adminUpdateTicket(ticket.id, { status: "rejected" }).then(setTicket)}
            className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
            {t("reject")}
          </button>
        </div>
      </div>

      {/* ── Customer Branding ──────────────────────────────────────────────── */}
      {(ticket.owner_logo_url || ticket.logo_placement || ticket.logo_scale) && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">Customer Branding</h2>
          <div className="flex items-start gap-6">
            {ticket.owner_logo_url && (
              <div className="flex-shrink-0">
                <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Logo</p>
                <img
                  src={ticket.owner_logo_url}
                  alt="Customer logo"
                  className="h-16 w-auto rounded-lg border border-[#f0f0f0] bg-[#f5f5f7] object-contain p-1"
                />
              </div>
            )}
            <div className="flex gap-6">
              {ticket.logo_placement && (
                <div>
                  <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Placement</p>
                  <p className="text-sm font-semibold text-[#333]">
                    {ticket.logo_placement.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              )}
              {ticket.logo_scale != null && (
                <div>
                  <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Scale</p>
                  <p className="text-sm font-semibold text-[#333]">{Math.round(ticket.logo_scale * 100)}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-image gallery ──────────────────────────────────────────────── */}
      {useMultiImage ? (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-[#1a1a1a]">
              Vehicle Photos ({ticket.images.length})
            </h2>
            <span className="text-xs text-[#888]">
              {ticket.images.filter((i) => !!i.editor_result_url).length} / {ticket.images.length} edited
            </span>
          </div>
          <AdminImageGallery images={ticket.images} />
        </div>
      ) : (
        /* ── Legacy single-image view ─────────────────────────────────── */
        <>
          {ticket.original_image_url && (
            <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">Original Image</h2>
              <img src={ticket.original_image_url} alt="original"
                className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
            </div>
          )}
          {ticket.ai_result_url && (
            <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">AI Result</h2>
              <img src={ticket.ai_result_url} alt="ai result"
                className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
              <a href={ticket.ai_result_url} download
                className="mt-3 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                Download AI Result
              </a>
            </div>
          )}
          {ticket.result_image_url && (
            <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">Editor Result</h2>
              <img src={ticket.result_image_url} alt="result"
                className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
              <a href={ticket.result_image_url} download
                className="mt-3 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                {t("downloadResult")}
              </a>
            </div>
          )}
        </>
      )}

      {/* ── Editor note ─────────────────────────────────────────────────────── */}
      {ticket.editor_note && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-2">Editor Note</h2>
          <p className="text-sm text-[#555] whitespace-pre-wrap">{ticket.editor_note}</p>
        </div>
      )}

      {/* ── Rate Editor ─────────────────────────────────────────────────────── */}
      {canRate && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
          <h2 className="font-semibold text-sm text-[#1a1a1a]">{t("rateEditor")}</h2>
          <div>
            <label className="block text-xs text-[#888] mb-2">{t("ratingLabel")}</label>
            <StarPicker value={ratingStars} onChange={setRatingStars} />
          </div>
          <textarea value={ratingNote} onChange={(e) => setRatingNote(e.target.value)}
            placeholder={t("ratingNote")} rows={2}
            className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none" />
          {ratingMsg && <p className="text-sm text-green-600">{ratingMsg}</p>}
          <button onClick={handleRating} disabled={ratingStars === 0 || submittingRating}
            className="px-4 py-2 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors">
            {submittingRating ? "…" : t("submitRating")}
          </button>
        </div>
      )}

      {/* ── Notes thread ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-4">
        <h2 className="font-semibold text-sm text-[#1a1a1a]">Notes</h2>
        {ticket.notes.length === 0 && <p className="text-sm text-[#aaa]">—</p>}
        {ticket.notes.map((note) => (
          <div key={note.id} className={`border-l-2 pl-3 ${note.is_internal ? "border-orange-300" : "border-[#e8e8e8]"}`}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-[#aaa]">
                {note.author_name} · {new Date(note.created_at).toLocaleString()}
              </p>
              {note.is_internal && (
                <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                  {t("internalNote")}
                </span>
              )}
            </div>
            <p className="text-sm text-[#333] whitespace-pre-wrap">{note.body}</p>
          </div>
        ))}
        <div className="space-y-2 pt-2">
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={2}
            placeholder="Write a note…"
            className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[#666] cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
              {t("internalNote")}
            </label>
            <button onClick={handlePostNote} disabled={!noteBody.trim() || postingNote}
              className="px-4 py-2 rounded-xl bg-[#CC2020] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#991818] transition-colors">
              Post
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
