import io
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image
from pydantic import BaseModel

from ..services.image_processing import AICompositingService, StudioShadowProfile, get_compositing_service
from ..services.image_upload import validate_and_convert_upload, ImageUploadError, ImageValidationError
from ..middleware.auth import get_current_user, get_db_session
from ..services.billing import get_plan_features

logger = logging.getLogger(__name__)

# Storage directory for preserving original and transparent images
STORAGE_DIR = Path(__file__).parent.parent / "storage"

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

    # Optional auth: studio is publicly callable but authenticated users get their plan features.
    # The middleware skips /api/studio, so we resolve the token manually here.
    current_user = get_current_user(request)
    if current_user is None:
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            try:
                from ..services.auth import decode_access_token, get_user_by_email
                from ..models import SessionLocal
                payload = decode_access_token(parts[1])
                if payload and payload.sub:
                    _db = SessionLocal()
                    try:
                        _user = get_user_by_email(_db, email=payload.sub)
                        if _user:
                            # Eagerly access lazy-loaded relationships before session closes
                            _ = _user.subscription
                            _ = _user.logo_data
                            current_user = _user
                    finally:
                        _db.close()
            except Exception as _e:
                logger.debug("Optional auth failed in studio /process: %s", _e)

    if current_user is not None:
        plan_features = get_plan_features(current_user)
    else:
        from ..services.billing import PLAN_FEATURES
        plan_features = PLAN_FEATURES["free"]

    apply_watermark: bool = plan_features.get("watermark", True)

    # Load user logo if allowed
    logo_img: Optional[Image.Image] = None
    logo_placement = "bottom_right"
    logo_scale = 0.12
    if plan_features.get("logo_branding") and current_user is not None and current_user.logo_data:
        try:
            logo_img = Image.open(io.BytesIO(current_user.logo_data)).convert("RGBA")
            logo_placement = current_user.logo_placement or "bottom_right"
            logo_scale = current_user.logo_scale or 0.12
        except Exception as e:
            logger.warning("Failed to load user logo (skipping): %s", e)

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
    try:
        gen_dir = STORAGE_DIR / generation_id
        gen_dir.mkdir(parents=True, exist_ok=True)
        original_image.save(gen_dir / "original.png", format="PNG")
        logger.info("Saved original image to %s", gen_dir / "original.png")
    except Exception as e:
        logger.warning("Failed to save original image: %s (non-fatal, continuing)", e)

    # Get studio config
    studio_config = studios[studio_key]

    # Initialize compositing service
    compositing_service = get_compositing_service()

    # Set resolution based on export quality
    if export_quality == "4k":
        compositing_service.studio_width = 3840
        compositing_service.studio_height = 2160
    else:  # hd
        compositing_service.studio_width = 1920
        compositing_service.studio_height = 1080

    # Load studio background image from filesystem
    studio_background = load_studio_background(studio_key)

    # Get studio-specific shadow profile
    shadow_profile = studio_config.get("shadow_profile", StudioShadowProfile())

    # Process through AI pipeline
    try:
        result_image = compositing_service.process(
            car_image=original_image,
            studio_background=studio_background,
            studio_color=studio_config["floor_color"],
            original_image=original_image if enhance_wheels else None,
            shadow_profile=shadow_profile,
            logo_image=logo_img,
            logo_placement=logo_placement,
            logo_scale=logo_scale,
            apply_watermark=apply_watermark,
        )
    except Exception as e:
        logger.exception("Processing failed for studio %s, generation %s", studio_key, generation_id)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    # Preserve transparent vehicle image (background-removed) to filesystem
    # Uses the cached transparent_image from the pipeline (avoids double rembg call)
    try:
        transparent_img = compositing_service.transparent_image
        if transparent_img is not None:
            gen_dir = STORAGE_DIR / generation_id
            transparent_img.save(gen_dir / "transparent.png", format="PNG")
            logger.info("Saved transparent vehicle image to %s", gen_dir / "transparent.png")
        else:
            logger.warning("No transparent image available from pipeline (skipping save)")
    except Exception as e:
        logger.warning("Failed to save transparent image: %s (non-fatal, continuing)", e)

    # Save result to buffer
    output_buffer = io.BytesIO()
    result_image.save(output_buffer, format="PNG", quality=95)
    output_buffer.seek(0)

    # Track whether rembg was actually used
    rembg_used = compositing_service.rembg_used

    # Return as file response
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        output_buffer,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="autostudio_{studio_key}.png"',
            "X-Studio-Key": studio_key,
            "X-Export-Quality": export_quality,
            "X-Generation-Id": generation_id,
            "X-Rembg-Used": str(rembg_used).lower(),
        },
    )


@router.get("/", response_model=List[StudioOut])
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