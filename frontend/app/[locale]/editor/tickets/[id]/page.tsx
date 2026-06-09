"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { addNote, getOwnerLogo, getTicket, submitTicket, uploadTicketResult } from "@/lib/api/editor";
import type { Ticket } from "@/types/editor";

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

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-500 text-lg">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

export default function EditorTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("editor.tickets");
  const tp = useTranslations("editor.tickets.priority");
  const ts = useTranslations("editor.tickets.status");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editorNote, setEditorNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    getTicket(Number(id))
      .then((t) => { setTicket(t); setEditorNote(t.editor_note || ""); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleFile = async (file: File) => {
    if (!ticket) return;
    setUploadProgress(0);
    try {
      const updated = await uploadTicketResult(ticket.id, file, setUploadProgress);
      setTicket(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!ticket) return;
    setSubmitting(true);
    try {
      const updated = await submitTicket(ticket.id, editorNote || undefined);
      setTicket(updated);
    } catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const handlePostNote = async () => {
    if (!ticket || !noteBody.trim()) return;
    setPostingNote(true);
    try {
      const note = await addNote(ticket.id, noteBody.trim());
      setTicket((prev) => prev ? { ...prev, notes: [...prev.notes, note] } : prev);
      setNoteBody("");
    } catch (e: any) { alert(e.message); }
    finally { setPostingNote(false); }
  };

  const handleDownloadLogo = async () => {
    if (!ticket) return;
    try {
      const blob = await getOwnerLogo(ticket.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `owner_logo_${ticket.id}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-[#CC2020] border-t-transparent rounded-full animate-spin" /></div>;
  if (!ticket) return <div className="p-8 text-[#999]">Ticket not found.</div>;

  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== "done";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority]}`}>{tp(ticket.priority as any)}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status]}`}>{ts(ticket.status as any)}</span>
          {isOverdue && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{t("overdue")}</span>}
        </div>
        <h1 className="text-xl font-bold text-[#1a1a1a]">{ticket.title}</h1>
        {ticket.project_name && <p className="text-sm text-[#888] mt-1">{ticket.project_name}</p>}
        {ticket.due_date && <p className={`text-xs mt-1 ${isOverdue ? "text-red-500 font-medium" : "text-[#aaa]"}`}>{t("dueDate")}: {new Date(ticket.due_date).toLocaleDateString()}</p>}
        {ticket.rating && (
          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
            <p className="text-xs text-[#888] mb-1">{t("rating")}</p>
            <StarDisplay stars={ticket.rating.stars} />
            {ticket.rating.note && <p className="text-xs text-[#666] mt-1 italic">{ticket.rating.note}</p>}
          </div>
        )}
      </div>

      {/* Admin instructions */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <h2 className="font-semibold text-sm text-[#1a1a1a] mb-2">{t("instructions")}</h2>
        <p className="text-sm text-[#555] whitespace-pre-wrap">{ticket.description || t("noInstructions")}</p>
      </div>

      {/* Project Assets */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <h2 className="font-semibold text-sm text-[#1a1a1a] mb-4">{t("projectAssets")}</h2>
        <div className="space-y-3">
          {ticket.original_image_url ? (
            <div>
              <p className="text-xs text-[#888] mb-2">{t("originalImage")}</p>
              <img src={ticket.original_image_url} alt="original" className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
              <a href={ticket.original_image_url} download className="mt-2 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t("downloadOriginalPhoto")}
              </a>
            </div>
          ) : null}

          {ticket.ai_result_url ? (
            <div className="pt-3 border-t border-[#f5f5f7]">
              <p className="text-xs text-[#888] mb-2">AI Result</p>
              <img src={ticket.ai_result_url} alt="AI result" className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
              <a href={ticket.ai_result_url} download className="mt-2 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t("downloadAiResult")}
              </a>
            </div>
          ) : null}

          {ticket.owner_logo_url ? (
            <div className="pt-3 border-t border-[#f5f5f7]">
              <p className="text-xs text-[#888] mb-2">Owner Logo</p>
              <button onClick={handleDownloadLogo} className="inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {t("downloadOwnerLogo")}
              </button>
            </div>
          ) : null}

          {!ticket.original_image_url && !ticket.ai_result_url && !ticket.owner_logo_url && (
            <p className="text-sm text-[#aaa]">—</p>
          )}
        </div>
      </div>

      {/* Upload result */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">{t("uploadResult")}</h2>
        {ticket.result_image_url ? (
          <div>
            <p className="text-xs text-[#888] mb-2">{t("resultPreview")}</p>
            <img src={ticket.result_image_url} alt="result" className="w-full max-h-64 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
            <button onClick={() => fileRef.current?.click()} className="mt-3 text-sm text-[#CC2020] font-medium hover:underline">{t("uploadResult")} (replace)</button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? "border-[#CC2020] bg-[#CC2020]/5" : "border-[#e8e8e8] hover:border-[#CC2020]/40"}`}
          >
            <p className="text-sm text-[#888]">{t("uploadResultHint")}</p>
            {uploadProgress !== null && (
              <div className="mt-3 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div className="h-full bg-[#CC2020] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Editor note + submit */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
        <h2 className="font-semibold text-sm text-[#1a1a1a]">{t("editorNote")}</h2>
        <textarea
          value={editorNote}
          onChange={(e) => setEditorNote(e.target.value)}
          placeholder={t("editorNotePlaceholder")}
          rows={3}
          className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020] resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!ticket.result_image_url || submitting}
          className="w-full py-2.5 rounded-xl bg-[#CC2020] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#991818] transition-colors"
          title={!ticket.result_image_url ? t("submitResultDisabled") : undefined}
        >
          {submitting ? "…" : t("submitResult")}
        </button>
      </div>

      {/* Notes thread */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-4">
        <h2 className="font-semibold text-sm text-[#1a1a1a]">{t("notesTitle")}</h2>
        {ticket.notes.length === 0 && <p className="text-sm text-[#aaa]">—</p>}
        {ticket.notes.map((note) => (
          <div key={note.id} className="border-l-2 border-[#e8e8e8] pl-3">
            <p className="text-xs text-[#aaa] mb-1">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p>
            <p className="text-sm text-[#333] whitespace-pre-wrap">{note.body}</p>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder={t("notePlaceholder")}
            className="flex-1 border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostNote(); } }}
          />
          <button
            onClick={handlePostNote}
            disabled={!noteBody.trim() || postingNote}
            className="px-4 py-2 rounded-xl bg-[#CC2020] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#991818] transition-colors"
          >
            {t("postNote")}
          </button>
        </div>
      </div>
    </div>
  );
}
