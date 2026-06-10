"""Pydantic schemas for the Editor Portal ticketing system."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class TicketCreate(BaseModel):
    project_id: Optional[int] = None          # legacy single-project flow
    project_ids: Optional[List[int]] = None   # new multi-image order flow
    customer_user_id: Optional[int] = None    # customer who placed the order
    assigned_to_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: str = "normal"
    due_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def title_max_length(cls, v: str) -> str:
        if len(v) > 255:
            raise ValueError("title must be 255 characters or fewer")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: str) -> str:
        if v not in ("low", "normal", "high", "urgent"):
            raise ValueError("priority must be one of low, normal, high, urgent")
        return v


class TicketUpdate(BaseModel):
    assigned_to_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("low", "normal", "high", "urgent"):
            raise ValueError("priority must be one of low, normal, high, urgent")
        return v

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("open", "claimed", "in_progress", "review", "done", "rejected", "delivered"):
            raise ValueError("status must be one of open, claimed, in_progress, review, done, rejected, delivered")
        return v


class TicketEditorSubmit(BaseModel):
    editor_note: Optional[str] = None


class TicketNoteCreate(BaseModel):
    body: str
    is_internal: bool = False


class TicketNoteResponse(BaseModel):
    id: int
    ticket_id: int
    author_id: Optional[int]
    author_name: Optional[str]
    body: str
    is_internal: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RateEditorRequest(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    note: Optional[str] = None


class EditorRatingResponse(BaseModel):
    id: int
    editor_id: int
    ticket_id: int
    rated_by_id: Optional[int]
    stars: int
    note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketImageResponse(BaseModel):
    id: int
    ticket_id: int
    project_id: Optional[int] = None
    label: str
    sort_order: int
    original_image_url: Optional[str] = None
    ai_result_url: Optional[str] = None
    editor_result_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    customer_user_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    created_by_id: Optional[int] = None
    status: str
    priority: str
    title: str
    description: Optional[str] = None
    editor_note: Optional[str] = None
    # Legacy single-image fields (kept for backward compat)
    original_image_url: Optional[str] = None
    ai_result_url: Optional[str] = None
    result_image_url: Optional[str] = None
    owner_logo_url: Optional[str] = None
    logo_placement: Optional[str] = None
    logo_scale: Optional[float] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    notes: List[TicketNoteResponse] = []
    rating: Optional[EditorRatingResponse] = None
    images: List[TicketImageResponse] = []

    model_config = {"from_attributes": True}


class TicketListResponse(BaseModel):
    items: List[TicketResponse]
    total: int
    page: int
    page_size: int
    pages: int


class EditorUserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    is_active: bool
    open_ticket_count: int
    rating_avg: float = 0.0
    rating_count: int = 0
    completed_ticket_count: int = 0

    model_config = {"from_attributes": True}


class TicketBadgeResponse(BaseModel):
    open_count: int
    in_progress_count: int
    review_count: int
    available_count: int = 0
    completed_today: int = 0
    avg_delivery_minutes: Optional[float] = None
