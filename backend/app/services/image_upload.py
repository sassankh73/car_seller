"""
Image upload validation and conversion service.

Handles:
- Format validation (JPG, JPEG, PNG, WEBP, HEIC, HEIF, AVIF, TIFF, BMP)
- Automatic conversion to JPEG for non-standard formats
- EXIF orientation preservation
- ICC color profile preservation
- Image integrity validation
- Resolution and file size validation
"""

import io
import logging
from enum import Enum
from typing import Optional, Tuple

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# Maximum file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

# Minimum resolution: 640x480
MIN_RESOLUTION = (640, 480)

# Supported MIME types and their corresponding format strings for Pillow
SUPPORTED_MIME_TYPES = {
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
    "image/heic": "HEIC",
    "image/heif": "HEIF",
    "image/avif": "AVIF",
    "image/tiff": "TIFF",
    "image/tif": "TIFF",
    "image/bmp": "BMP",
}

# Supported file extensions
SUPPORTED_EXTENSIONS = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
    ".heic": "HEIC",
    ".heif": "HEIF",
    ".avif": "AVIF",
    ".tiff": "TIFF",
    ".tif": "TIFF",
    ".bmp": "BMP",
}

# Formats that should be converted to JPEG internally
FORMATS_TO_CONVERT = {"HEIC", "HEIF", "AVIF", "TIFF", "TIF", "BMP"}

# Output format for internal processing
INTERNAL_FORMAT = "JPEG"


class ImageValidationError(Enum):
    """Image validation error types."""
    UNSUPPORTED_FORMAT = "unsupported_format"
    CORRUPTED = "corrupted"
    RESOLUTION_TOO_SMALL = "resolution_too_small"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    EMPTY_FILE = "empty_file"


class ImageUploadError(Exception):
    """Custom exception for image upload errors."""

    def __init__(self, error_type: ImageValidationError, message: str):
        self.error_type = error_type
        self.message = message
        super().__init__(message)


def get_format_from_extension(filename: str) -> Optional[str]:
    """Get the Pillow format string from a file extension."""
    import os
    ext = os.path.splitext(filename.lower())[1]
    return SUPPORTED_EXTENSIONS.get(ext)


def get_format_from_mime(mime_type: str) -> Optional[str]:
    """Get the Pillow format string from a MIME type."""
    return SUPPORTED_MIME_TYPES.get(mime_type.lower())


def validate_and_convert_upload(
    file_content: bytes,
    filename: str,
    mime_type: Optional[str] = None,
) -> Tuple[bytes, str, str]:
    """
    Validate and convert an uploaded image.

    This function:
    1. Validates the file is not empty
    2. Validates file size
    3. Determines the image format from extension and/or MIME type
    4. Opens the image and validates integrity
    5. Applies EXIF orientation
    6. Converts non-standard formats to JPEG internally
    7. Preserves ICC color profiles
    8. Validates minimum resolution

    Args:
        file_content: Raw bytes of the uploaded file
        filename: Original filename (used for format detection)
        mime_type: Optional MIME type from the upload

    Returns:
        Tuple of (converted_image_bytes, original_format, internal_format)
        - converted_image_bytes: The processed image bytes (JPEG for non-native formats)
        - original_format: The format string of the original upload (e.g., "HEIC", "PNG")
        - internal_format: The format after conversion (always "JPEG" or "PNG")

    Raises:
        ImageUploadError: If validation fails
    """
    # 1. Check empty file
    if not file_content or len(file_content) == 0:
        raise ImageUploadError(
            ImageValidationError.EMPTY_FILE,
            "The uploaded file is empty."
        )

    # 2. Check file size
    if len(file_content) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE // (1024 * 1024)
        raise ImageUploadError(
            ImageValidationError.FILE_SIZE_EXCEEDED,
            f"Maximum file size exceeded. The file is {len(file_content) // (1024 * 1024)}MB, "
            f"but the maximum is {max_mb}MB."
        )

    # 3. Determine format
    original_format = None
    if mime_type:
        original_format = get_format_from_mime(mime_type)
    if not original_format:
        original_format = get_format_from_extension(filename)
    if not original_format:
        raise ImageUploadError(
            ImageValidationError.UNSUPPORTED_FORMAT,
            f"Unsupported file format. Supported formats: JPG, JPEG, PNG, WEBP, HEIC, HEIF, AVIF, TIFF, BMP."
        )

    # 4. Open and validate image
    try:
        # Try to register HEIC/HEIF opener
        _register_heif_opener()

        img = Image.open(io.BytesIO(file_content))
        img.load()  # Force load to detect corruption
    except Exception as e:
        logger.warning(f"Failed to open image {filename}: {e}")
        raise ImageUploadError(
            ImageValidationError.CORRUPTED,
            "The image file is corrupted or cannot be read."
        )

    # 5. Check resolution
    width, height = img.size
    min_w, min_h = MIN_RESOLUTION
    if width < min_w or height < min_h:
        raise ImageUploadError(
            ImageValidationError.RESOLUTION_TOO_SMALL,
            f"Image resolution too small. The image is {width}x{height}px, "
            f"but the minimum is {min_w}x{min_h}px."
        )

    # 6. Apply EXIF orientation
    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        logger.debug(f"Could not apply EXIF transpose: {e}")
        # Continue without EXIF transpose if it fails

    # 7. Convert to appropriate internal format
    needs_conversion = original_format.upper() in FORMATS_TO_CONVERT

    if needs_conversion:
        # Convert to JPEG for internal processing
        output_format = INTERNAL_FORMAT
        # Handle color mode conversion for JPEG
        if img.mode in ("RGBA", "LA", "P"):
            # Convert to RGB with white background for transparency
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Preserve ICC color profile
        icc_profile = img.info.get("icc_profile")

        # Save as JPEG
        output_buffer = io.BytesIO()
        save_kwargs = {
            "format": "JPEG",
            "quality": 95,
            "optimize": True,
        }
        if icc_profile:
            save_kwargs["icc_profile"] = icc_profile

        img.save(output_buffer, **save_kwargs)
        converted_bytes = output_buffer.getvalue()

        logger.info(
            f"Converted image from {original_format} to JPEG: "
            f"{width}x{height}px, {len(file_content)} -> {len(converted_bytes)} bytes"
        )
    else:
        # Keep the original format but still process (EXIF, etc.)
        output_format = original_format.upper()
        # For PNG and WEBP, keep as-is; for JPEG, re-save with EXIF applied
        if output_format == "JPEG" or output_format == "JPG":
            output_format = "JPEG"
            # Re-save JPEG with EXIF orientation applied
            icc_profile = img.info.get("icc_profile")
            output_buffer = io.BytesIO()
            save_kwargs = {
                "format": "JPEG",
                "quality": 95,
                "optimize": True,
            }
            if icc_profile:
                save_kwargs["icc_profile"] = icc_profile

            # Handle color mode
            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                img = background
            elif img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            img.save(output_buffer, **save_kwargs)
            converted_bytes = output_buffer.getvalue()
        else:
            # For PNG, WEBP - just save with EXIF orientation applied
            output_buffer = io.BytesIO()
            img.save(output_buffer, format=output_format)
            converted_bytes = output_buffer.getvalue()

    return converted_bytes, original_format.upper(), output_format


def _register_heif_opener():
    """Register the HEIF/HEIC opener with Pillow if available."""
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
        logger.debug("HEIF/HEIC opener registered successfully")
    except ImportError:
        logger.debug("pillow-heif not available, HEIC/HEIF support disabled")
    except Exception as e:
        logger.debug(f"Could not register HEIF opener: {e}")


def get_accepted_mime_types() -> list[str]:
    """Get list of accepted MIME types for client-side validation."""
    return list(SUPPORTED_MIME_TYPES.keys())


def get_accepted_extensions() -> list[str]:
    """Get list of accepted file extensions for client-side validation."""
    return list(SUPPORTED_EXTENSIONS.keys())