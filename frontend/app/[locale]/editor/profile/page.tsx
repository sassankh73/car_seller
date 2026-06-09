"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { getBadge } from "@/lib/api/editor";
import type { EditorUser } from "@/types/editor";
import { authFetch } from "@/context/AuthContext";

function StarDisplay({ avg, count }: { avg: number; count: number }) {
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  return (
    <div className="flex items-center gap-2">
      <span className="text-yellow-500 text-xl">
        {"★".repeat(full)}
        {half ? "½" : ""}
        {"☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)))}
      </span>
      <span className="text-sm text-[#888]">
        {avg.toFixed(1)} ({count} ratings)
      </span>
    </div>
  );
}

export default function EditorProfilePage() {
  const t = useTranslations("editor.profile");
  const tTickets = useTranslations("editor.tickets");
  const pw = useTranslations("account.password");
  const { user, changePasswordWithToken } = useAuth();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorMe, setEditorMe] = useState<EditorUser | null>(null);

  useEffect(() => {
    authFetch("/api/editor/me")
      .then((r) => r.json())
      .then(setEditorMe)
      .catch(() => {});
  }, []);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirm) { setMsg({ type: "err", text: pw("mismatch") }); return; }
    if (newPw.length < 8) { setMsg({ type: "err", text: pw("tooShort") }); return; }
    setSaving(true);
    const res = await changePasswordWithToken(current, newPw, confirm);
    setSaving(false);
    setMsg(res.success ? { type: "ok", text: pw("changeSuccess") } : { type: "err", text: res.detail || pw("changeError") });
    if (res.success) { setCurrent(""); setNewPw(""); setConfirm(""); }
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a]">{t("title")}</h1>

      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-2">
        <p className="text-sm text-[#888]">Email</p>
        <p className="font-medium text-[#1a1a1a]">{user?.email}</p>
        {user?.name && <><p className="text-sm text-[#888] pt-2">Name</p><p className="font-medium text-[#1a1a1a]">{user.name}</p></>}
      </div>

      {editorMe && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 space-y-3">
          <h2 className="font-semibold text-sm text-[#1a1a1a]">{tTickets("rating")}</h2>
          {editorMe.rating_count > 0 ? (
            <StarDisplay avg={editorMe.rating_avg} count={editorMe.rating_count} />
          ) : (
            <p className="text-sm text-[#aaa]">{tTickets("noRating")}</p>
          )}
          <p className="text-xs text-[#888]">{editorMe.completed_ticket_count} completed tickets</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5">
        <h2 className="font-semibold text-sm text-[#1a1a1a] mb-4">{t("changePassword")}</h2>
        <form onSubmit={handleChange} className="space-y-3">
          {(["current", "new", "confirm"] as const).map((field, i) => (
            <div key={field}>
              <label className="block text-xs text-[#888] mb-1">{pw(field as any)}</label>
              <input
                type="password"
                value={[current, newPw, confirm][i]}
                onChange={(e) => [setCurrent, setNewPw, setConfirm][i](e.target.value)}
                required
                className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
              />
            </div>
          ))}
          {msg && <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-[#CC2020] text-white font-semibold text-sm disabled:opacity-40 hover:bg-[#991818] transition-colors">
            {saving ? "…" : pw("change")}
          </button>
        </form>
      </div>
    </div>
  );
}
