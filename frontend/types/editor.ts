export type TicketStatus = "open" | "claimed" | "in_progress" | "review" | "done" | "delivered" | "rejected";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const IMAGE_LABEL_DISPLAY: Record<string, string> = {
  front: "Front",
  rear: "Rear",
  left_side: "Left Side",
  right_side: "Right Side",
  front_45: "Front 45°",
  rear_45: "Rear 45°",
  other: "Other",
  photo: "Photo",
};

export interface TicketImage {
  id: number;
  ticket_id: number;
  project_id: number | null;
  label: string;
  sort_order: number;
  original_image_url: string | null;
  ai_result_url: string | null;
  editor_result_url: string | null;
  created_at: string;
  updated_at: string;
}

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
  project_id: number | null;
  project_name: string | null;
  customer_user_id: number | null;
  customer_name: string | null;
  customer_email: string | null;
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
  logo_placement?: string | null;
  logo_scale?: number | null;
  due_date: string | null;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  notes: TicketNote[];
  rating?: EditorRating | null;
  images: TicketImage[];
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
  completed_today: number;
  avg_delivery_minutes: number | null;
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

export interface CustomerProject {
  id: number;
  name: string;
  image_url: string | null;
  original_image_url: string | null;
  created_at: string | null;
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  project_count: number;
  projects: CustomerProject[];
}

export interface TicketCreate {
  project_id?: number | null;
  project_ids?: number[] | null;
  customer_user_id?: number | null;
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
