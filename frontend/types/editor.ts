export type TicketStatus = "open" | "in_progress" | "review" | "done" | "rejected";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface TicketNote {
  id: number;
  ticket_id: number;
  author_id: number | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface EditorRating {
  id: number;
  editor_id: number;
  ticket_id: number;
  rated_by_id: number | null;
  stars: number;
  note: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  project_id: number;
  project_name: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  created_by_id: number | null;
  status: TicketStatus;
  priority: TicketPriority;
  title: string;
  description: string | null;
  editor_note: string | null;
  original_image_url: string | null;
  ai_result_url?: string | null;
  result_image_url: string | null;
  owner_logo_url?: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  notes: TicketNote[];
  rating?: EditorRating | null;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TicketBadge {
  open_count: number;
  in_progress_count: number;
  review_count: number;
  available_count: number;
}

export interface EditorUser {
  id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  open_ticket_count: number;
  rating_avg: number;
  rating_count: number;
  completed_ticket_count: number;
}

export interface TicketCreate {
  project_id: number;
  assigned_to_id?: number | null;
  title: string;
  description?: string | null;
  priority?: TicketPriority;
  due_date?: string | null;
}

export interface TicketUpdate {
  assigned_to_id?: number | null;
  title?: string;
  description?: string | null;
  priority?: TicketPriority;
  due_date?: string | null;
  status?: TicketStatus;
}
