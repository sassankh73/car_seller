"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  addNote, downloadTicketZip, getOwnerLogo,
  getTicket, submitTicket, uploadImageResult, uploadTicketResult,
} from "@/lib/api/editor";
import type { Ticket, TicketImage } from "@/types/editor";
import { IMAGE_LABEL_DISPLAY } from "@/types/editor";

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

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-500 text-lg">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
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

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ── Drop Zone ───────────────────────────────────────────────────────────────
function DropZone({
  progress,
  onFile,
  hint,
}: {
  progress?: number;
  onFile: (f: File) => void;
  hint: string;
}) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0]; if (f) onFile(f);
      }}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
        dragging ? "border-[#CC2020] bg-[#CC2020]/5" : "border-[#e8e8e8] hover:border-[#CC2020]/40"
      }`}
    >
      <p className="text-xs text-[#888]">{hint}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
          <div className="h-full bg-[#CC2020] transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <input ref={ref} type="file" accept="image/jpeg,image/png" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

// ── Image Row (one per label: front / rear / etc.) ──────────────────────────
function ImageRow({
  img,
  progress,
  onUpload,
}: {
  img: TicketImage;
  progress?: number;
  onUpload: (f: File) => void;
}) {
  const labelDisplay = IMAGE_LABEL_DISPLAY[img.label] || img.label;
  const replaceRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-[#f0f0f0] rounded-xl p-4">
      {/* Row header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold px-2 py-0.5 bg-[#f5f5f7] text-[#555] rounded-full">
          {labelDisplay}
        </span>
        {img.editor_result_url ? (
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Edited</span>
        ) : (
          <span className="text-xs text-[#aaa]">Pending edit</span>
        )}
      </div>

      {/* Three columns: original | AI result | your edit */}
      <div className="grid grid-cols-3 gap-3">
        {/* Original */}
        <div>
          <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Original</p>
          {img.original_image_url ? (
            <>
              <img
                src={img.original_image_url}
                alt="original"
                className="w-full h-28 object-cover rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]"
              />
              <a href={img.original_image_url} download className="mt-1 text-[10px] text-[#CC2020] hover:underline block">
                Download
              </a>
            </>
          ) : (
            <div className="w-full h-28 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#ccc] text-xs">No image</div>
          )}
        </div>

        {/* AI Result */}
        <div>
          <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">AI Result</p>
          {img.ai_result_url ? (
            <>
              <img
                src={img.ai_result_url}
                alt="AI result"
                className="w-full h-28 object-cover rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]"
              />
              <a href={img.ai_result_url} download className="mt-1 text-[10px] text-[#CC2020] hover:underline block">
                Download
              </a>
            </>
          ) : (
            <div className="w-full h-28 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#ccc] text-xs">No AI result</div>
          )}
        </div>

        {/* Your Edit */}
        <div>
          <p className="text-[10px] text-[#aaa] mb-1 font-medium uppercase tracking-wide">Your Edit</p>
          {img.editor_result_url ? (
            <div className="relative group">
              <img
                src={img.editor_result_url}
                alt="edited"
                className="w-full h-28 object-cover rounded-lg border border-green-200 bg-[#f5f5f7]"
              />
              <button
                onClick={() => replaceRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs font-medium"
              >
                Replace
              </button>
              {progress !== undefined && (
                <div className="mt-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#CC2020] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <input ref={replaceRef} type="file" accept="image/jpeg,image/png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
            </div>
          ) : (
            <DropZone progress={progress} onFile={onUpload} hint="Drop or click to upload" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function EditorTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("editor.tickets");
  const tp = useTranslations("editor.tickets.priority");
  const ts = useTranslations("editor.tickets.status");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [editorNote, setEditorNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // For legacy single-image tickets
  const [legacyProgress, setLegacyProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    getTicket(Number(id))
      .then((tk) => { setTicket(tk); setEditorNote(tk.editor_note || ""); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // ── Per-image upload ──────────────────────────────────────────────────────
  const handleImageUpload = async (imageId: number, file: File) => {
    if (!ticket) return;
    setUploadProgress((p) => ({ ...p, [imageId]: 0 }));
    try {
      const updatedImage = await uploadImageResult(ticket.id, imageId, file, (pct) =>
        setUploadProgress((p) => ({ ...p, [imageId]: pct }))
      );
      setTicket((prev) =>
        prev ? { ...prev, images: prev.images.map((img) => (img.id === imageId ? updatedImage : img)) } : prev
      );
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploadProgress((p) => { const n = { ...p }; delete n[imageId]; return n; });
    }
  };

  // ── Legacy single upload ──────────────────────────────────────────────────
  const handleLegacyFile = async (file: File) => {
    if (!ticket) return;
    setLegacyProgress(0);
    try {
      const updated = await uploadTicketResult(ticket.id, file, setLegacyProgress);
      setTicket(updated);
    } catch (e: any) { alert(e.message); }
    finally { setLegacyProgress(null); }
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

  const handleDownloadZip = async () => {
    if (!ticket) return;
    setDownloading(true);
    try { await downloadTicketZip(ticket.id); }
    catch (err: any) { alert(err.message); }
    finally { setDownloading(false); }
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

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-6 h-6 border-2 border-[#CC2020] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!ticket) return <div className="p-8 text-[#999]">Ticket not found.</div>;

  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date() && ticket.status !== "done";
  const useMultiImage = ticket.images && ticket.images.length > 0;

  // Submit is allowed once all images have editor results (or legacy single result uploaded)
  const allEdited = useMultiImage
    ? ticket.images.every((img) => !!img.editor_result_url)
    : !!ticket.result_image_url;
  const canSubmit = allEdited && !["review", "done", "delivered"].includes(ticket.status);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority]}`}>
            {tp(ticket.priority as any)}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[ticket.status]}`}>
            {ts(ticket.status as any)}
          </span>
          {isOverdue && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
              {t("overdue")}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-[#1a1a1a]">{ticket.title}</h1>

        {/* Customer info */}
        {ticket.customer_name && (
          <p className="text-sm text-[#888] mt-1">
            Customer:{" "}
            <span className="font-medium text-[#555]">{ticket.customer_name}</span>
            {ticket.customer_email && (
              <span className="text-[#aaa] ml-1">({ticket.customer_email})</span>
            )}
          </p>
        )}
        {ticket.project_name && (
          <p className="text-xs text-[#aaa] mt-0.5">{ticket.project_name}</p>
        )}
        {ticket.due_date && (
          <p className={`text-xs mt-1 ${isOverdue ? "text-red-500 font-medium" : "text-[#aaa]"}`}>
            {t("dueDate")}: {new Date(ticket.due_date).toLocaleDateString()}
          </p>
        )}

        {/* Timing metrics */}
        <div className="mt-3 pt-3 border-t border-[#f0f0f0] grid grid-cols-3 gap-3 text-xs">
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

        {ticket.rating && (
          <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
            <p className="text-xs text-[#888] mb-1">{t("rating")}</p>
            <StarDisplay stars={ticket.rating.stars} />
            {ticket.rating.note && (
              <p className="text-xs text-[#666] mt-1 italic">{ticket.rating.note}</p>
            )}
          </div>
        )}
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
                <button
                  onClick={handleDownloadLogo}
                  className="mt-1 text-[10px] text-[#CC2020] hover:underline block"
                >
                  Download
                </button>
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

      {/* ── Instructions ───────────────────────────────────────────────────── */}
      {ticket.description && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-2">{t("instructions")}</h2>
          <p className="text-sm text-[#555] whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* ── Multi-image section ─────────────────────────────────────────────── */}
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
          <div className="space-y-5">
            {ticket.images.map((img) => (
              <ImageRow
                key={img.id}
                img={img}
                progress={uploadProgress[img.id]}
                onUpload={(file) => handleImageUpload(img.id, file)}
              />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-xl hover:bg-[#333] disabled:opacity-40 transition-colors"
            >
              {downloading ? "Preparing…" : "⬇ Download All (ZIP)"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Legacy single-image layout ─────────────────────────────────── */
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
          <h2 className="font-semibold text-sm text-[#1a1a1a] mb-4">{t("projectAssets")}</h2>
          <div className="space-y-3">
            {ticket.original_image_url && (
              <div>
                <p className="text-xs text-[#888] mb-2">{t("originalImage")}</p>
                <img src={ticket.original_image_url} alt="original"
                  className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
                <a href={ticket.original_image_url} download
                  className="mt-2 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                  {t("downloadOriginalPhoto")}
                </a>
              </div>
            )}
            {ticket.ai_result_url && (
              <div className="pt-3 border-t border-[#f5f5f7]">
                <p className="text-xs text-[#888] mb-2">AI Result</p>
                <img src={ticket.ai_result_url} alt="AI result"
                  className="w-full max-h-48 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
                <a href={ticket.ai_result_url} download
                  className="mt-2 inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                  {t("downloadAiResult")}
                </a>
              </div>
            )}
            {ticket.owner_logo_url && (
              <div className="pt-3 border-t border-[#f5f5f7]">
                <p className="text-xs text-[#888] mb-2">Owner Logo</p>
                <button onClick={handleDownloadLogo}
                  className="inline-flex items-center gap-2 text-sm text-[#CC2020] font-medium hover:underline">
                  {t("downloadOwnerLogo")}
                </button>
              </div>
            )}
            {(ticket.original_image_url || ticket.ai_result_url || ticket.result_image_url) && (
              <div className="pt-3 border-t border-[#f5f5f7]">
                <button onClick={handleDownloadZip} disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-xl hover:bg-[#333] disabled:opacity-40 transition-colors">
                  {downloading ? "Preparing ZIP…" : "⬇ Download All Files (ZIP)"}
                </button>
              </div>
            )}
          </div>

          {/* Legacy upload */}
          <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
            <h3 className="font-semibold text-sm text-[#1a1a1a] mb-3">{t("uploadResult")}</h3>
            {ticket.result_image_url ? (
              <div>
                <img src={ticket.result_image_url} alt="result"
                  className="w-full max-h-64 object-contain rounded-lg border border-[#f0f0f0] bg-[#f5f5f7]" />
                <button onClick={() => fileRef.current?.click()}
                  className="mt-2 text-sm text-[#CC2020] font-medium hover:underline">
                  {t("uploadResult")} (replace)
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleLegacyFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragging ? "border-[#CC2020] bg-[#CC2020]/5" : "border-[#e8e8e8] hover:border-[#CC2020]/40"}`}
              >
                <p className="text-sm text-[#888]">{t("uploadResultHint")}</p>
                {legacyProgress !== null && (
                  <div className="mt-3 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#CC2020] transition-all" style={{ width: `${legacyProgress}%` }} />
                  </div>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLegacyFile(f); }} />
          </div>
        </div>
      )}

      {/* ── Editor note + submit ────────────────────────────────────────────── */}
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
          disabled={!canSubmit || submitting}
          className="w-full py-2.5 rounded-xl bg-[#CC2020] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#991818] transition-colors"
          title={!canSubmit && !submitting ? "Upload edited result for all images before submitting" : undefined}
        >
          {submitting ? "…" : t("submitResult")}
        </button>
        {!allEdited && (
          <p className="text-xs text-[#aaa] text-center">
            Upload edited results for all images to enable submit
          </p>
        )}
      </div>

      {/* ── Notes thread ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-4">
        <h2 className="font-semibold text-sm text-[#1a1a1a]">{t("notesTitle")}</h2>
        {ticket.notes.length === 0 && <p className="text-sm text-[#aaa]">—</p>}
        {ticket.notes.map((note) => (
          <div key={note.id} className="border-l-2 border-[#e8e8e8] pl-3">
            <p className="text-xs text-[#aaa] mb-1">
              {note.author_name} · {new Date(note.created_at).toLocaleString()}
            </p>
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
