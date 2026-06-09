"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { adminCreateEditor, adminDemoteEditor, adminGetEditors, adminPromoteToEditor } from "@/lib/api/editor";
import type { EditorUser } from "@/types/editor";

function StarAvg({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return <span className="text-xs text-[#aaa]">—</span>;
  return (
    <span className="text-sm">
      <span className="text-yellow-500">★</span> {avg.toFixed(1)}
      <span className="text-xs text-[#aaa] ml-1">({count})</span>
    </span>
  );
}

type Tab = "create" | "promote";

export default function AdminEditorsPage() {
  const t = useTranslations("editor.admin");
  const [editors, setEditors] = useState<EditorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("create");

  // Create form state
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);

  // Promote form state
  const [promotingId, setPromotingId] = useState("");
  const [promoting, setPromoting] = useState(false);

  const fetchEditors = () =>
    adminGetEditors()
      .then((data) => {
        setEditors([...data].sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { fetchEditors(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreatedInfo(null);
    if (!createEmail || !createName || !createPassword) {
      setCreateError("All fields are required");
      return;
    }
    setCreating(true);
    try {
      const editor = await adminCreateEditor({ email: createEmail, name: createName, password: createPassword });
      setEditors((prev) => [...prev, editor]);
      setCreatedInfo({ email: createEmail, password: createPassword });
      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create editor account");
    } finally {
      setCreating(false);
    }
  };

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
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-[#1a1a1a] mb-6">{t("editorsTitle")}</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("create")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "create"
              ? "bg-[#CC2020] text-white"
              : "bg-white border border-[#e8e8e8] text-[#555] hover:bg-[#f5f5f7]"
          }`}
        >
          {t("createEditorAccount")}
        </button>
        <button
          onClick={() => setTab("promote")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "promote"
              ? "bg-[#CC2020] text-white"
              : "bg-white border border-[#e8e8e8] text-[#555] hover:bg-[#f5f5f7]"
          }`}
        >
          {t("promoteExistingUser")}
        </button>
      </div>

      {/* Create new editor account form */}
      {tab === "create" && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 mb-6">
          <p className="text-sm text-[#888] mb-4">
            {t("createEditorHint")}
          </p>
          {createdInfo && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              <p className="font-semibold mb-1">✓ Editor account created — share these credentials:</p>
              <p><strong>Email:</strong> {createdInfo.email}</p>
              <p><strong>Password:</strong> {createdInfo.password}</p>
              <p className="mt-1 text-xs text-green-600">The editor will be prompted to change their password on first login.</p>
            </div>
          )}
          {createError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#555] mb-1">Full Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#555] mb-1">Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="editor@example.com"
                  required
                  className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1">Initial Password</label>
              <input
                type="text"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Temporary password — editor changes it on first login"
                required
                minLength={8}
                className="w-full border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors"
            >
              {creating ? "Creating…" : t("createEditorAccount")}
            </button>
          </form>
        </div>
      )}

      {/* Promote existing user form */}
      {tab === "promote" && (
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-5 mb-6">
          <p className="text-sm text-[#888] mb-3">{t("promoteUserHint")}</p>
          <form onSubmit={handlePromote} className="flex gap-2">
            <input
              type="number"
              value={promotingId}
              onChange={(e) => setPromotingId(e.target.value)}
              placeholder="User ID"
              className="flex-1 border border-[#e8e8e8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#CC2020]"
            />
            <button
              type="submit"
              disabled={!promotingId || promoting}
              className="px-4 py-2 bg-[#CC2020] text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-[#991818] transition-colors"
            >
              {promoting ? "…" : t("promoteUser")}
            </button>
          </form>
        </div>
      )}

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
                {["ID", "Name", "Email", "Open", t("completedTickets"), t("avgRating"), "Status", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editors.map((editor) => (
                <tr key={editor.id} className="border-b border-[#f9f9f9] hover:bg-[#fafafa]">
                  <td className="px-4 py-3 text-[#aaa] text-xs">{editor.id}</td>
                  <td className="px-4 py-3 font-medium">{editor.name || "—"}</td>
                  <td className="px-4 py-3 text-[#888]">{editor.email}</td>
                  <td className="px-4 py-3">{editor.open_ticket_count}</td>
                  <td className="px-4 py-3">{editor.completed_ticket_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <StarAvg avg={editor.rating_avg ?? 0} count={editor.rating_count ?? 0} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      editor.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
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
