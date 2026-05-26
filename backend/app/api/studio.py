import io
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

from ..services.image_processing import AICompositingService, get_compositing_service

router = APIRouter()

# Simple studio catalog - Indoor luxury automotive studios only
studios = {
    "luxury_showroom": {
        "name": "Luxury Showroom",
        "image_url": "/static/studios/luxury_showroom.jpg",
        "floor_color": "#2a2a2a",
    },
    "white_minimal": {
        "name": "White Minimal Studio",
        "image_url": "/static/studios/white_minimal.jpg",
        "floor_color": "#f5f5f5",
    },
    "cinematic_dark": {
        "name": "Cinematic Dark Studio",
        "image_url": "/static/studios/cinematic_dark.jpg",
        "floor_color": "#0a0a0a",
    },
    "black_showroom": {
        "name": "Black Automotive Showroom",
        "image_url": "/static/studios/black_showroom.jpg",
        "floor_color": "#1a1a1a",
    },
    "luxury_exhibition": {
        "name": "Luxury Exhibition Hall",
        "image_url": "/static/studios/luxury_exhibition.jpg",
        "floor_color": "#3a3a3a",
    },
    "glossy_reflective": {
        "name": "Glossy Reflective Floor Studio",
        "image_url": "/static/studios/glossy_reflective.jpg",
        "floor_color": "#252525",
    },
}


class StudioOut(BaseModel):
    key: str
    name: str
    image_url: str


class ProcessRequest(BaseModel):
    studio_key: str
    enhance_wheels: bool = True
    enhance_paint: bool = True
    export_quality: str = "hd"  # hd or 4k


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
    2. Apply perspective correction
    3. Apply lighting correction
    4. Preserve wheel details
    5. Enhance paint reflections
    6. Generate realistic shadow
    7. Generate floor reflection
    8. Composite with studio background
    """
    # Validate studio
    if studio_key not in studios:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid studio key. Available: {list(studios.keys())}",
        )

    # Read uploaded image
    try:
        contents = await file.read()
        original_image = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")

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

    # Load studio background if available
    studio_background = None
    # In production, load from file system or S3
    # studio_background = Image.open(f"app/static/studios/{studio_key}.jpg")

    # Process through AI pipeline
    try:
        result_image = compositing_service.process(
            car_image=original_image,
            studio_background=studio_background,
            studio_color=studio_config["floor_color"],
            original_image=original_image if enhance_wheels else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    # Save result to buffer
    output_buffer = io.BytesIO()
    result_image.save(output_buffer, format="PNG", quality=95)
    output_buffer.seek(0)

    # Return as file response
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        output_buffer,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="autostudio_{studio_key}.png"',
            "X-Studio-Key": studio_key,
            "X-Export-Quality": export_quality,
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
