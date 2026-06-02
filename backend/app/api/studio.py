import io
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

from ..services.image_processing import AICompositingService, get_compositing_service

logger = logging.getLogger(__name__)

# Storage directory for preserving original and transparent images
STORAGE_DIR = Path(__file__).parent.parent / "storage"

# Static studios directory
STUDIOS_DIR = Path(__file__).parent.parent / "static" / "studios"

router = APIRouter()

# Simple studio catalog - Indoor luxury automotive studios only
studios = {
    "luxury_showroom": {
        "name": "Luxury Showroom",
        "image_url": "/static/studios/luxury_showroom.png",
        "preview_image_url": "/static/studios/luxury_showroom_preview.png",
        "floor_color": "#2a2a2a",
    },
    "white_minimal": {
        "name": "White Minimal Studio",
        "image_url": "/static/studios/white_minimal.png",
        "preview_image_url": "/static/studios/white_minimal_preview.png",
        "floor_color": "#f5f5f5",
    },
    "cinematic_dark": {
        "name": "Cinematic Dark Studio",
        "image_url": "/static/studios/cinematic_dark.png",
        "preview_image_url": "/static/studios/cinematic_dark_preview.png",
        "floor_color": "#0a0a0a",
    },
    "black_showroom": {
        "name": "Black Automotive Showroom",
        "image_url": "/static/studios/black_showroom.png",
        "preview_image_url": "/static/studios/black_showroom_preview.png",
        "floor_color": "#1a1a1a",
    },
    "luxury_exhibition": {
        "name": "Luxury Exhibition Hall",
        "image_url": "/static/studios/luxury_exhibition.png",
        "preview_image_url": "/static/studios/luxury_exhibition_preview.png",
        "floor_color": "#3a3a3a",
    },
    "glossy_reflective": {
        "name": "Glossy Reflective Floor Studio",
        "image_url": "/static/studios/glossy_reflective.png",
        "preview_image_url": "/static/studios/glossy_reflective_preview.png",
        "floor_color": "#252525",
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
        studio_key: Studio template key (e.g. 'luxury_showroom')

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
    file: UploadFile = File(..., description="Car image to process"),
    studio_key: str = Form("luxury_showroom", description="Studio template key"),
    enhance_wheels: bool = Form(True, description="Enhance wheel details"),
    enhance_paint: bool = Form(True, description="Enhance paint reflections"),
    export_quality: str = Form("hd", description="Export quality: hd or 4k"),
):
    """
    Process a car image through the AI compositing pipeline.

    Steps:
    1. Remove background using AI
    2. Scale vehicle to studio proportions
    3. [Optional] Apply lighting correction (feature-flagged)
    4. [Optional] Enhance wheels and paint (feature-flagged)
    5. Generate contact shadow
    6. Composite with studio background
    """
    # Validate studio
    if studio_key not in studios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid studio key. Available: {list(studios.keys())}",
        )

    # Generate unique ID for this generation
    generation_id = str(uuid.uuid4())

    # Read uploaded image
    try:
        contents = await file.read()
        original_image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")

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

    # Process through AI pipeline
    try:
        result_image = compositing_service.process(
            car_image=original_image,
            studio_background=studio_background,
            studio_color=studio_config["floor_color"],
            original_image=original_image if enhance_wheels else None,
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
    return [StudioOut(key=k, **v) for k, v in studios.items()]


@router.get("/{studio_key}")
def get_studio(studio_key: str):
    """Get details for a specific studio template."""
    if studio_key not in studios:
        raise HTTPException(status_code=404, detail="Studio not found")
    return {"key": studio_key, **studios[studio_key]}