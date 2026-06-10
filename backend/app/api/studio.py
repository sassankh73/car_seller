import io
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image
from pydantic import BaseModel

from ..services.image_processing import StudioShadowProfile
from ..services.image_upload import validate_and_convert_upload, ImageUploadError, ImageValidationError
from ..middleware.auth import get_current_user, get_db_session
from ..models import Project, Ticket, TicketImage, User
from ..services.image_processing import get_compositing_service
from ..services.billing import get_plan_features

logger = logging.getLogger(__name__)

# Storage directory for preserving original and transparent images
STORAGE_DIR = Path(__file__).parent.parent / "storage"

# Static results directory (accessible via /static/results/)
RESULTS_DIR = Path(__file__).parent.parent / "static" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Static originals directory (raw pre-AI photos for editors)
ORIGINALS_DIR = Path(__file__).parent.parent / "static" / "originals"
ORIGINALS_DIR.mkdir(parents=True, exist_ok=True)

# Static studios directory
STUDIOS_DIR = Path(__file__).parent.parent / "static" / "studios"

router = APIRouter()

# Studio catalog — Automotive corner studios with 3D perspective
# Realistic indoor photo studio rooms with visible rear wall, left wall, right wall, ceiling, floor
# Sharp 90° corners — no cyclorama, no curved transitions, no infinity walls
# Each studio includes a shadow profile tuned for corner perspective grounding
# floor_y=0.78: vehicle wheels sit on the foreground floor in corner perspective
studios = {
    "white_corner_light_epoxy": {
        "name": "White Corner Studio — Light Gray Epoxy",
        "image_url": "/static/studios/white_corner_light_epoxy.png",
        "preview_image_url": "/static/studios/white_corner_light_epoxy_preview.png",
        "floor_color": "#D8D8D8",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=32,
            shadow_opacity=0.26,
            shadow_length=0.9,
            tire_shadow_blur=13,
            tire_shadow_opacity=0.48,
            ao_shadow_opacity=0.32,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.035,
            vehicle_scale=1.0,
            shadow_strength=1.15,
            horizon_y=0.45,
        ),
    },
    "white_corner_ceramic_tile": {
        "name": "White Corner Studio — Ceramic Tile",
        "image_url": "/static/studios/white_corner_ceramic_tile.png",
        "preview_image_url": "/static/studios/white_corner_ceramic_tile_preview.png",
        "floor_color": "#D0D0D0",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=32,
            shadow_opacity=0.26,
            shadow_length=0.9,
            tire_shadow_blur=13,
            tire_shadow_opacity=0.48,
            ao_shadow_opacity=0.32,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.035,
            vehicle_scale=1.0,
            shadow_strength=1.15,
            horizon_y=0.45,
        ),
    },
    "light_gray_corner_medium_epoxy": {
        "name": "Light Gray Corner Studio — Medium Gray Epoxy",
        "image_url": "/static/studios/light_gray_corner_medium_epoxy.png",
        "preview_image_url": "/static/studios/light_gray_corner_medium_epoxy_preview.png",
        "floor_color": "#909090",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=34,
            shadow_opacity=0.28,
            shadow_length=1.0,
            tire_shadow_blur=14,
            tire_shadow_opacity=0.52,
            ao_shadow_opacity=0.34,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.035,
            vehicle_scale=1.0,
            shadow_strength=1.15,
            horizon_y=0.45,
        ),
    },
    "dark_gray_corner_concrete": {
        "name": "Dark Gray Corner Studio — Concrete Floor",
        "image_url": "/static/studios/dark_gray_corner_concrete.png",
        "preview_image_url": "/static/studios/dark_gray_corner_concrete_preview.png",
        "floor_color": "#555555",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=36,
            shadow_opacity=0.28,
            shadow_length=1.0,
            tire_shadow_blur=15,
            tire_shadow_opacity=0.50,
            ao_shadow_opacity=0.35,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.040,
            vehicle_scale=1.0,
            shadow_strength=1.20,
            horizon_y=0.45,
        ),
    },
    "black_corner_dark_epoxy": {
        "name": "Black Corner Studio — Dark Epoxy Floor",
        "image_url": "/static/studios/black_corner_dark_epoxy.png",
        "preview_image_url": "/static/studios/black_corner_dark_epoxy_preview.png",
        "floor_color": "#353535",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=38,
            shadow_opacity=0.22,
            shadow_length=1.1,
            tire_shadow_blur=16,
            tire_shadow_opacity=0.45,
            ao_shadow_opacity=0.30,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.040,
            vehicle_scale=1.0,
            shadow_strength=1.25,
            horizon_y=0.45,
        ),
    },
    "commercial_showroom_tile": {
        "name": "Commercial Showroom — Tile Floor",
        "image_url": "/static/studios/commercial_showroom_tile.png",
        "preview_image_url": "/static/studios/commercial_showroom_tile_preview.png",
        "floor_color": "#A0A0A0",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=34,
            shadow_opacity=0.28,
            shadow_length=1.0,
            tire_shadow_blur=14,
            tire_shadow_opacity=0.52,
            ao_shadow_opacity=0.34,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.035,
            vehicle_scale=1.0,
            shadow_strength=1.15,
            horizon_y=0.45,
        ),
    },
    "industrial_concrete": {
        "name": "Industrial Automotive Studio — Concrete Floor",
        "image_url": "/static/studios/industrial_concrete.png",
        "preview_image_url": "/static/studios/industrial_concrete_preview.png",
        "floor_color": "#484848",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=36,
            shadow_opacity=0.26,
            shadow_length=1.0,
            tire_shadow_blur=15,
            tire_shadow_opacity=0.48,
            ao_shadow_opacity=0.33,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.040,
            vehicle_scale=1.0,
            shadow_strength=1.20,
            horizon_y=0.45,
        ),
    },
    "matte_black_automotive": {
        "name": "Matte Black Automotive Studio",
        "image_url": "/static/studios/matte_black_automotive.png",
        "preview_image_url": "/static/studios/matte_black_automotive_preview.png",
        "floor_color": "#151515",
        "shadow_profile": StudioShadowProfile(
            floor_y=0.78,
            shadow_direction="center",
            shadow_blur=40,
            shadow_opacity=0.20,
            shadow_length=1.1,
            tire_shadow_blur=16,
            tire_shadow_opacity=0.42,
            ao_shadow_opacity=0.28,
            ao_shadow_width=1.0,
            ao_shadow_height=0.05,
            vehicle_y_offset=0.045,
            vehicle_scale=1.0,
            shadow_strength=1.30,
            horizon_y=0.45,
        ),
    },
}


class StudioOut(BaseModel):
    key: str
    name: str
    image_url: str
    preview_image_url: str


class ProcessRequest(BaseModel):
    studio_key: str
    enhance_wheels: bool = True
    enhance_paint: bool = True
    export_quality: str = "hd"  # hd or 4k


def load_studio_background(studio_key: str) -> Optional[Image.Image]:
    """Load a studio background image from the filesystem.

    Tries the full-size image first, then falls back to the preview image.
    Returns None if neither is available (caller should use solid color fallback).

    Args:
        studio_key: Studio template key (e.g. 'white_corner_light_epoxy')

    Returns:
        PIL Image (RGBA) or None
    """
    # Try full-size studio image first
    full_path = STUDIOS_DIR / f"{studio_key}.png"
    if not full_path.exists():
        # Try JPG variant
        full_path = STUDIOS_DIR / f"{studio_key}.jpg"

    if not full_path.exists():
        # Fall back to preview image
        preview_path = STUDIOS_DIR / f"{studio_key}_preview.png"
        if not preview_path.exists():
            preview_path = STUDIOS_DIR / f"{studio_key}_preview.jpg"

        if preview_path.exists():
            full_path = preview_path
            logger.info(
                "Full studio image not found, using preview: %s", preview_path
            )
        else:
            logger.warning(
                "No studio background image found for key '%s' "
                "(checked %s and preview variants)",
                studio_key,
                STUDIOS_DIR,
            )
            return None

    try:
        bg = Image.open(full_path).convert("RGBA")
        logger.info(
            "Loaded studio background: %s (%dx%d)", full_path, bg.size[0], bg.size[1]
        )
        return bg
    except Exception as e:
        logger.error("Failed to load studio background %s: %s", full_path, e)
        return None


@router.post("/process")
async def process_image(
    request: Request,
    file: UploadFile = File(..., description="Car image to process"),
    studio_key: str = Form("white_corner_light_epoxy", description="Studio template key"),
    enhance_wheels: bool = Form(True, description="Enhance wheel details"),
    enhance_paint: bool = Form(True, description="Enhance paint reflections"),
    export_quality: str = Form("hd", description="Export quality: hd or 4k"),
    vehicle_order_id: Optional[str] = Form(None, description="UUID grouping all photos in one vehicle order"),
    image_label: Optional[str] = Form(None, description="Angle label: front, rear, left_side, right_side, front_45, rear_45"),
    sort_order: int = Form(0, description="Position within the order batch"),
):
    """
    Process a car image through the AI compositing pipeline.

    Steps:
    1. Remove background using AI
    2. Classify vehicle type (SUV/sedan/coupe/wagon/hatchback)
    3. Scale vehicle to studio proportions based on type
    4. Detect wheel contact points for floor anchoring
    5. [Optional] Apply lighting correction (feature-flagged)
    6. [Optional] Enhance wheels and paint (feature-flagged)
    7. Generate AO shadow + tire contact shadows + body floor shadow
    8. Composite with studio background using wheel contact anchoring
    """
    # Validate studio
    if studio_key not in studios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid studio key. Available: {list(studios.keys())}",
        )

    # Auth middleware now requires a valid token for POST /api/studio/process.
    # get_current_user reads from request.state set by the middleware.
    current_user = get_current_user(request)
    if current_user is None:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(status_code=401, detail="Not authenticated")

    # Generate unique ID for this generation
    generation_id = str(uuid.uuid4())

    # Read and preprocess the uploaded image through the compatibility layer
    # This normalizes ALL formats to JPEG RGB with proper orientation,
    # color profiles, and alpha handling. Never returns HTTP 500 for format issues.
    try:
        contents = await file.read()
        filename = file.filename or "upload.jpg"
        mime_type = file.content_type

        # Validate and convert the image through the universal compatibility layer
        try:
            converted_bytes, original_format, internal_format = validate_and_convert_upload(
                file_content=contents,
                filename=filename,
                mime_type=mime_type,
            )
            logger.info(
                "Image preprocessed: filename=%s, original_format=%s → %s",
                filename, original_format, internal_format
            )
            original_image = Image.open(io.BytesIO(converted_bytes))
            original_image.load()  # Ensure fully loaded
        except ImageUploadError as e:
            # Map ImageValidationError to proper HTTP status codes (never 500)
            error_map = {
                ImageValidationError.EMPTY_FILE: 400,
                ImageValidationError.CORRUPTED: 400,
                ImageValidationError.UNSUPPORTED_FORMAT: 415,
                ImageValidationError.FILE_SIZE_EXCEEDED: 413,
                ImageValidationError.RESOLUTION_TOO_SMALL: 400,
                ImageValidationError.DIMENSIONS_TOO_LARGE: 413,
                ImageValidationError.INVALID_IMAGE_CONTENT: 400,
            }
            status_code = error_map.get(e.error_type, 400)
            logger.warning(
                "Upload validation failed: filename=%s, error=%s, detail=%s",
                filename, e.error_type.value, e.message
            )
            raise HTTPException(status_code=status_code, detail=e.message)

    except HTTPException:
        raise  # Re-raise our mapped 4xx errors
    except Exception as e:
        logger.error("Unexpected error reading upload: %s", str(e)[:200])
        raise HTTPException(
            status_code=400,
            detail="Failed to process the uploaded image. Please ensure the file is a valid image."
        )

    # Preserve original uploaded image to filesystem
    original_static_url: Optional[str] = None
    try:
        gen_dir = STORAGE_DIR / generation_id
        gen_dir.mkdir(parents=True, exist_ok=True)
        original_image.save(gen_dir / "original.png", format="PNG")
        logger.info("Saved original image to %s", gen_dir / "original.png")
    except Exception as e:
        logger.warning("Failed to save original image: %s (non-fatal, continuing)", e)

    # Also save original to static/originals/ so editors can access it via HTTP
    try:
        orig_filename = f"orig_{generation_id}.png"
        original_image.save(ORIGINALS_DIR / orig_filename, format="PNG")
        original_static_url = f"/static/originals/{orig_filename}"
        logger.info("Saved original to static: %s", original_static_url)
    except Exception as e:
        logger.warning("Failed to save original to static (non-fatal): %s", e)

    # Full AI compositing pipeline
    result_url: Optional[str] = None
    composited_image: Optional[Image.Image] = None
    rembg_used = False
    apply_watermark = False

    try:
        # Load plan features and logo for this user
        logo_image = None
        logo_placement_val = "bottom_right"
        logo_scale_val = 0.12

        db_for_plan = get_db_session(request)
        if current_user and db_for_plan:
            try:
                user_obj = db_for_plan.query(User).filter(User.id == current_user.id).first()
                if user_obj:
                    plan_features = get_plan_features(user_obj)
                    apply_watermark = plan_features.get("watermark", False)
                    logo_placement_val = user_obj.logo_placement or "bottom_right"
                    logo_scale_val = user_obj.logo_scale or 0.12
                    if plan_features.get("logo_branding", False) and user_obj.logo_data:
                        try:
                            logo_image = Image.open(io.BytesIO(user_obj.logo_data)).convert("RGBA")
                        except Exception as _logo_err:
                            logger.warning("Failed to load user logo (non-fatal): %s", _logo_err)
            except Exception as _plan_err:
                logger.warning("Failed to load plan features (non-fatal): %s", _plan_err)

        # Initialise compositing service (uses rembg when ENABLE_REMBG=true)
        compositing_service = get_compositing_service()
        rembg_used = getattr(compositing_service, "rembg_used", False)

        # Load studio background
        studio_config = studios[studio_key]
        studio_background = load_studio_background(studio_key)

        # Run the full pipeline: bg removal → shadow → composite → logo → watermark
        composited_image = compositing_service.process(
            car_image=original_image,
            studio_background=studio_background,
            studio_color=studio_config.get("floor_color", "#D0D0D0"),
            original_image=original_image,
            shadow_profile=studio_config["shadow_profile"],
            logo_image=logo_image,
            logo_placement=logo_placement_val,
            logo_scale=logo_scale_val,
            apply_watermark=apply_watermark,
        )

        result_filename = f"{generation_id}.png"
        result_path = RESULTS_DIR / result_filename
        composited_image.save(result_path, format="PNG")
        result_url = f"/static/results/{result_filename}"
        logger.info("AI composited result saved: %s (rembg=%s)", result_url, rembg_used)

    except Exception as e:
        logger.error("AI compositing failed, falling back to original: %s", str(e)[:500])
        composited_image = None
        try:
            result_filename = f"{generation_id}.png"
            result_path = RESULTS_DIR / result_filename
            original_image.save(result_path, format="PNG")
            result_url = f"/static/results/{result_filename}"
            logger.info("Fallback: saved original as result: %s", result_url)
        except Exception as _fe:
            logger.warning("Fallback save also failed: %s", _fe)

    # Build output buffer for streaming response
    output_buffer = io.BytesIO()
    (composited_image or original_image).save(output_buffer, format="PNG")
    output_buffer.seek(0)

    # Create project record in DB (TASK-8)
    project_id: Optional[int] = None
    db = get_db_session(request)
    if current_user and db and result_url:
        try:
            file_base = (file.filename or "upload").rsplit(".", 1)[0]
            project_name = file_base if file_base else f"Photo {studio_key}"
            proj = Project(
                name=project_name,
                background=studio_key,
                image_url=result_url,
                original_image_url=original_static_url,
                original_format=original_format,
                watermark_applied=apply_watermark,
                user_id=current_user.id,
            )
            db.add(proj)
            db.commit()
            db.refresh(proj)
            project_id = proj.id

            # Order-level ticket: find-or-create one ticket per vehicle_order_id, then add a TicketImage row
            try:
                ticket: Optional[Ticket] = None
                is_new_ticket = False

                if vehicle_order_id:
                    ticket = db.query(Ticket).filter(
                        Ticket.vehicle_order_id == vehicle_order_id
                    ).first()

                if ticket is None:
                    # First photo for this order (or single-image upload) — create the ticket
                    ticket_title = (
                        f"Vehicle Order — {proj.name}"
                        if vehicle_order_id
                        else f"{proj.name} — Studio {studio_key}"
                    )
                    ticket = Ticket(
                        vehicle_order_id=vehicle_order_id,
                        project_id=proj.id,
                        assigned_to_id=None,
                        created_by_id=None,
                        status="open",
                        priority="normal",
                        title=ticket_title,
                        description=None,
                        customer_user_id=current_user.id,
                        original_image_url=original_static_url,
                        ai_result_url=result_url,
                        result_image_url=None,
                    )
                    db.add(ticket)
                    db.flush()  # get ticket.id before adding TicketImage
                    is_new_ticket = True
                    logger.info(
                        "Created ticket %s for order %s", ticket.id, vehicle_order_id or "single"
                    )

                # Always add a TicketImage for this photo
                ticket_img = TicketImage(
                    ticket_id=ticket.id,
                    project_id=proj.id,
                    label=image_label or "photo",
                    sort_order=sort_order,
                    original_image_url=original_static_url,
                    ai_result_url=result_url,
                )
                db.add(ticket_img)
                db.commit()
                logger.info(
                    "Added TicketImage for ticket %s, project %s, label=%s",
                    ticket.id, proj.id, image_label
                )

                # Notify editors only when the ticket is first created
                if is_new_ticket:
                    try:
                        from app.models import Role as RoleEnum
                        from app.services.email import send_new_ticket_notification
                        editors = db.query(User).filter(
                            User.role == RoleEnum.EDITOR,
                            User.is_disabled == False,
                        ).all()
                        for ed in editors:
                            send_new_ticket_notification(
                                editor_email=ed.email,
                                editor_name=ed.name or ed.email,
                                ticket_id=ticket.id,
                                ticket_title=ticket.title,
                                project_name=proj.name,
                            )
                    except Exception as _email_err:
                        logger.warning("Editor broadcast email failed (non-fatal): %s", _email_err)

            except Exception as e:
                logger.warning("Failed to create/update order ticket (non-fatal): %s", e)
                try:
                    db.rollback()
                except Exception:
                    pass

        except Exception as e:
            logger.warning("Failed to save project record: %s (non-fatal)", e)
            try:
                db.rollback()
            except Exception:
                pass

    # Return as file response
    from fastapi.responses import StreamingResponse

    resp_headers = {
        "Content-Disposition": f'attachment; filename="autostudio_{studio_key}.png"',
        "X-Studio-Key": studio_key,
        "X-Export-Quality": export_quality,
        "X-Generation-Id": generation_id,
        "X-Rembg-Used": "false",
    }
    if result_url:
        resp_headers["X-Result-Url"] = result_url
    if project_id:
        resp_headers["X-Project-Id"] = str(project_id)

    return StreamingResponse(
        output_buffer,
        media_type="image/png",
        headers=resp_headers,
    )


@router.get("", response_model=List[StudioOut])
def list_studios():
    """List all available studio templates."""
    result = []
    for k, v in studios.items():
        result.append(StudioOut(
            key=k,
            name=v["name"],
            image_url=v["image_url"],
            preview_image_url=v["preview_image_url"],
        ))
    return result


@router.get("/{studio_key}")
def get_studio(studio_key: str):
    """Get details for a specific studio template."""
    if studio_key not in studios:
        raise HTTPException(status_code=404, detail="Studio not found")
    config = studios[studio_key]
    # Return studio details, converting shadow_profile to dict for JSON serialization
    result = {
        "key": studio_key,
        "name": config["name"],
        "image_url": config["image_url"],
        "preview_image_url": config["preview_image_url"],
        "floor_color": config["floor_color"],
        "shadow_profile": {
            "floor_y": config["shadow_profile"].floor_y,
            "shadow_direction": config["shadow_profile"].shadow_direction,
            "shadow_blur": config["shadow_profile"].shadow_blur,
            "shadow_opacity": config["shadow_profile"].shadow_opacity,
            "shadow_length": config["shadow_profile"].shadow_length,
            "tire_shadow_blur": config["shadow_profile"].tire_shadow_blur,
            "tire_shadow_opacity": config["shadow_profile"].tire_shadow_opacity,
            "ao_shadow_opacity": config["shadow_profile"].ao_shadow_opacity,
            "ao_shadow_width": config["shadow_profile"].ao_shadow_width,
            "ao_shadow_height": config["shadow_profile"].ao_shadow_height,
            "vehicle_y_offset": config["shadow_profile"].vehicle_y_offset,
            "vehicle_scale": config["shadow_profile"].vehicle_scale,
            "shadow_strength": config["shadow_profile"].shadow_strength,
            "horizon_y": config["shadow_profile"].horizon_y,
        },
    }
    return result