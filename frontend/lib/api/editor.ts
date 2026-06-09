/**
 * Typed API client for the Editor Portal.
 * Uses authFetch (credentials: include) for cookie-based auth.
 */
import { authFetch } from "@/context/AuthContext";
import type {
  EditorRating,
  EditorUser,
  Ticket,
  TicketBadge,
  TicketCreate,
  TicketListResponse,
  TicketNote,
  TicketUpdate,
} from "@/types/editor";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Editor endpoints ──────────────────────────────────────────────────────

export async function getTickets(params?: {
  status?: string;
  priority?: string;
  page?: number;
  page_size?: number;
}): Promise<TicketListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  const res = await authFetch(`/api/editor/tickets?${q.toString()}`);
  return handleResponse<TicketListResponse>(res);
}

export async function getTicket(ticketId: number): Promise<Ticket> {
  const res = await authFetch(`/api/editor/tickets/${ticketId}`);
  return handleResponse<Ticket>(res);
}

export async function uploadTicketResult(
  ticketId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Ticket> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as Ticket);
      } else {
        const err = JSON.parse(xhr.responseText || "{}");
        reject(new Error(err.detail || `Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed — network error"));
    xhr.open("POST", `/api/editor/tickets/${ticketId}/upload-result`);
    xhr.send(formData);
  });
}

export async function submitTicket(ticketId: number, note?: string): Promise<Ticket> {
  const res = await authFetch(`/api/editor/tickets/${ticketId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ editor_note: note ?? null }),
  });
  return handleResponse<Ticket>(res);
}

export async function addNote(ticketId: number, body: string): Promise<TicketNote> {
  const res = await authFetch(`/api/editor/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, is_internal: false }),
  });
  return handleResponse<TicketNote>(res);
}

export async function getBadge(): Promise<TicketBadge> {
  const res = await authFetch("/api/editor/badge");
  return handleResponse<TicketBadge>(res);
}

// ── Admin endpoints ───────────────────────────────────────────────────────

export async function adminGetTickets(params?: Record<string, string | number | undefined>): Promise<TicketListResponse> {
  const q = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) q.set(k, String(v));
    }
  }
  const res = await authFetch(`/api/admin/editor/tickets?${q.toString()}`);
  return handleResponse<TicketListResponse>(res);
}

export async function adminCreateTicket(data: TicketCreate): Promise<Ticket> {
  const res = await authFetch("/api/admin/editor/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Ticket>(res);
}

export async function adminUpdateTicket(ticketId: number, data: Partial<TicketUpdate>): Promise<Ticket> {
  const res = await authFetch(`/api/admin/editor/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Ticket>(res);
}

export async function adminDeleteTicket(ticketId: number): Promise<void> {
  const res = await authFetch(`/api/admin/editor/tickets/${ticketId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function adminAddNote(ticketId: number, body: string, isInternal: boolean): Promise<TicketNote> {
  const res = await authFetch(`/api/admin/editor/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, is_internal: isInternal }),
  });
  return handleResponse<TicketNote>(res);
}

export async function adminGetEditors(): Promise<EditorUser[]> {
  const res = await authFetch("/api/admin/editor/editors");
  return handleResponse<EditorUser[]>(res);
}

export async function adminPromoteToEditor(userId: number): Promise<EditorUser> {
  const res = await authFetch("/api/admin/editor/editors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return handleResponse<EditorUser>(res);
}

export async function adminDemoteEditor(userId: number): Promise<{ demoted: boolean; tickets_unassigned: number }> {
  const res = await authFetch(`/api/admin/editor/editors/${userId}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function claimTicket(ticketId: number): Promise<Ticket> {
  const res = await authFetch(`/api/editor/tickets/${ticketId}/claim`, { method: "POST" });
  return handleResponse<Ticket>(res);
}

export async function getOwnerLogo(ticketId: number): Promise<Blob> {
  const res = await authFetch(`/api/editor/tickets/${ticketId}/owner-logo`);
  if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`);
  return res.blob();
}

export async function adminRateTicket(ticketId: number, stars: number, note?: string): Promise<EditorRating> {
  const res = await authFetch(`/api/admin/editor/tickets/${ticketId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stars, note: note ?? null }),
  });
  return handleResponse<EditorRating>(res);
}
