"""
Image upload validation and conversion service.

Handles:
- Format validation (JPG, JPEG, PNG, WEBP, HEIC, HEIF, AVIF, TIFF, BMP)
- Automatic conversion to standardized JPEG (RGB, quality 95) for all formats
- EXIF orientation correction
- ICC color profile normalization to sRGB
- CMYK to RGB conversion
- RGBA/PA/LA alpha channel removal (white background composite)
- Metadata stripping (problematic EXIF data removed, orientation preserved)
- Image integrity validation (corrupted, zero-byte, invalid content)
- Resolution validation (min 640x480) and max dimension limits (auto-resize)
- Content-based format detection via magic bytes (fallback when MIME/extension fail)
- Detailed backend logging of original format, dimensions, mode, and conversions

This is the universal compatibility layer that normalizes ALL uploaded images
before they reach the AI processing pipeline. It ensures that regardless of
device (iPhone, Android, MacBook, Windows, DSLR, social media exports,
screenshots), the image is converted to a predictable, safe internal format.
"""

import io
import logging
import os
from enum import Enum
from typing import Optional, Tuple

from PIL import Image, ImageCms, ImageOps

logger = logging.getLogger(__name__)

# Maximum file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

# Minimum resolution: 640x480
MIN_RESOLUTION = (640, 480)

# Maximum dimensions: images exceeding this will be auto-resized preserving aspect ratio
MAX_DIMENSIONS = (10000, 10000)

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

# Magic byte signatures for content-based format detection
MAGIC_SIGNATURES = {
    b"\xff\xd8\xff": "JPEG",        # JPEG (starts with FFD8FF)
    b"\x89PNG\r\n\x1a\n": "PNG",   # PNG
    b"RIFF": "WEBP",                # WEBP (RIFF container)
    b"BM": "BMP",                   # BMP
    b"II\x2a\x00": "TIFF",         # TIFF (little-endian)
    b"MM\x00\x2a": "TIFF",         # TIFF (big-endian)
    b"\x00\x00\x00 ftypheic": "HEIC",  # HEIC
    b"\x00\x00\x00 ftypheif": "HEIF",  # HEIF
    b"\x00\x00\x00 ftypavif": "AVIF",  # AVIF
    b"\x00\x00\x00 ftypmif1": "HEIF",  # HEIF variant
}

# Output format for internal processing
INTERNAL_FORMAT = "JPEG"
INTERNAL_QUALITY = 95


class ImageValidationError(Enum):
    """Image validation error types."""
    UNSUPPORTED_FORMAT = "unsupported_format"
    CORRUPTED = "corrupted"
    RESOLUTION_TOO_SMALL = "resolution_too_small"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    EMPTY_FILE = "empty_file"
    DIMENSIONS_TOO_LARGE = "dimensions_too_large"
    INVALID_IMAGE_CONTENT = "invalid_image_content"


class ImageUploadError(Exception):
    """Custom exception for image upload errors."""

    def __init__(self, error_type: ImageValidationError, message: str):
        self.error_type = error_type
        self.message = message
        super().__init__(message)


def get_format_from_extension(filename: str) -> Optional[str]:
    """Get the Pillow format string from a file extension."""
    ext = os.path.splitext(filename.lower())[1]
    return SUPPORTED_EXTENSIONS.get(ext)


def get_format_from_mime(mime_type: str) -> Optional[str]:
    """Get the Pillow format string from a MIME type."""
    return SUPPORTED_MIME_TYPES.get(mime_type.lower())


def get_format_from_magic_bytes(file_content: bytes) -> Optional[str]:
    """Detect image format from magic bytes (file signature).

    This is the most reliable way to detect format since MIME types
    can be wrong (especially on mobile) and extensions can be misleading.

    Args:
        file_content: Raw bytes of the file

    Returns:
        Format string (e.g., "JPEG", "PNG") or None if not recognized
    """
    # WEBP needs a longer check since RIFF is also used for AVI
    if file_content[:4] == b"RIFF" and len(file_content) > 11:
        if file_content[8:12] == b"WEBP":
            return "WEBP"

    # HEIC/HEIF/AVIF all use ftyp box — need deeper check
    if len(file_content) > 12 and file_content[4:8] == b"ftyp":
        ftyp_data = file_content[8:12]
        if ftyp_data in (b"heic", b"mif1", b"msf1", b"hevc"):
            return "HEIC"
        elif ftyp_data in (b"heif", b"mif1"):
            return "HEIF"
        elif ftyp_data in (b"avif", b"avis"):
            return "AVIF"

    # Check standard signatures (longer signatures first for accuracy)
    for signature, fmt in sorted(
        MAGIC_SIGNATURES.items(),
        key=lambda x: len(x[0]),
        reverse=True
    ):
        if file_content[:len(signature)] == signature:
            return fmt

    return None


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


def _normalize_color_profile(img: Image.Image) -> Image.Image:
    """Normalize the image color profile to sRGB.

    Handles:
    - Images with ICC profiles (convert to sRGB)
    - Images with no color profile (assume sRGB)
    - CMYK images (convert to RGB first, then apply profile)

    Args:
        img: PIL Image to normalize

    Returns:
        RGB image with sRGB color profile
    """
    try:
        # Check if image has an ICC profile
        icc_profile = img.info.get("icc_profile")
        if icc_profile:
            # Convert to sRGB using the embedded ICC profile
            input_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_profile))

            # Create sRGB output profile
            srgb_profile = ImageCms.createProfile("sRGB")

            # Determine source color space based on image mode
            if img.mode == "CMYK":
                # CMYK needs conversion to RGB first via ICC profile
                img = ImageCms.profileToProfile(
                    img,
                    input_profile,
                    srgb_profile,
                    outputMode="RGB",
                )
            elif img.mode in ("RGBA", "LA", "PA", "P"):
                # Convert alpha modes to RGBA first for profile conversion
                img = ImageCms.profileToProfile(
                    img,
                    input_profile,
                    srgb_profile,
                    outputMode="RGBA",
                )
            elif img.mode == "RGB":
                img = ImageCms.profileToProfile(
                    img,
                    input_profile,
                    srgb_profile,
                    outputMode="RGB",
                )
            else:
                # For other modes (L, etc.), just convert to RGB
                img = img.convert("RGB")

            logger.debug("Color profile normalized to sRGB")
            return img

    except Exception as e:
        logger.debug(f"ICC profile conversion failed, falling back to basic conversion: {e}")

    # No ICC profile or conversion failed — do basic mode conversion
    if img.mode == "CMYK":
        # CMYK without profile — try conversion with default separations
        # Black channel inversion for basic CMYK→RGB
        img = img.convert("RGB")
        logger.debug("CMYK image converted to RGB (no ICC profile)")
    elif img.mode not in ("RGB", "RGBA", "L"):
        img = img.convert("RGB")
        logger.debug(f"Image mode {img.mode} converted to RGB")

    return img


def _remove_alpha_channel(img: Image.Image) -> Image.Image:
    """Remove alpha channel by compositing onto a white background.

    Handles RGBA, LA, and PA modes by pasting onto white.
    For P (palette) mode with transparency, converts to RGBA first.

    Args:
        img: PIL Image that may have an alpha channel

    Returns:
        RGB Image with alpha removed, composited onto white background
    """
    if img.mode == "RGBA":
        # Composite onto white background
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])  # Alpha channel as mask
        logger.debug("RGBA alpha channel removed (white background composite)")
        return background
    elif img.mode == "LA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        img_rgb = img.convert("RGBA")
        background.paste(img_rgb, mask=img_rgb.split()[3])
        logger.debug("LA alpha channel removed (white background composite)")
        return background
    elif img.mode == "PA":
        # Palette with alpha — convert to RGBA first
        img_rgba = img.convert("RGBA")
        background = Image.new("RGB", img_rgba.size, (255, 255, 255))
        background.paste(img_rgba, mask=img_rgba.split()[3])
        logger.debug("PA alpha channel removed (white background composite)")
        return background
    elif img.mode == "P":
        # Palette mode — check if it has transparency
        if "transparency" in img.info:
            img_rgba = img.convert("RGBA")
            background = Image.new("RGB", img_rgba.size, (255, 255, 255))
            background.paste(img_rgba, mask=img_rgba.split()[3])
            logger.debug("P mode with transparency converted (white background composite)")
            return background
        else:
            img = img.convert("RGB")
            logger.debug("P mode without transparency converted to RGB")
            return img
    elif img.mode == "RGB":
        return img
    elif img.mode == "L":
        # Grayscale — convert to RGB
        img = img.convert("RGB")
        logger.debug("L mode (grayscale) converted to RGB")
        return img
    else:
        # Any other mode — convert to RGB
        img = img.convert("RGB")
        logger.debug(f"Image mode converted from {img.mode} to RGB")
        return img


def _apply_exif_orientation(img: Image.Image) -> Image.Image:
    """Apply EXIF orientation correction and strip orientation tag.

    This rotates/flips the image according to its EXIF orientation tag,
    then strips the orientation data so downstream processors don't double-apply.

    Args:
        img: PIL Image that may have EXIF orientation data

    Returns:
        Image with orientation applied and orientation tag removed
    """
    try:
        img = ImageOps.exif_transpose(img)
        logger.debug("EXIF orientation correction applied")
    except Exception as e:
        logger.debug(f"EXIF transpose not applicable or failed: {e}")
        # Continue without EXIF transpose if it fails

    return img


def _strip_metadata(img: Image.Image) -> Image.Image:
    """Strip problematic metadata while preserving ICC color profile.

    Removes EXIF data (GPS, camera info, software info, etc.)
    but keeps ICC color profile for accurate color reproduction.

    Args:
        img: PIL Image

    Returns:
        Image with metadata stripped (ICC profile preserved)
    """
    # Save the ICC profile before stripping
    icc_profile = img.info.get("icc_profile")

    # Create a new image without metadata
    # We can't directly strip EXIF from a PIL Image, but when we
    # save as JPEG later, we control what gets written via save parameters.
    # For now, just note the ICC profile for later use.

    # Re-attach ICC profile info for save time
    if icc_profile:
        img.info["icc_profile"] = icc_profile

    return img


def _auto_resize_if_needed(img: Image.Image) -> Image.Image:
    """Resize image if it exceeds MAX_DIMENSIONS, preserving aspect ratio.

    This prevents memory issues with extremely large images (e.g., from
    high-resolution DSLRs or stitched panoramas).

    Args:
        img: PIL Image

    Returns:
        Image, possibly resized to fit within MAX_DIMENSIONS
    """
    width, height = img.size
    max_w, max_h = MAX_DIMENSIONS

    if width > max_w or height > max_h:
        # Calculate new dimensions preserving aspect ratio
        ratio = min(max_w / width, max_h / height)
        new_width = int(width * ratio)
        new_height = int(height * ratio)

        logger.info(
            f"Auto-resizing image from {width}x{height}px to "
            f"{new_width}x{new_height}px (ratio={ratio:.3f})"
        )

        # Use LANCZOS for high-quality downscaling
        img = img.resize((new_width, new_height), Image.LANCZOS)
    else:
        logger.debug(f"Image dimensions {width}x{height}px within limits")

    return img


def validate_and_convert_upload(
    file_content: bytes,
    filename: str,
    mime_type: Optional[str] = None,
) -> Tuple[bytes, str, str]:
    """
    Validate and convert an uploaded image to a standardized internal format.

    This is the universal compatibility layer that normalizes ALL uploaded images.
    Regardless of source device (iPhone, Android, MacBook, Windows, DSLR,
    social media exports, screenshots), the output is always:

    - JPEG format
    - RGB color space
    - Quality 95
    - sRGB color profile (if ICC profile present)
    - EXIF orientation applied and stripped
    - Alpha channels removed (composited onto white background)
    - Metadata stripped (problematic EXIF data removed)
    - Aspect ratio preserved

    Pipeline:
    1. Validate empty file
    2. Validate file size
    3. Detect format (magic bytes → MIME → extension, in that order)
    4. Open image and validate integrity (force pixel load)
    5. Apply EXIF orientation correction
    6. Normalize color profile (ICC → sRGB)
    7. Convert CMYK → RGB
    8. Remove alpha channels (RGBA → RGB, composite on white)
    9. Auto-resize if dimensions exceed limits
    10. Validate minimum resolution
    11. Save as JPEG (quality 95, optimized)

    Args:
        file_content: Raw bytes of the uploaded file
        filename: Original filename (used for format detection fallback)
        mime_type: Optional MIME type from the upload

    Returns:
        Tuple of (converted_image_bytes, original_format, internal_format)
        - converted_image_bytes: The processed image as JPEG bytes
        - original_format: The format string of the original upload (e.g., "HEIC", "PNG")
        - internal_format: Always "JPEG"

    Raises:
        ImageUploadError: If validation fails, with specific error_type and message
    """
    # ============================================================
    # Step 1: Check empty file
    # ============================================================
    if not file_content or len(file_content) == 0:
        logger.warning("Upload rejected: empty file (filename=%s)", filename)
        raise ImageUploadError(
            ImageValidationError.EMPTY_FILE,
            "The uploaded file is empty. Please select a valid image file."
        )

    # ============================================================
    # Step 2: Check file size
    # ============================================================
    file_size_mb = len(file_content) / (1024 * 1024)
    if len(file_content) > MAX_FILE_SIZE:
        max_mb = MAX_FILE_SIZE // (1024 * 1024)
        logger.warning(
            "Upload rejected: file size %.1fMB exceeds %dMB limit (filename=%s)",
            file_size_mb, max_mb, filename
        )
        raise ImageUploadError(
            ImageValidationError.FILE_SIZE_EXCEEDED,
            f"Maximum file size exceeded. The file is {file_size_mb:.1f}MB, "
            f"but the maximum is {max_mb}MB."
        )

    # ============================================================
    # Step 3: Detect format (magic bytes → MIME → extension)
    # ============================================================
    original_format = None

    # 3a: Try magic bytes first (most reliable)
    original_format = get_format_from_magic_bytes(file_content)
    if original_format:
        logger.debug(
            "Format detected from magic bytes: %s (filename=%s)",
            original_format, filename
        )

    # 3b: Fall back to MIME type
    if not original_format and mime_type:
        original_format = get_format_from_mime(mime_type)
        if original_format:
            logger.debug(
                "Format detected from MIME type '%s': %s (filename=%s)",
                mime_type, original_format, filename
            )

    # 3c: Fall back to file extension
    if not original_format:
        original_format = get_format_from_extension(filename)
        if original_format:
            logger.debug(
                "Format detected from extension: %s (filename=%s)",
                original_format, filename
            )

    # 3d: Unsupported format
    if not original_format:
        logger.warning(
            "Upload rejected: unsupported format (filename=%s, mime=%s)",
            filename, mime_type
        )
        raise ImageUploadError(
            ImageValidationError.UNSUPPORTED_FORMAT,
            f"Unsupported file format for '{filename}'. "
            f"Supported formats: JPG, JPEG, PNG, WEBP, HEIC, HEIF, AVIF, TIFF, BMP."
        )

    # ============================================================
    # Step 4: Open image and validate integrity
    # ============================================================
    try:
        # Register HEIF/HEIC opener before attempting to open
        _register_heif_opener()

        img = Image.open(io.BytesIO(file_content))

        # Force load all pixel data to detect corruption
        img.load()

        # Verify the image has valid dimensions
        if img.size[0] <= 0 or img.size[1] <= 0:
            raise ValueError(f"Invalid image dimensions: {img.size}")

    except Exception as e:
        logger.warning(
            "Upload rejected: corrupted or unreadable image (filename=%s, "
            "detected_format=%s, error=%s)",
            filename, original_format, str(e)[:200]
        )
        raise ImageUploadError(
            ImageValidationError.CORRUPTED,
            f"The image file '{filename}' appears to be corrupted or cannot be read. "
            f"Please try a different image or re-save the original file."
        )

    # Record original properties for logging
    original_width, original_height = img.size
    original_mode = img.mode

    logger.info(
        "Processing upload: filename=%s, format=%s, size=%dx%d, mode=%s, "
        "file_size=%.1fMB",
        filename, original_format, original_width, original_height,
        original_mode, file_size_mb
    )

    # ============================================================
    # Step 5: Apply EXIF orientation correction
    # ============================================================
    img = _apply_exif_orientation(img)

    # ============================================================
    # Step 6: Normalize color profile (ICC → sRGB, CMYK → RGB)
    # ============================================================
    img = _normalize_color_profile(img)

    # ============================================================
    # Step 7: Remove alpha channels (composite on white background)
    # ============================================================
    # After color profile normalization, image should be RGB or RGBA.
    # Remove any remaining alpha channels.
    if img.mode != "RGB":
        img = _remove_alpha_channel(img)

    # Ensure we have RGB mode (safety net for any edge cases)
    if img.mode != "RGB":
        logger.warning(
            "Unexpected image mode after normalization: %s, converting to RGB",
            img.mode
        )
        img = img.convert("RGB")

    # ============================================================
    # Step 8: Auto-resize if dimensions exceed limits
    # ============================================================
    img = _auto_resize_if_needed(img)

    # ============================================================
    # Step 9: Validate minimum resolution
    # ============================================================
    width, height = img.size
    min_w, min_h = MIN_RESOLUTION
    if width < min_w or height < min_h:
        logger.warning(
            "Upload rejected: resolution %dx%d below minimum %dx%d (filename=%s)",
            width, height, min_w, min_h, filename
        )
        raise ImageUploadError(
            ImageValidationError.RESOLUTION_TOO_SMALL,
            f"Image resolution too small. The image is {width}x{height}px, "
            f"but the minimum is {min_w}x{min_h}px."
        )

    # ============================================================
    # Step 10: Save as standardized JPEG
    # ============================================================
    # Preserve ICC profile for sRGB color accuracy
    icc_profile = img.info.get("icc_profile")

    # Strip EXIF metadata — we've already applied orientation, so we
    # don't need any EXIF data. This prevents privacy leaks (GPS, etc.)
    # and avoids problematic metadata that can cause downstream issues.
    save_kwargs = {
        "format": "JPEG",
        "quality": INTERNAL_QUALITY,
        "optimize": True,
    }

    if icc_profile:
        save_kwargs["icc_profile"] = icc_profile

    output_buffer = io.BytesIO()
    try:
        img.save(output_buffer, **save_kwargs)
    except Exception as e:
        logger.error(
            "Failed to save converted JPEG (filename=%s, original_format=%s, "
            "size=%dx%d, mode=%s): %s",
            filename, original_format, width, height, img.mode, str(e)
        )
        raise ImageUploadError(
            ImageValidationError.INVALID_IMAGE_CONTENT,
            f"Failed to process image '{filename}'. The image may contain "
            f"unsupported data. Please try a different format."
        )

    converted_bytes = output_buffer.getvalue()
    final_width, final_height = img.size

    logger.info(
        "Upload converted successfully: filename=%s, original_format=%s, "
        "original_size=%dx%d, original_mode=%s → JPEG RGB %dx%d, "
        "file_size %.1fMB → %.1fMB",
        filename, original_format, original_width, original_height,
        original_mode, final_width, final_height,
        file_size_mb, len(converted_bytes) / (1024 * 1024)
    )

    return converted_bytes, original_format.upper(), INTERNAL_FORMAT


def get_accepted_mime_types() -> list[str]:
    """Get list of accepted MIME types for client-side validation."""
    return list(SUPPORTED_MIME_TYPES.keys())


def get_accepted_extensions() -> list[str]:
    """Get list of accepted file extensions for client-side validation."""
    return list(SUPPORTED_EXTENSIONS.keys())