"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { adminDemoteEditor, adminGetEditors, adminPromoteToEditor } from "@/lib/api/editor";
import type { EditorUser } from "@/types/editor";

export default function AdminEditorsPage() {
  const t = useTranslations("editor.admin");
  const [editors, setEditors] = useState<EditorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [working, setWorking] = useState<number | null>(null);

  const fetchEditors = () => adminGetEditors().then(setEditors).catch(console.error).finally(() => setLoading(false));
  useEffect(() => { fetchEditors(); }, []);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = Number(promotingId);
    if (!userId) return;
    setPromoting(true);
    try {
      const editor = await adminPromoteToEditor(userId);
      setEditors((prev) => [...prev, editor]);
      setPromotingId("");
    } catch (err: any) { alert(err.message); }
    finally { setPromoting(false); }
  };

  const handleDemote = async (userId: number) => {
    if (!confirm(t("demoteConfirm"))) return;
    setWorking(userId);
    try {
      await adminDemoteEditor(userId);
      setEditors((prev) => prev.filter((e) => e.id !== userId));
    } catch (err: any) { alert(err.message); }
    finally { setWorking(null); }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#1a1a1a] mb-6">{t("editorsTitle")}</h1>

      {/* Promote form */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 mb-6">
        <h2 className="font-semibold text-sm text-[#1a1a1a] mb-3">{t("promoteUser")}</h2>
        <form onSubmit={handlePromote} className="flex gap-2">
          <input
            type="number"
            value={promotingId}
            onChange={(e) => setPromotingId(e.target.value)}
            placeholder="User ID"
            className="flex-1 border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
          />
          <button type="submit" disabled={!promotingId || promoting} className="px-4 py-2 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors">
            {promoting ? "…" : t("promoteUser")}
          </button>
        </form>
      </div>

      {/* Editors table */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#aaa]">Loading…</div>
        ) : editors.length === 0 ? (
          <div className="p-8 text-center text-[#aaa]">{t("noEditors")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f0f0] text-xs text-[#888] font-semibold">
                {["ID", "Email", "Name", "Open Tickets", "Active", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editors.map((editor) => (
                <tr key={editor.id} className="border-b border-[#f9f9f9]">
                  <td className="px-4 py-3 text-[#888]">{editor.id}</td>
                  <td className="px-4 py-3">{editor.email}</td>
                  <td className="px-4 py-3">{editor.name || "—"}</td>
                  <td className="px-4 py-3">{editor.open_ticket_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${editor.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {editor.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDemote(editor.id)}
                      disabled={working === editor.id}
                      className="text-xs text-red-500 hover:underline disabled:opacity-40"
                    >
                      {working === editor.id ? "…" : t("demoteEditor")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
