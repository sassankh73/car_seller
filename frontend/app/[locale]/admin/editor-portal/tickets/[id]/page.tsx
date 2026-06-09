"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { adminAddNote, adminDeleteTicket, adminGetEditors, adminRateTicket, adminUpdateTicket, getTicket } from "@/lib/api/editor";
import type { EditorUser, Ticket, TicketPriority, TicketStatus } from "@/types/editor";

const STATUS_OPTIONS: TicketStatus[] = ["open", "in_progress", "review", "done", "rejected"];
const PRIORITY_OPTIONS: TicketPriority[] = ["low", "normal", "high", "urgent"];

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

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("editor.admin");
  const ts = useTranslations("editor.tickets.status");
  const tp = useTranslations("editor.tickets.priority");
  const locale = useLocale();
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

  if (loading) return <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-[#CC2020] border-t-transparent rounded-full animate-spin" /></div>;
  if (!ticket) return <div className="p-8 text-[#999]">Ticket not found.</div>;

  const canRate = ticket.status === "done" && ticket.assigned_to_id !== null;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Editable header */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#aaa]">Ticket #{ticket.id}</span>
          <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">{t("deleteTicket")}</button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-xl font-bold border-b border-[#e8e8e8] focus:outline-none focus:border-[#CC2020] pb-1" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#888] mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{tp(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">{t("assignEditor")}</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]">
              <option value="">— unassigned —</option>
              {editors.map((e) => <option key={e.id} value={e.id}>{e.name || e.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors">{saving ? "…" : t("saveChanges")}</button>
          <button onClick={() => adminUpdateTicket(ticket.id, { status: "done" }).then(setTicket)} className="px-4 py-2.5 border border-green-300 text-green-700 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors">{t("markDone")}</button>
          <button onClick={() => adminUpdateTicket(ticket.id, { status: "rejected" }).then(setTicket)} className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">{t("reject")}</button>
        </div>
      </div>

      {/* Original image */}
      {ticket.original_image_url && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">Original Image</h2>
          <img src={ticket.original_image_url} alt="original" className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
          <p className="text-xs text-[#aaa] mt-2 font-mono truncate">{ticket.original_image_url}</p>
        </div>
      )}

      {/* AI result image */}
      {ticket.ai_result_url && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">AI Result</h2>
          <img src={ticket.ai_result_url} alt="ai result" className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
          <a href={ticket.ai_result_url} download className="mt-3 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download AI Result
          </a>
        </div>
      )}

      {/* Editor result image */}
      {ticket.result_image_url && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">Editor Result</h2>
          <img src={ticket.result_image_url} alt="result" className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
          <a href={ticket.result_image_url} download className="mt-3 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {t("downloadResult")}
          </a>
        </div>
      )}

      {/* Editor note */}
      {ticket.editor_note && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-2">Editor Note</h2>
          <p className="text-sm text-[#555] whitespace-pre-wrap">{ticket.editor_note}</p>
        </div>
      )}

      {/* Rate Editor section */}
      {canRate && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
          <h2 className="font-semibold text-sm text-[#1a1a1a]">{t("rateEditor")}</h2>
          <div>
            <label className="block text-xs text-[#888] mb-2">{t("ratingLabel")}</label>
            <StarPicker value={ratingStars} onChange={setRatingStars} />
          </div>
          <textarea
            value={ratingNote}
            onChange={(e) => setRatingNote(e.target.value)}
            placeholder={t("ratingNote")}
            rows={2}
            className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none"
          />
          {ratingMsg && <p className="text-sm text-green-600">{ratingMsg}</p>}
          <button
            onClick={handleRating}
            disabled={ratingStars === 0 || submittingRating}
            className="px-4 py-2 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors"
          >
            {submittingRating ? "…" : t("submitRating")}
          </button>
        </div>
      )}

      {/* Notes thread */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-4">
        <h2 className="font-semibold text-sm text-[#1a1a1a]">Notes</h2>
        {ticket.notes.length === 0 && <p className="text-sm text-[#aaa]">—</p>}
        {ticket.notes.map((note) => (
          <div key={note.id} className={`border-l-2 pl-3 ${note.is_internal ? "border-orange-300" : "border-[#e8e8e8]"}`}>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-[#aaa]">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p>
              {note.is_internal && <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">{t("internalNote")}</span>}
            </div>
            <p className="text-sm text-[#333] whitespace-pre-wrap">{note.body}</p>
          </div>
        ))}
        <div className="space-y-2 pt-2">
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={2} placeholder="Write a note…" className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[#666] cursor-pointer">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
              {t("internalNote")}
            </label>
            <button onClick={handlePostNote} disabled={!noteBody.trim() || postingNote} className="px-4 py-2 rounded-xl bg-[#CC2020] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#991818] transition-colors">Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}
