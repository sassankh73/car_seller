"""Editor Portal API — ticket management for EDITOR and ADMIN roles."""

import io
import logging
import math
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session, joinedload

from app.middleware.auth import get_current_editor, get_db_session
from app.models import DownloadLog, Project, Role, Ticket, TicketImage, TicketNote, User
from app.schemas.editor import (
    EditorRatingResponse,
    EditorUserResponse,
    TicketBadgeResponse,
    TicketEditorSubmit,
    TicketImageResponse,
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
            author_name=(n.author.name or n.author.email) if n.author else None,
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
    logo_placement = None
    logo_scale = None
    if ticket.project and ticket.project.owner:
        owner = ticket.project.owner
        if owner.logo_data:
            owner_logo_url = f"/api/editor/tickets/{ticket.id}/owner-logo"
        logo_placement = getattr(owner, "logo_placement", None)
        logo_scale = getattr(owner, "logo_scale", None)

    images_resp = [
        TicketImageResponse(
            id=img.id,
            ticket_id=img.ticket_id,
            project_id=img.project_id,
            label=img.label,
            sort_order=img.sort_order,
            original_image_url=img.original_image_url,
            ai_result_url=img.ai_result_url,
            editor_result_url=img.editor_result_url,
            created_at=img.created_at,
            updated_at=img.updated_at,
        )
        for img in ticket.images
    ]

    return TicketResponse(
        id=ticket.id,
        project_id=ticket.project_id,
        project_name=ticket.project.name if ticket.project else None,
        customer_user_id=ticket.customer_user_id,
        customer_name=(ticket.customer.name or ticket.customer.email) if ticket.customer else None,
        customer_email=ticket.customer.email if ticket.customer else None,
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
        logo_placement=logo_placement,
        logo_scale=logo_scale,
        due_date=ticket.due_date,
        completed_at=ticket.completed_at,
        claimed_at=ticket.claimed_at,
        started_at=ticket.started_at,
        delivered_at=ticket.delivered_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        notes=notes,
        rating=rating_resp,
        images=images_resp,
    )


def _require_ticket(db: Session, ticket_id: int, current_user: User) -> Ticket:
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.project).joinedload(Project.owner),
            joinedload(Ticket.notes).joinedload(TicketNote.author),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.customer),
            joinedload(Ticket.rating),
            joinedload(Ticket.images),
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
    try:
        from app.models import Project  # noqa — ensure Project in SA registry
        q = db.query(Ticket).options(
            joinedload(Ticket.project).joinedload(Project.owner),
            joinedload(Ticket.notes).joinedload(TicketNote.author),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.customer),
            joinedload(Ticket.rating),
            joinedload(Ticket.images),
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
                    Ticket.status.notin_(["done", "rejected", "delivered"]),
                )
            )
        if status_filter:
            q = q.filter(Ticket.status == status_filter)
        if priority:
            q = q.filter(Ticket.priority == priority)

        total = q.count()
        tickets_list = q.order_by(Ticket.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        tickets_list.sort(key=lambda t: (PRIORITY_ORDER.get(t.priority, 0), (t.created_at.timestamp() if t.created_at else 0)), reverse=True)

        hide = current_user.role == Role.EDITOR
        items = []
        for t in tickets_list:
            try:
                items.append(_build_ticket_response(t, hide_internal=hide))
            except Exception as exc:
                logger.error("list_tickets: failed to build response for ticket id=%s: %s", t.id, exc, exc_info=True)
        return TicketListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )
    except Exception as exc:
        logger.error("list_tickets FAILED for user id=%s role=%s: %s", current_user.id, current_user.role, exc, exc_info=True)
        raise


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
            "UPDATE tickets SET assigned_to_id=:uid, status=:st, claimed_at=NOW(), updated_at=NOW()"
            " WHERE id=:tid AND assigned_to_id IS NULL RETURNING id"
        ),
        {"uid": current_user.id, "st": "claimed", "tid": ticket_id},
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
    ticket.status = "in_progress"
    if ticket.started_at is None:
        ticket.started_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()

    # Propagate editor result back to the Project so the user's dashboard shows it
    if ticket.project_id:
        proj = db.query(Project).filter(Project.id == ticket.project_id).first()
        if proj:
            proj.editor_result_url = result_url

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


@router.post("/editor/tickets/{ticket_id}/images/{image_id}/upload-result", response_model=TicketImageResponse)
async def upload_image_result(
    ticket_id: int,
    image_id: int,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    """Upload the editor's result for a single image within a multi-image ticket."""
    ticket = _require_ticket(db, ticket_id, current_user)
    img = db.query(TicketImage).filter(TicketImage.id == image_id, TicketImage.ticket_id == ticket_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found on this ticket")

    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")
    _validate_image_upload(file, data)

    ext = Path(file.filename or "result.jpg").suffix.lower() or ".jpg"
    safe_name = f"result_{ticket_id}_{image_id}_{uuid.uuid4().hex}{ext}"
    dest = EDITOR_RESULTS_DIR / safe_name
    dest.write_bytes(data)
    result_url = f"/static/editor_results/{safe_name}"

    img.editor_result_url = result_url
    img.updated_at = datetime.utcnow()

    # Move ticket to in_progress on first upload
    if ticket.status == "claimed":
        ticket.status = "in_progress"
    if ticket.started_at is None:
        ticket.started_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(img)
    return TicketImageResponse(
        id=img.id,
        ticket_id=img.ticket_id,
        project_id=img.project_id,
        label=img.label,
        sort_order=img.sort_order,
        original_image_url=img.original_image_url,
        ai_result_url=img.ai_result_url,
        editor_result_url=img.editor_result_url,
        created_at=img.created_at,
        updated_at=img.updated_at,
    )


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


@router.get("/editor/tickets/{ticket_id}/download-zip")
async def download_ticket_zip(
    ticket_id: int,
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    """Stream a ZIP archive containing all files attached to this ticket."""
    ticket = _require_ticket(db, ticket_id, current_user)
    if current_user.role == Role.EDITOR and ticket.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    STATIC_ROOT = Path(__file__).parent.parent / "static"

    def url_to_path(url: str | None) -> Path | None:
        if not url:
            return None
        rel = url.lstrip("/").removeprefix("static/")
        p = STATIC_ROOT / rel
        return p if p.exists() else None

    files: list[tuple[str, Path]] = []
    # Legacy single-image fields
    if p := url_to_path(ticket.original_image_url):
        files.append(("original" + p.suffix, p))
    if p := url_to_path(ticket.ai_result_url):
        files.append(("ai_result" + p.suffix, p))
    if p := url_to_path(ticket.result_image_url):
        files.append(("editor_result" + p.suffix, p))
    # Multi-image ticket_images
    for img in ticket.images:
        lbl = img.label or f"img{img.sort_order}"
        if p := url_to_path(img.original_image_url):
            files.append((f"{lbl}_original{p.suffix}", p))
        if p := url_to_path(img.ai_result_url):
            files.append((f"{lbl}_ai{p.suffix}", p))
        if p := url_to_path(img.editor_result_url):
            files.append((f"{lbl}_edited{p.suffix}", p))

    if not files:
        raise HTTPException(status_code=404, detail="No files available for this ticket")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for arc_name, path in files:
            zf.write(path, arc_name)
    buf.seek(0)

    try:
        log = DownloadLog(ticket_id=ticket_id, downloaded_by_id=current_user.id, file_type="zip")
        db.add(log)
        db.commit()
    except Exception:
        logger.warning("Failed to write download log (non-fatal)")

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="ticket_{ticket_id}_files.zip"'},
    )


@router.get("/editor/badge", response_model=TicketBadgeResponse)
async def get_badge(
    request: Request,
    current_user: User = Depends(get_current_editor),
    db: Session = Depends(get_db_session),
):
    from datetime import date
    base = db.query(Ticket).filter(Ticket.assigned_to_id == current_user.id)
    available_count = db.query(Ticket).filter(
        Ticket.assigned_to_id.is_(None),
        Ticket.status == "open",
    ).count()
    today_start = datetime.combine(date.today(), datetime.min.time())
    completed_today = db.query(func.count(Ticket.id)).filter(
        Ticket.assigned_to_id == current_user.id,
        Ticket.status == "done",
        Ticket.completed_at >= today_start,
    ).scalar() or 0
    avg_row = db.execute(
        text(
            "SELECT AVG(EXTRACT(EPOCH FROM (completed_at - claimed_at))/60) "
            "FROM tickets WHERE assigned_to_id=:uid AND status='done' "
            "AND claimed_at IS NOT NULL AND completed_at IS NOT NULL"
        ),
        {"uid": current_user.id},
    ).fetchone()
    avg_delivery_minutes = round(float(avg_row[0]), 1) if avg_row and avg_row[0] else None
    return TicketBadgeResponse(
        open_count=base.filter(Ticket.status == "open").count(),
        in_progress_count=base.filter(Ticket.status.in_(["claimed", "in_progress"])).count(),
        review_count=base.filter(Ticket.status == "review").count(),
        available_count=available_count,
        completed_today=completed_today,
        avg_delivery_minutes=avg_delivery_minutes,
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
