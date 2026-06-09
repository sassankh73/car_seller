"""Editor Portal API — ticket management for EDITOR and ADMIN roles."""

import logging
import math
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session, joinedload

from app.middleware.auth import get_current_editor, get_db_session
from app.models import Role, Ticket, TicketNote, User
from app.schemas.editor import (
    EditorRatingResponse,
    EditorUserResponse,
    TicketBadgeResponse,
    TicketEditorSubmit,
    TicketListResponse,
    TicketNoteCreate,
    TicketNoteResponse,
    TicketResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

EDITOR_RESULTS_DIR = Path(__file__).parent.parent / "static" / "editor_results"
EDITOR_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

PRIORITY_ORDER = {"urgent": 4, "high": 3, "normal": 2, "low": 1}


# ── Helpers ────────────────────────────────────────────────────────────────

def _build_ticket_response(ticket: Ticket, hide_internal: bool = False) -> TicketResponse:
    notes = [
        TicketNoteResponse(
            id=n.id,
            ticket_id=n.ticket_id,
            author_id=n.author_id,
            author_name=n.author.name or n.author.email if n.author else None,
            body=n.body,
            is_internal=n.is_internal,
            created_at=n.created_at,
        )
        for n in ticket.notes
        if not (hide_internal and n.is_internal)
    ]

    rating_resp = None
    if ticket.rating:
        rating_resp = EditorRatingResponse(
            id=ticket.rating.id,
            editor_id=ticket.rating.editor_id,
            ticket_id=ticket.rating.ticket_id,
            rated_by_id=ticket.rating.rated_by_id,
            stars=ticket.rating.stars,
            note=ticket.rating.note,
            created_at=ticket.rating.created_at,
        )

    owner_logo_url = None
    if ticket.project and ticket.project.owner and ticket.project.owner.logo_data:
        owner_logo_url = f"/api/editor/tickets/{ticket.id}/owner-logo"

    return TicketResponse(
        id=ticket.id,
        project_id=ticket.project_id,
        project_name=ticket.project.name if ticket.project else None,
        assigned_to_id=ticket.assigned_to_id,
        assigned_to_name=(ticket.assigned_to.name or ticket.assigned_to.email) if ticket.assigned_to else None,
        created_by_id=ticket.created_by_id,
        status=ticket.status,
        priority=ticket.priority,
        title=ticket.title,
        description=ticket.description,
        editor_note=ticket.editor_note,
        original_image_url=ticket.original_image_url,
        ai_result_url=ticket.ai_result_url,
        result_image_url=ticket.result_image_url,
        owner_logo_url=owner_logo_url,
        due_date=ticket.due_date,
        completed_at=ticket.completed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        notes=notes,
        rating=rating_resp,
    )


def _require_ticket(db: Session, ticket_id: int, current_user: User) -> Ticket:
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.project).joinedload("owner"),
            joinedload(Ticket.notes).joinedload("author"),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.rating),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role == Role.EDITOR and ticket.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this ticket")
    return ticket


def _validate_image_upload(file: UploadFile, data: bytes) -> None:
    ct = (file.content_type or "").lower()
    if ct not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File type not allowed. Upload JPEG or PNG.")
    if data[:3] == b"\xff\xd8\xff":
        return  # JPEG
    if data[:4] == b"\x89PNG":
        return  # PNG
    raise HTTPException(status_code=400, detail="File type not allowed. Upload JPEG or PNG.")


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/editor/tickets", response_model=TicketListResponse)
async def list_tickets(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    q = db.query(Ticket).options(
        joinedload(Ticket.project).joinedload("owner"),
        joinedload(Ticket.notes).joinedload("author"),
        joinedload(Ticket.assigned_to),
        joinedload(Ticket.rating),
    )
    if current_user.role == Role.EDITOR:
        # Show editor's own tickets AND unassigned claimable tickets
        q = q.filter(
            or_(
                Ticket.assigned_to_id == current_user.id,
                Ticket.assigned_to_id.is_(None),
            )
        )
        # Exclude done/rejected unassigned tickets
        q = q.filter(
            or_(
                Ticket.assigned_to_id == current_user.id,
                Ticket.status.notin_(["done", "rejected"]),
            )
        )
    if status_filter:
        q = q.filter(Ticket.status == status_filter)
    if priority:
        q = q.filter(Ticket.priority == priority)

    total = q.count()
    tickets = q.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    tickets.sort(key=lambda t: (PRIORITY_ORDER.get(t.priority, 0), t.created_at.timestamp()), reverse=True)

    hide = current_user.role == Role.EDITOR
    return TicketListResponse(
        items=[_build_ticket_response(t, hide_internal=hide) for t in tickets],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/editor/tickets/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: int,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    ticket = _require_ticket(db, ticket_id, current_user)
    return _build_ticket_response(ticket, hide_internal=(current_user.role == Role.EDITOR))


@router.post("/editor/tickets/{ticket_id}/claim", response_model=TicketResponse)
async def claim_ticket(
    ticket_id: int,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    # Atomic claim: UPDATE only succeeds if ticket is still unassigned
    result = db.execute(
        text(
            "UPDATE tickets SET assigned_to_id=:uid, status=:st, updated_at=NOW()"
            " WHERE id=:tid AND assigned_to_id IS NULL RETURNING id"
        ),
        {"uid": current_user.id, "st": "in_progress", "tid": ticket_id},
    )
    row = result.fetchone()
    if row is None:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        raise HTTPException(status_code=409, detail="Ticket already claimed by another editor")
    db.commit()

    ticket = _require_ticket(db, ticket_id, current_user)

    try:
        from app.services.email import send_ticket_assignment_email
        send_ticket_assignment_email(
            editor_email=current_user.email,
            editor_name=current_user.name or current_user.email,
            ticket_id=ticket.id,
            ticket_title=ticket.title,
            project_name=ticket.project.name if ticket.project else "",
            due_date=ticket.due_date,
            admin_instructions=ticket.description,
        )
    except Exception:
        logger.exception("Failed to send claim email (non-fatal)")

    return _build_ticket_response(ticket, hide_internal=True)


@router.post("/editor/tickets/{ticket_id}/upload-result", response_model=TicketResponse)
async def upload_result(
    ticket_id: int,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    ticket = _require_ticket(db, ticket_id, current_user)

    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 20 MB.")
    _validate_image_upload(file, data)

    ext = ".jpg" if (file.content_type or "").lower() in ("image/jpeg", "image/jpg") else ".png"
    safe_name = f"result_{ticket_id}_{uuid.uuid4().hex}{ext}"
    dest = EDITOR_RESULTS_DIR / safe_name
    dest.write_bytes(data)
    result_url = f"/static/editor_results/{safe_name}"

    ticket.result_image_url = result_url
    ticket.status = "review"
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    try:
        from app.services.email import send_ticket_result_notification
        from app.models import User as UserModel
        admins = db.query(UserModel).filter(UserModel.role == Role.ADMIN, UserModel.is_active.is_(True)).all()
        for admin in admins:
            send_ticket_result_notification(
                admin_email=admin.email,
                ticket_id=ticket.id,
                ticket_title=ticket.title,
                editor_name=current_user.name or current_user.email,
                editor_note=ticket.editor_note,
            )
    except Exception:
        logger.exception("Failed to send result notification email (non-fatal)")

    return _build_ticket_response(ticket, hide_internal=(current_user.role == Role.EDITOR))


@router.post("/editor/tickets/{ticket_id}/submit", response_model=TicketResponse)
async def submit_ticket(
    ticket_id: int,
    body: TicketEditorSubmit,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    ticket = _require_ticket(db, ticket_id, current_user)
    if current_user.role == Role.EDITOR and ticket.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this ticket")
    ticket.editor_note = body.editor_note
    ticket.status = "review"
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return _build_ticket_response(ticket, hide_internal=(current_user.role == Role.EDITOR))


@router.post("/editor/tickets/{ticket_id}/notes", response_model=TicketNoteResponse)
async def add_note(
    ticket_id: int,
    body: TicketNoteCreate,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    ticket = _require_ticket(db, ticket_id, current_user)
    is_internal = False if current_user.role == Role.EDITOR else body.is_internal
    note = TicketNote(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=body.body,
        is_internal=is_internal,
        created_at=datetime.utcnow(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return TicketNoteResponse(
        id=note.id,
        ticket_id=note.ticket_id,
        author_id=note.author_id,
        author_name=current_user.name or current_user.email,
        body=note.body,
        is_internal=note.is_internal,
        created_at=note.created_at,
    )


@router.get("/editor/tickets/{ticket_id}/owner-logo")
async def get_owner_logo(
    ticket_id: int,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    ticket = _require_ticket(db, ticket_id, current_user)
    if not ticket.project:
        raise HTTPException(status_code=404, detail="Project not found")
    owner = db.query(User).filter(User.id == ticket.project.user_id).first()
    if not owner or not owner.logo_data:
        raise HTTPException(status_code=404, detail="Owner has no logo")
    return Response(
        content=owner.logo_data,
        media_type=owner.logo_mime_type or "image/png",
        headers={"Content-Disposition": f'attachment; filename="owner_logo_{ticket_id}.png"'},
    )


@router.get("/editor/badge", response_model=TicketBadgeResponse)
async def get_badge(
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    base = db.query(Ticket).filter(Ticket.assigned_to_id == current_user.id)
    available_count = db.query(Ticket).filter(
        Ticket.assigned_to_id.is_(None),
        Ticket.status == "open",
    ).count()
    return TicketBadgeResponse(
        open_count=base.filter(Ticket.status == "open").count(),
        in_progress_count=base.filter(Ticket.status == "in_progress").count(),
        review_count=base.filter(Ticket.status == "review").count(),
        available_count=available_count,
    )


@router.get("/editor/me", response_model=EditorUserResponse)
async def get_me(
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    open_count = db.query(Ticket).filter(
        Ticket.assigned_to_id == current_user.id,
        Ticket.status.in_(["open", "in_progress"]),
    ).count()
    completed_count = db.query(Ticket).filter(
        Ticket.assigned_to_id == current_user.id,
        Ticket.status == "done",
    ).count()
    return EditorUserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        open_ticket_count=open_count,
        rating_avg=current_user.rating_avg or 0.0,
        rating_count=current_user.rating_count or 0,
        completed_ticket_count=completed_count,
    )
