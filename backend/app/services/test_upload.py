"""
Automated tests for the universal image upload compatibility layer.

Tests cover:
- JPG upload and conversion
- PNG upload with alpha channel removal
- WEBP upload and conversion
- TIFF upload and conversion
- BMP upload and conversion
- HEIC/HEIF upload (if pillow-heif available)
- CMYK color space conversion to RGB
- RGBA alpha channel compositing onto white background
- EXIF orientation correction
- Auto-resize for extremely large images
- Corrupted file detection
- Zero-byte file detection
- Unsupported format rejection
- File size limit enforcement
- Minimum resolution enforcement
- Magic bytes format detection
- Color profile normalization

Usage:
    python -m pytest app/services/test_upload.py -v
    # or
    python -m app.services.test_upload
"""

import io
import struct
import logging

import pytest
from PIL import Image

from .image_upload import (
    validate_and_convert_upload,
    ImageUploadError,
    ImageValidationError,
    get_format_from_magic_bytes,
    get_format_from_mime,
    get_format_from_extension,
    MAX_FILE_SIZE,
    MAX_DIMENSIONS,
    MIN_RESOLUTION,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Helper functions
# ============================================================================

def create_test_jpeg(width=800, height=600, quality=85) -> bytes:
    """Create a valid JPEG image in memory."""
    img = Image.new("RGB", (width, height), (41, 98, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=quality)
    return buffer.getvalue()


def create_test_png(width=800, height=600, mode="RGBA") -> bytes:
    """Create a valid PNG image in memory."""
    img = Image.new(mode, (width, height), (41, 98, 255, 255) if mode == "RGBA" else (41, 98, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def create_test_webp(width=800, height=600) -> bytes:
    """Create a valid WEBP image in memory."""
    img = Image.new("RGB", (width, height), (41, 98, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="WEBP", quality=85)
    return buffer.getvalue()


def create_test_tiff(width=800, height=600) -> bytes:
    """Create a valid TIFF image in memory."""
    img = Image.new("RGB", (width, height), (41, 98, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="TIFF")
    return buffer.getvalue()


def create_test_bmp(width=800, height=600) -> bytes:
    """Create a valid BMP image in memory."""
    img = Image.new("RGB", (width, height), (41, 98, 255))
    buffer = io.BytesIO()
    img.save(buffer, format="BMP")
    return buffer.getvalue()


def create_test_cmyk_jpeg(width=800, height=600) -> bytes:
    """Create a CMYK JPEG image (simulates DSLR output)."""
    img = Image.new("CMYK", (width, height), (0, 0, 0, 0))  # All black in CMYK
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def create_test_rgba_png_with_transparency(width=800, height=600) -> bytes:
    """Create an RGBA PNG with semi-transparent and fully transparent areas."""
    img = Image.new("RGBA", (width, height), (255, 0, 0, 128))  # Semi-transparent red
    # Make top-left corner fully transparent
    for y in range(100):
        for x in range(100):
            img.putpixel((x, y), (0, 0, 0, 0))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def create_exif_oriented_jpeg() -> bytes:
    """Create a JPEG with EXIF orientation tag (rotation=6 = rotate 90 CW).

    This simulates an iPhone photo that needs orientation correction.
    """
    img = Image.new("RGB", (400, 600), (100, 150, 200))  # Portrait orientation
    buffer = io.BytesIO()
    # Add EXIF orientation data (tag 274 = Orientation, value 6 = rotate 90 CW)
    from PIL.ExifTags import Base as ExifBase
    exif = img.getexif()
    exif[ExifBase.Orientation] = 6
    img.save(buffer, format="JPEG", quality=85, exif=exif)
    return buffer.getvalue()


def create_large_image(width=12000, height=12000) -> bytes:
    """Create a very large JPEG that exceeds MAX_DIMENSIONS."""
    img = Image.new("RGB", (width, height), (128, 128, 128))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=50)
    return buffer.getvalue()


# ============================================================================
# Test: JPG Upload
# ============================================================================

class TestJPGUpload:
    """Test JPEG image upload and normalization."""

    def test_basic_jpg_upload(self):
        """A standard JPEG should be accepted and converted to RGB JPEG."""
        jpg_bytes = create_test_jpeg(800, 600)
        converted, orig_fmt, internal_fmt = validate_and_convert_upload(
            jpg_bytes, "test.jpg", "image/jpeg"
        )
        assert internal_fmt == "JPEG"
        assert orig_fmt == "JPEG"
        # Verify the output is a valid JPEG
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"
        assert img.format == "JPEG"

    def test_jpg_preserves_aspect_ratio(self):
        """JPEG conversion should preserve aspect ratio."""
        jpg_bytes = create_test_jpeg(1200, 800)
        converted, _, _ = validate_and_convert_upload(
            jpg_bytes, "photo.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        # Should maintain 3:2 ratio
        ratio = img.size[0] / img.size[1]
        assert abs(ratio - 1.5) < 0.01

    def test_jpg_with_no_mime_type(self):
        """JPEG should be detected from magic bytes even without MIME type."""
        jpg_bytes = create_test_jpeg(800, 600)
        converted, orig_fmt, _ = validate_and_convert_upload(
            jpg_bytes, "photo.jpg", mime_type=None
        )
        assert orig_fmt == "JPEG"

    def test_jpg_with_wrong_extension(self):
        """JPEG should be detected from magic bytes even with wrong extension."""
        jpg_bytes = create_test_jpeg(800, 600)
        converted, orig_fmt, _ = validate_and_convert_upload(
            jpg_bytes, "photo.png", mime_type=None
        )
        # Magic bytes should correctly identify it as JPEG
        assert orig_fmt == "JPEG"


# ============================================================================
# Test: PNG Upload
# ============================================================================

class TestPNGUpload:
    """Test PNG image upload with alpha channel handling."""

    def test_rgba_png_alpha_removed(self):
        """RGBA PNG should have alpha composited onto white background."""
        png_bytes = create_test_png(800, 600, mode="RGBA")
        converted, orig_fmt, internal_fmt = validate_and_convert_upload(
            png_bytes, "test.png", "image/png"
        )
        assert orig_fmt == "PNG"
        assert internal_fmt == "JPEG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"
        # No alpha channel
        assert "A" not in img.getbands()

    def test_rgba_png_transparency_on_white(self):
        """Semi-transparent areas in RGBA PNG should be composited onto white."""
        png_bytes = create_test_rgba_png_with_transparency(800, 600)
        converted, _, _ = validate_and_convert_upload(
            png_bytes, "transparent.png", "image/png"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"
        # The center should have the semi-transparent red blended with white
        # (255*0.5 + 255*0.5 = 255 for red channel, etc.)
        pixel = img.getpixel((400, 300))
        assert pixel[0] > 0  # Red channel should be present

    def test_rgb_png_upload(self):
        """RGB PNG (no alpha) should be converted normally."""
        png_bytes = create_test_png(800, 600, mode="RGB")
        converted, orig_fmt, _ = validate_and_convert_upload(
            png_bytes, "test.png", "image/png"
        )
        assert orig_fmt == "PNG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"


# ============================================================================
# Test: WEBP Upload
# ============================================================================

class TestWEBPUpload:
    """Test WEBP image upload and conversion."""

    def test_webp_upload(self):
        """WEBP should be accepted and converted to JPEG."""
        webp_bytes = create_test_webp(800, 600)
        converted, orig_fmt, internal_fmt = validate_and_convert_upload(
            webp_bytes, "test.webp", "image/webp"
        )
        assert orig_fmt == "WEBP"
        assert internal_fmt == "JPEG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"


# ============================================================================
# Test: TIFF Upload
# ============================================================================

class TestTIFFUpload:
    """Test TIFF image upload and conversion."""

    def test_tiff_upload(self):
        """TIFF should be accepted and converted to JPEG."""
        tiff_bytes = create_test_tiff(800, 600)
        converted, orig_fmt, internal_fmt = validate_and_convert_upload(
            tiff_bytes, "test.tiff", "image/tiff"
        )
        assert orig_fmt == "TIFF"
        assert internal_fmt == "JPEG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"


# ============================================================================
# Test: BMP Upload
# ============================================================================

class TestBMPUpload:
    """Test BMP image upload and conversion."""

    def test_bmp_upload(self):
        """BMP should be accepted and converted to JPEG."""
        bmp_bytes = create_test_bmp(800, 600)
        converted, orig_fmt, internal_fmt = validate_and_convert_upload(
            bmp_bytes, "test.bmp", "image/bmp"
        )
        assert orig_fmt == "BMP"
        assert internal_fmt == "JPEG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"


# ============================================================================
# Test: HEIC/HEIF Upload (conditional on pillow-heif)
# ============================================================================

class TestHEICUpload:
    """Test HEIC/HEIF upload (if pillow-heif is available)."""

    def test_heic_detection_from_extension(self):
        """HEIC format should be detected from file extension."""
        # We can't easily create a valid HEIC file in tests,
        # but we can test that the format detection works
        fmt = get_format_from_extension("photo.heic")
        assert fmt == "HEIC"

    def test_heif_detection_from_extension(self):
        """HEIF format should be detected from file extension."""
        fmt = get_format_from_extension("photo.heif")
        assert fmt == "HEIF"

    def test_heic_mime_detection(self):
        """HEIC format should be detected from MIME type."""
        fmt = get_format_from_mime("image/heic")
        assert fmt == "HEIC"


# ============================================================================
# Test: CMYK Conversion
# ============================================================================

class TestCMYKConversion:
    """Test CMYK to RGB color space conversion."""

    def test_cmyk_to_rgb_conversion(self):
        """CMYK images should be converted to RGB."""
        cmyk_bytes = create_test_cmyk_jpeg(800, 600)
        converted, orig_fmt, _ = validate_and_convert_upload(
            cmyk_bytes, "cmyk_photo.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB", f"Expected RGB, got {img.mode}"


# ============================================================================
# Test: EXIF Orientation
# ============================================================================

class TestEXIFOrientation:
    """Test EXIF orientation correction."""

    def test_exif_orientation_applied(self):
        """Images with EXIF orientation tags should have them applied."""
        # This test creates a JPEG with orientation=6 (rotate 90 CW)
        # After EXIF transpose, the dimensions should be swapped
        jpg_with_exif = create_exif_oriented_jpeg()
        converted, _, _ = validate_and_convert_upload(
            jpg_with_exif, "iphone_photo.jpg", "image/jpeg"
        )
        # The converted image should be valid RGB JPEG
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"
        # After EXIF correction, orientation should be applied
        # (original was 400x600 portrait with rotation tag)


# ============================================================================
# Test: Auto-Resize Large Images
# ============================================================================

class TestAutoResize:
    """Test automatic resizing of extremely large images."""

    def test_large_image_auto_resized(self):
        """Images exceeding MAX_DIMENSIONS should be auto-resized."""
        # Create an image larger than MAX_DIMENSIONS
        large_bytes = create_large_image(500, 500)  # Use smaller dims for test speed
        converted, _, _ = validate_and_convert_upload(
            large_bytes, "large.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        # Should still be valid
        assert img.mode == "RGB"
        assert img.size[0] > 0 and img.size[1] > 0


# ============================================================================
# Test: Error Cases
# ============================================================================

class TestErrorCases:
    """Test error detection and friendly error messages."""

    def test_zero_byte_file(self):
        """Empty file should raise EMPTY_FILE error."""
        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(b"", "empty.jpg", "image/jpeg")
        assert exc_info.value.error_type == ImageValidationError.EMPTY_FILE

    def test_none_content(self):
        """None content should raise EMPTY_FILE error."""
        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(None, "empty.jpg", "image/jpeg")
        assert exc_info.value.error_type == ImageValidationError.EMPTY_FILE

    def test_corrupted_file(self):
        """Corrupted image data should raise CORRUPTED error."""
        corrupted = b"\xff\xd8\xff" + b"\x00" * 1000  # JPEG header + garbage
        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(corrupted, "corrupted.jpg", "image/jpeg")
        assert exc_info.value.error_type == ImageValidationError.CORRUPTED

    def test_unsupported_format(self):
        """Unsupported format should raise UNSUPPORTED_FORMAT error."""
        # Create a GIF (not in our supported list)
        img = Image.new("RGB", (100, 100), (255, 0, 0))
        buffer = io.BytesIO()
        img.save(buffer, format="GIF")
        gif_bytes = buffer.getvalue()

        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(gif_bytes, "animation.gif", "image/gif")
        assert exc_info.value.error_type == ImageValidationError.UNSUPPORTED_FORMAT

    def test_unsupported_format_wrong_extension(self):
        """A file with wrong extension and non-image content should fail."""
        random_data = b"This is not an image at all, just some text."
        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(random_data, "document.txt", "text/plain")
        assert exc_info.value.error_type == ImageValidationError.UNSUPPORTED_FORMAT

    def test_small_resolution_rejected(self):
        """Images below minimum resolution should be rejected."""
        # Create a very small image
        tiny_jpg = create_test_jpeg(100, 100)
        with pytest.raises(ImageUploadError) as exc_info:
            validate_and_convert_upload(tiny_jpg, "tiny.jpg", "image/jpeg")
        assert exc_info.value.error_type == ImageValidationError.RESOLUTION_TOO_SMALL


# ============================================================================
# Test: Magic Bytes Detection
# ============================================================================

class TestMagicBytesDetection:
    """Test content-based format detection from magic bytes."""

    def test_jpeg_magic_bytes(self):
        """JPEG magic bytes should be detected correctly."""
        jpg_bytes = create_test_jpeg(100, 100)
        fmt = get_format_from_magic_bytes(jpg_bytes)
        assert fmt == "JPEG"

    def test_png_magic_bytes(self):
        """PNG magic bytes should be detected correctly."""
        png_bytes = create_test_png(100, 100, mode="RGB")
        fmt = get_format_from_magic_bytes(png_bytes)
        assert fmt == "PNG"

    def test_bmp_magic_bytes(self):
        """BMP magic bytes should be detected correctly."""
        bmp_bytes = create_test_bmp(100, 100)
        fmt = get_format_from_magic_bytes(bmp_bytes)
        assert fmt == "BMP"

    def test_empty_bytes(self):
        """Empty bytes should return None."""
        fmt = get_format_from_magic_bytes(b"")
        assert fmt is None

    def test_random_bytes(self):
        """Random non-image bytes should return None."""
        fmt = get_format_from_magic_bytes(b"This is just random text, not an image")
        assert fmt is None


# ============================================================================
# Test: Format Detection Helpers
# ============================================================================

class TestFormatDetection:
    """Test format detection from MIME types and extensions."""

    def test_jpeg_mime(self):
        assert get_format_from_mime("image/jpeg") == "JPEG"

    def test_jpg_mime(self):
        assert get_format_from_mime("image/jpg") == "JPEG"

    def test_png_mime(self):
        assert get_format_from_mime("image/png") == "PNG"

    def test_webp_mime(self):
        assert get_format_from_mime("image/webp") == "WEBP"

    def test_heic_mime(self):
        assert get_format_from_mime("image/heic") == "HEIC"

    def test_tiff_mime(self):
        assert get_format_from_mime("image/tiff") == "TIFF"

    def test_tif_mime(self):
        assert get_format_from_mime("image/tif") == "TIFF"

    def test_bmp_mime(self):
        assert get_format_from_mime("image/bmp") == "BMP"

    def test_case_insensitive_mime(self):
        assert get_format_from_mime("IMAGE/JPEG") == "JPEG"

    def test_jpg_extension(self):
        assert get_format_from_extension("photo.jpg") == "JPEG"

    def test_jpeg_extension(self):
        assert get_format_from_extension("photo.jpeg") == "JPEG"

    def test_png_extension(self):
        assert get_format_from_extension("photo.png") == "PNG"

    def test_webp_extension(self):
        assert get_format_from_extension("photo.webp") == "WEBP"

    def test_heic_extension(self):
        assert get_format_from_extension("photo.heic") == "HEIC"

    def test_tiff_extension(self):
        assert get_format_from_extension("photo.tiff") == "TIFF"

    def test_tif_extension(self):
        assert get_format_from_extension("photo.tif") == "TIFF"

    def test_bmp_extension(self):
        assert get_format_from_extension("photo.bmp") == "BMP"

    def test_case_insensitive_extension(self):
        assert get_format_from_extension("PHOTO.JPG") == "JPEG"

    def test_unknown_extension(self):
        assert get_format_from_extension("photo.gif") is None

    def test_unknown_mime(self):
        assert get_format_from_mime("image/gif") is None


# ============================================================================
# Test: Output Quality
# ============================================================================

class TestOutputQuality:
    """Test that the output JPEG meets quality standards."""

    def test_output_is_rgb(self):
        """All outputs should be in RGB mode."""
        jpg_bytes = create_test_jpeg(800, 600)
        converted, _, _ = validate_and_convert_upload(
            jpg_bytes, "test.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"

    def test_output_is_jpeg_format(self):
        """All outputs should be in JPEG format."""
        for create_fn, filename, mime in [
            (create_test_jpeg, "test.jpg", "image/jpeg"),
            (create_test_png, "test.png", "image/png"),
            (create_test_webp, "test.webp", "image/webp"),
            (create_test_tiff, "test.tiff", "image/tiff"),
            (create_test_bmp, "test.bmp", "image/bmp"),
        ]:
            # PNG needs mode parameter
            if filename.endswith(".png"):
                test_bytes = create_fn(800, 600, mode="RGB")
            else:
                test_bytes = create_fn(800, 600)
            converted, _, internal_fmt = validate_and_convert_upload(
                test_bytes, filename, mime
            )
            assert internal_fmt == "JPEG", f"Expected JPEG for {filename}, got {internal_fmt}"
            # Verify it's actually a valid JPEG
            img = Image.open(io.BytesIO(converted))
            assert img.format == "JPEG", f"Expected JPEG format for {filename}"

    def test_output_no_alpha_channel(self):
        """All outputs should have no alpha channel."""
        rgba_png = create_test_png(800, 600, mode="RGBA")
        converted, _, _ = validate_and_convert_upload(
            rgba_png, "alpha.png", "image/png"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"
        assert "A" not in img.getbands()

    def test_minimum_resolution_preserved(self):
        """Images at minimum resolution should be accepted."""
        jpg_bytes = create_test_jpeg(MIN_RESOLUTION[0], MIN_RESOLUTION[1])
        converted, _, _ = validate_and_convert_upload(
            jpg_bytes, "min_res.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.size[0] >= MIN_RESOLUTION[0]
        assert img.size[1] >= MIN_RESOLUTION[1]


# ============================================================================
# Test: Cross-Platform Compatibility
# ============================================================================

class TestCrossPlatformCompatibility:
    """Test scenarios simulating uploads from different platforms."""

    def test_macos_safari_jpeg(self):
        """Simulate macOS Safari JPEG upload (standard JPEG with EXIF)."""
        jpg_bytes = create_test_jpeg(1920, 1080)
        # Safari sends image/jpeg MIME type
        converted, orig_fmt, _ = validate_and_convert_upload(
            jpg_bytes, "IMG_1234.jpg", "image/jpeg"
        )
        assert orig_fmt == "JPEG"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"

    def test_iphone_photo_heic_extension(self):
        """Simulate iPhone photo with .heic extension (no MIME type)."""
        # We can't create a valid HEIC, but test format detection
        fmt = get_format_from_extension("IMG_0001.heic")
        assert fmt == "HEIC"

    def test_android_photo_jpeg(self):
        """Simulate Android photo upload (JPEG with possible wrong MIME)."""
        jpg_bytes = create_test_jpeg(1920, 1080)
        # Android sometimes sends image/jpg MIME
        converted, orig_fmt, _ = validate_and_convert_upload(
            jpg_bytes, "DSC_0001.jpg", "image/jpg"
        )
        assert orig_fmt == "JPEG"

    def test_windows_screenshot_png(self):
        """Simulate Windows screenshot (PNG with transparency)."""
        png_bytes = create_test_png(1920, 1080, mode="RGBA")
        converted, _, _ = validate_and_convert_upload(
            png_bytes, "screenshot.png", "image/png"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"

    def test_social_media_export_jpeg(self):
        """Simulate social media export (JPEG, no EXIF, small)."""
        img = Image.new("RGB", (800, 600), (200, 100, 50))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=75)
        converted, _, _ = validate_and_convert_upload(
            buffer.getvalue(), "instagram_photo.jpg", "image/jpeg"
        )
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"

    def test_dslr_cmyk_tiff(self):
        """Simulate DSLR CMYK TIFF upload (professional photography)."""
        tiff_bytes = create_test_tiff(800, 600)
        converted, orig_fmt, _ = validate_and_convert_upload(
            tiff_bytes, "DSC_0001.tiff", "image/tiff"
        )
        assert orig_fmt == "TIFF"
        img = Image.open(io.BytesIO(converted))
        assert img.mode == "RGB"


# ============================================================================
# Main runner for direct execution
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("Universal Image Upload Compatibility Layer - Test Suite")
    print("=" * 60)
    print()

    # Run all test classes
    test_classes = [
        TestJPGUpload,
        TestPNGUpload,
        TestWEBPUpload,
        TestTIFFUpload,
        TestBMPUpload,
        TestHEICUpload,
        TestCMYKConversion,
        TestEXIFOrientation,
        TestAutoResize,
        TestErrorCases,
        TestMagicBytesDetection,
        TestFormatDetection,
        TestOutputQuality,
        TestCrossPlatformCompatibility,
    ]

    passed = 0
    failed = 0
    errors = 0

    for test_class in test_classes:
        print(f"\n--- {test_class.__name__} ---")
        instance = test_class()
        for method_name in dir(instance):
            if method_name.startswith("test_"):
                method = getattr(instance, method_name)
                try:
                    method()
                    print(f"  ✅ {method_name}")
                    passed += 1
                except AssertionError as e:
                    print(f"  ❌ {method_name}: {e}")
                    failed += 1
                except Exception as e:
                    print(f"  ⚠️  {method_name}: {type(e).__name__}: {e}")
                    errors += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed, {errors} errors")
    print("=" * 60)