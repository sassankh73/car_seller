"""Pydantic schemas for the Editor Portal ticketing system."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator


class TicketCreate(BaseModel):
    project_id: int
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
        if v is not None and v not in ("open", "in_progress", "review", "done", "rejected"):
            raise ValueError("status must be one of open, in_progress, review, done, rejected")
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


class TicketResponse(BaseModel):
    id: int
    project_id: int
    project_name: Optional[str]
    assigned_to_id: Optional[int]
    assigned_to_name: Optional[str]
    created_by_id: Optional[int]
    status: str
    priority: str
    title: str
    description: Optional[str]
    editor_note: Optional[str]
    original_image_url: Optional[str]
    result_image_url: Optional[str]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    notes: List[TicketNoteResponse] = []

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

    model_config = {"from_attributes": True}


class TicketBadgeResponse(BaseModel):
    open_count: int
    in_progress_count: int
    review_count: int
