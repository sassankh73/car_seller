"""
Core image processing services for AutoStudio AI.
Implements production compositing pipeline:
- Background removal (using external API)
- Studio background placement
- Vehicle scaling and positioning
- Contact shadow generation
- Optional enhancement pipeline (feature-flagged)

Feature flags (env vars):
- ENABLE_ENHANCEMENT: Enable paint/wheel enhancement (default: false)
- ENABLE_LIGHTING_CORRECTION: Enable lighting correction (default: false)
"""

import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

# ============================================================================
# Feature Flags
# ============================================================================

ENABLE_ENHANCEMENT = os.getenv("ENABLE_ENHANCEMENT", "false").lower() == "true"
ENABLE_LIGHTING_CORRECTION = os.getenv("ENABLE_LIGHTING_CORRECTION", "false").lower() == "true"

logger.info(
    "Image processing feature flags: ENABLE_ENHANCEMENT=%s, ENABLE_LIGHTING_CORRECTION=%s",
    ENABLE_ENHANCEMENT,
    ENABLE_LIGHTING_CORRECTION,
)

# ============================================================================
# Interface for AI Background Removers (External API wrapper)
# ============================================================================


class BackgroundRemover(ABC):
    """Abstract base for background removal services."""

    @abstractmethod
    def remove_background(self, image: Image.Image) -> Image.Image:
        """Return image with transparent background (RGBA)."""
        pass


class RemoveBGRemover(BackgroundRemover):
    """Wrapper for remove.bg API (example). Replace with your provider."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def remove_background(self, image: Image.Image) -> Image.Image:
        # Placeholder: Call actual API endpoint
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        return image


class MockRemover(BackgroundRemover):
    """Mock remover for local development/testing."""

    def remove_background(self, image: Image.Image) -> Image.Image:
        # Simple mock: darken edges to simulate transparency
        img = image.convert("RGBA")
        datas = np.array(img)
        # Create gradient alpha mask
        alpha = np.zeros((datas.shape[0], datas.shape[1]), dtype=np.uint8)
        h, w = alpha.shape
        for i in range(h):
            for j in range(w):
                dist = min(i, h - i, j, w - j) / min(h, w)
                alpha[i, j] = int(255 * (0.1 + 0.9 * dist**2))

        datas[:, :, 3] = alpha
        return Image.fromarray(datas)


# ============================================================================
# Contact Shadow Generator (replaces ReflectionGenerator)
# ============================================================================


class ContactShadowGenerator:
    """Generates a soft contact shadow beneath the vehicle.

    Unlike a mirrored reflection, this creates a simple elliptical
    gradient shadow that sits on the studio floor — matching the
    look of BMW configurator / dealer studio photography.
    """

    def __init__(
        self,
        blur_radius: int = 40,
        opacity: float = 0.35,
        width_ratio: float = 1.1,
        height_ratio: float = 0.08,
    ):
        self.blur_radius = blur_radius
        self.opacity = opacity
        self.width_ratio = width_ratio
        self.height_ratio = height_ratio

    def generate(
        self, vehicle_width: int, vehicle_height: int, canvas_size: Tuple[int, int]
    ) -> Image.Image:
        """
        Generate a soft contact shadow layer.

        Args:
            vehicle_width: Width of the scaled vehicle image
            vehicle_height: Height of the scaled vehicle image
            canvas_size: Size of the final canvas (width, height)

        Returns:
            Shadow image (RGBA) ready for compositing
        """
        canvas_w, canvas_h = canvas_size

        # Shadow is a soft elliptical gradient beneath the car
        shadow_w = int(vehicle_width * self.width_ratio)
        shadow_h = max(int(vehicle_height * self.height_ratio), 20)

        # Create radial gradient for shadow
        shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        shadow_arr = np.zeros((canvas_h, canvas_w), dtype=np.float32)

        # Position shadow at the vehicle's base (centered horizontally)
        cx = canvas_w // 2
        cy = canvas_h  # Will be positioned at floor level by caller

        # Draw elliptical gradient
        y_coords, x_coords = np.ogrid[:canvas_h, :canvas_w]
        # Ellipse: wider than tall
        x_dist = ((x_coords - cx).astype(np.float32) / (shadow_w / 2)) ** 2
        y_dist = ((y_coords - cy).astype(np.float32) / (shadow_h / 2)) ** 2
        ellipse_dist = np.sqrt(x_dist + y_dist)

        # Smooth falloff
        shadow_strength = np.clip(1.0 - ellipse_dist, 0, 1)
        shadow_strength = shadow_strength**2  # Quadratic falloff for softness
        shadow_strength *= self.opacity

        shadow_arr = (shadow_strength * 255).astype(np.uint8)

        shadow_rgba = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        # Apply the shadow as the alpha channel of a black image
        r = np.zeros_like(shadow_arr)
        g = np.zeros_like(shadow_arr)
        b = np.zeros_like(shadow_arr)
        a = shadow_arr

        shadow_composite = np.stack([r, g, b, a], axis=-1)
        shadow_rgba = Image.fromarray(shadow_composite, mode="RGBA")

        # Apply Gaussian blur for extra softness
        if self.blur_radius > 0:
            # Blur only the alpha channel for performance
            alpha = shadow_rgba.split()[3]
            alpha = alpha.filter(ImageFilter.GaussianBlur(self.blur_radius))
            r, g, b, _ = shadow_rgba.split()
            shadow_rgba = Image.merge("RGBA", (r, g, b, alpha))

        return shadow_rgba


# ============================================================================
# Lighting Correction (feature-flagged, disabled by default)
# ============================================================================


class LightingCorrector:
    """Applies professional lighting corrections to the car.

    DISABLED by default (ENABLE_LIGHTING_CORRECTION=false).
    Can cause quality degradation; only enable if specifically needed.
    """

    def __init__(
        self,
        brightness: float = 1.1,
        contrast: float = 1.2,
        color_balance: Tuple[float, float, float] = (1.0, 1.0, 1.0),
        sharpen: float = 0.5,
    ):
        self.brightness = brightness
        self.contrast = contrast
        self.color_balance = color_balance
        self.sharpen = sharpen

    def correct(self, image: Image.Image) -> Image.Image:
        """Apply professional lighting corrections while preserving alpha channel."""
        # Extract alpha channel before RGB processing
        if "A" in image.getbands():
            alpha = image.split()[3]
        else:
            alpha = Image.new("L", image.size, 255)

        # Process RGB channels only
        img = image.convert("RGB")

        # Color balance adjustment (warm/cool tone)
        r, g, b = img.split()
        r = ImageEnhance.Brightness(r).enhance(self.color_balance[0])
        g = ImageEnhance.Brightness(g).enhance(self.color_balance[1])
        b = ImageEnhance.Brightness(b).enhance(self.color_balance[2])
        img = Image.merge("RGB", (r, g, b))

        # Brightness and contrast
        img = ImageEnhance.Brightness(img).enhance(self.brightness)
        img = ImageEnhance.Contrast(img).enhance(self.contrast)

        # Subtle sharpening for detail
        if self.sharpen > 0:
            img = ImageEnhance.Sharpness(img).enhance(1 + self.sharpen)

        # Reattach original alpha channel
        result = Image.merge("RGBA", img.split() + (alpha,))
        return result


# ============================================================================
# Perspective Corrector
# ============================================================================


class PerspectiveCorrector:
    """Corrects perspective and maintains proper car proportions."""

    def __init__(
        self,
        scale_factor: float = 1.0,
        keystone_correct: bool = True,
        horizon_adjust: float = 0.0,
    ):
        self.scale_factor = scale_factor
        self.keystone_correct = keystone_correct
        self.horizon_adjust = horizon_adjust

    def correct(self, image: Image.Image, canvas_size: Tuple[int, int]) -> Image.Image:
        """Apply perspective corrections."""
        w, h = image.size

        # Scale the car appropriately
        if self.scale_factor != 1.0:
            new_w = int(w * self.scale_factor)
            new_h = int(h * self.scale_factor)
            image = image.resize((new_w, new_h), Image.LANCZOS)

        if self.keystone_correct:
            # Keystone correction placeholder — kept for future OpenCV integration
            pass

        return image


# ============================================================================
# Wheel Preservation (feature-flagged, disabled by default)
# ============================================================================


class WheelPreserver:
    """Ensures wheels maintain detail and don't get over-processed.

    Only used when ENABLE_ENHANCEMENT=true.
    """

    def __init__(self, wheel_mask_threshold: int = 50, sharpen_strength: float = 1.3):
        self.wheel_mask_threshold = wheel_mask_threshold
        self.sharpen_strength = sharpen_strength

    def preserve(
        self, car_image: Image.Image, original_image: Optional[Image.Image] = None
    ) -> Image.Image:
        """Preserve wheel detail in processed car image."""
        if original_image is None:
            return ImageEnhance.Sharpness(car_image).enhance(self.sharpen_strength)

        return ImageEnhance.Sharpness(car_image).enhance(self.sharpen_strength)


# ============================================================================
# Paint Reflection Enhancer (feature-flagged, disabled by default)
# ============================================================================


class PaintReflectionEnhancer:
    """Enhances paint reflections and glossy finish.

    DISABLED by default (ENABLE_ENHANCEMENT=false).
    Known to reduce image quality — blur softens details, body lines, and wheels.
    """

    def __init__(
        self,
        highlight_boost: float = 1.5,
        specular_boost: float = 1.3,
        smoothness: float = 0.8,
    ):
        self.highlight_boost = highlight_boost
        self.specular_boost = specular_boost
        self.smoothness = smoothness

    def enhance(self, image: Image.Image) -> Image.Image:
        """Enhance paint reflections for premium look while preserving alpha channel."""
        if "A" in image.getbands():
            alpha = image.split()[3]
        else:
            alpha = Image.new("L", image.size, 255)

        img = image.convert("RGB")
        img_array = np.array(img, dtype=np.float32) / 255.0

        r, g, b = img_array[:, :, 0], img_array[:, :, 1], img_array[:, :, 2]
        luminance = 0.299 * r + 0.587 * g + 0.114 * b

        highlight_mask = np.clip(luminance * self.highlight_boost, 0, 1)

        enhanced = np.zeros_like(img_array)
        for c in range(3):
            enhanced[:, :, c] = img_array[:, :, c] + (
                highlight_mask * self.specular_boost * 0.2
            )

        enhanced = np.clip(enhanced, 0, 1)
        enhanced = (enhanced * 255).astype(np.uint8)
        enhanced_img = Image.fromarray(enhanced, "RGB")

        if self.smoothness > 0:
            enhanced_img = enhanced_img.filter(
                ImageFilter.GaussianBlur(radius=self.smoothness)
            )
            enhanced_img = ImageEnhance.Sharpness(enhanced_img).enhance(1.2)

        result = Image.merge("RGBA", enhanced_img.split() + (alpha,))
        return result


# ============================================================================
# Reflection Generator (DISABLED — kept for reference only)
# ============================================================================


class ReflectionGenerator:
    """
    DEPRECATED: Generates mirrored floor reflections.

    This creates a second vehicle image below the car, which looks
    like a duplicate vehicle rather than a natural reflection.
    Disabled in production — replaced by ContactShadowGenerator.
    """

    def __init__(
        self,
        reflection_height_ratio: float = 0.25,
        fade_strength: float = 0.7,
        noise_intensity: float = 0.05,
        blur_radius: int = 5,
    ):
        self.reflection_height_ratio = reflection_height_ratio
        self.fade_strength = fade_strength
        self.noise_intensity = noise_intensity
        self.blur_radius = blur_radius

    def generate(
        self, car_image: Image.Image, floor_color: str = "#1a1a1a"
    ) -> Image.Image:
        """Generate reflection — DO NOT USE in production pipeline."""
        if "A" not in car_image.getbands():
            car_image = car_image.convert("RGBA")

        w, h = car_image.size
        alpha = car_image.split()[3]
        reflection = car_image.copy()
        reflection = ImageOps.flip(reflection)

        reflection_array = np.array(reflection, dtype=np.float32)
        alpha_array = np.array(alpha, dtype=np.float32)

        reflection_height = int(h * self.reflection_height_ratio)
        for y in range(reflection_height):
            fade_factor = 1 - (y / reflection_height) ** 1.5
            fade_factor *= self.fade_strength
            for x in range(w):
                if alpha_array[y, x] > 0:
                    reflection_array[y, x, 3] *= fade_factor

        reflection = Image.fromarray(np.clip(reflection_array, 0, 255).astype(np.uint8))
        reflection = reflection.filter(ImageFilter.GaussianBlur(self.blur_radius))

        return reflection


# ============================================================================
# Shadow Generator (legacy — kept for reference)
# ============================================================================


class ShadowGenerator:
    """Generates shadow from car mask. Used in legacy pipeline only."""

    def __init__(
        self,
        blur_radius: int = 20,
        opacity: float = 0.6,
        offset_x: int = 0,
        offset_y: int = 10,
        angle_deg: float = 45,
    ):
        self.blur_radius = blur_radius
        self.opacity = opacity
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.angle_deg = angle_deg

    def generate(
        self, car_mask: Image.Image, canvas_size: Tuple[int, int]
    ) -> Image.Image:
        """Generate a shadow layer from the car mask (legacy)."""
        mask = car_mask.convert("L")
        mask = mask.point(lambda p: 255 if p > 128 else 0)

        shadow = Image.new("L", canvas_size, 0)
        shadow.paste(255, (0, 0), mask)

        shadow = shadow.transform(
            canvas_size, Image.AFFINE, (1, 0, self.offset_x, 0, 1, self.offset_y)
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(self.blur_radius))

        shadow_array = np.array(shadow, dtype=np.float32)
        h, w = shadow_array.shape
        y_coords, x_coords = np.ogrid[:h, :w]
        center_y, center_x = h // 2 + self.offset_y, w // 2 + self.offset_x
        dist = np.sqrt((y_coords - center_y) ** 2 + (x_coords - center_x) ** 2)
        max_dist = np.sqrt(h**2 + w**2)
        fade = 1 - (dist / max_dist) * 0.5
        fade = np.clip(fade, 0.2, 1.0)

        shadow_array *= fade * self.opacity * 255 / 255
        shadow_array = np.clip(shadow_array, 0, 255).astype(np.uint8)

        shadow = Image.fromarray(shadow_array)
        return shadow


# ============================================================================
# Main AI Compositing Service (Production Pipeline)
# ============================================================================


class AICompositingService:
    """Orchestrates the production AI compositing pipeline for professional car photography.

    Pipeline (production default):
    1. Remove background
    2. Scale vehicle to 65% of canvas width (maintain aspect ratio)
    3. [Optional] Lighting correction (ENABLE_LIGHTING_CORRECTION)
    4. [Optional] Enhancement (ENABLE_ENHANCEMENT)
    5. Generate contact shadow (soft ellipse, no mirror)
    6. Composite: studio bg → shadow → vehicle

    Target output resembles:
    - BMW configurator imagery
    - Dealer studio photography
    - Automotive marketplace listing images
    """

    # Vehicle should occupy this fraction of canvas width
    VEHICLE_WIDTH_RATIO = 0.70  # 70% — targets 60-75% range (accounts for height constraint)

    # Vehicle bottom edge at this fraction of canvas height (leaves room for shadow)
    FLOOR_POSITION_RATIO = 0.88  # 88% down — natural floor line

    def __init__(
        self,
        background_remover: Optional[BackgroundRemover] = None,
        studio_width: int = 1920,
        studio_height: int = 1080,
    ):
        self.background_remover = background_remover or MockRemover()
        self.rembg_used = False
        self.transparent_image = None
        self.studio_width = studio_width
        self.studio_height = studio_height

        # Contact shadow generator (replaces ReflectionGenerator)
        self.contact_shadow_gen = ContactShadowGenerator(
            blur_radius=40,
            opacity=0.35,
            width_ratio=1.1,
            height_ratio=0.08,
        )

        # Optional enhancement modules (only used when feature flags are on)
        self.lighting_corrector = LightingCorrector(
            brightness=1.05,
            contrast=1.15,
            color_balance=(1.0, 0.98, 0.95),
            sharpen=0.6,
        )
        self.wheel_preserver = WheelPreserver(
            wheel_mask_threshold=60, sharpen_strength=1.4
        )
        self.paint_enhancer = PaintReflectionEnhancer(
            highlight_boost=1.4, specular_boost=1.2, smoothness=0.5
        )

    def _scale_vehicle(self, vehicle: Image.Image) -> Image.Image:
        """Scale vehicle to occupy ~70% of canvas width, maintaining aspect ratio.

        Crops to the bounding box of non-transparent pixels first to remove
        any transparent padding, then scales to the target width.

        Args:
            vehicle: Vehicle image with transparent background (RGBA)

        Returns:
            Scaled vehicle image (RGBA), cropped to vehicle extent
        """
        # Crop to bounding box of non-transparent pixels to remove padding
        if "A" in vehicle.getbands():
            alpha = np.array(vehicle.split()[3])
            if alpha.max() > 0:
                rows = np.any(alpha > 10, axis=1)
                cols = np.any(alpha > 10, axis=0)
                if rows.any() and cols.any():
                    rmin, rmax = np.where(rows)[0][[0, -1]]
                    cmin, cmax = np.where(cols)[0][[0, -1]]
                    vehicle = vehicle.crop((cmin, rmin, cmax + 1, rmax + 1))

        v_w, v_h = vehicle.size

        # Calculate scale factor based on canvas width
        target_width = int(self.studio_width * self.VEHICLE_WIDTH_RATIO)
        scale_factor = target_width / v_w

        new_w = int(v_w * scale_factor)
        new_h = int(v_h * scale_factor)

        # Ensure we don't exceed available floor space (leave room above + shadow below)
        max_height = int(self.studio_height * self.FLOOR_POSITION_RATIO)
        if new_h > max_height:
            height_scale = max_height / new_h
            new_w = int(new_w * height_scale)
            new_h = int(new_h * height_scale)

        scaled = vehicle.resize((new_w, new_h), Image.LANCZOS)
        logger.debug(
            "Vehicle scaled: %dx%d -> %dx%d (scale_factor=%.2f)",
            v_w, v_h, new_w, new_h, scale_factor,
        )
        return scaled

    def process(
        self,
        car_image: Image.Image,
        studio_background: Optional[Image.Image] = None,
        studio_color: str = "#1a1a1a",
        original_image: Optional[Image.Image] = None,
    ) -> Image.Image:
        """
        Process car image through production AI pipeline.

        Args:
            car_image: Original car image (mobile phone photo)
            studio_background: Studio background image (must be loaded by caller)
            studio_color: Fallback studio floor color (hex) if no background image
            original_image: Original unprocessed image (for optional wheel preservation)

        Returns:
            Professionally composed final image (RGBA)
        """
        canvas_size = (self.studio_width, self.studio_height)

        # ── Step 1: Remove background ──
        car_no_bg = self.background_remover.remove_background(car_image)
        logger.debug(
            "BackgroundRemover output mode=%s size=%s",
            car_no_bg.mode,
            car_no_bg.size,
        )
        self.transparent_image = car_no_bg.copy()

        # ── Step 2: Scale vehicle to 60-75% of canvas width ──
        vehicle = self._scale_vehicle(car_no_bg)
        logger.debug(
            "Scaled vehicle mode=%s size=%s",
            vehicle.mode,
            vehicle.size,
        )

        # ── Step 3: Optional lighting correction ──
        if ENABLE_LIGHTING_CORRECTION:
            vehicle = self.lighting_corrector.correct(vehicle)
            logger.debug(
                "LightingCorrector output mode=%s size=%s",
                vehicle.mode,
                vehicle.size,
            )
        else:
            logger.debug("LightingCorrector SKIPPED (ENABLE_LIGHTING_CORRECTION=false)")

        # ── Step 4: Optional enhancement ──
        if ENABLE_ENHANCEMENT:
            vehicle = self.wheel_preserver.preserve(vehicle, original_image)
            logger.debug(
                "WheelPreserver output mode=%s size=%s",
                vehicle.mode,
                vehicle.size,
            )
            vehicle = self.paint_enhancer.enhance(vehicle)
            logger.debug(
                "PaintEnhancer output mode=%s size=%s",
                vehicle.mode,
                vehicle.size,
            )
        else:
            logger.debug("Enhancement SKIPPED (ENABLE_ENHANCEMENT=false)")

        # ── Step 5: Generate contact shadow ──
        contact_shadow = self.contact_shadow_gen.generate(
            vehicle_width=vehicle.size[0],
            vehicle_height=vehicle.size[1],
            canvas_size=canvas_size,
        )
        logger.debug("ContactShadowGenerator output mode=%s size=%s", contact_shadow.mode, contact_shadow.size)

        # ── Step 6: Composite final image ──
        # Calculate vehicle position: centered horizontally, sitting on floor
        v_w, v_h = vehicle.size
        car_x = (self.studio_width - v_w) // 2
        floor_y = int(self.studio_height * self.FLOOR_POSITION_RATIO)
        car_y = floor_y - v_h

        # 6a: Canvas starts with studio background or solid color fallback
        canvas = Image.new("RGBA", canvas_size)

        if studio_background is not None:
            # Resize studio background to fill canvas
            studio_resized = studio_background.resize(canvas_size, Image.LANCZOS)
            if studio_resized.mode != "RGBA":
                studio_resized = studio_resized.convert("RGBA")
            canvas.paste(studio_resized, (0, 0))
            logger.debug("Studio background applied: resized to %s", canvas_size)
        else:
            # Fallback: solid color canvas (parse hex color)
            r = int(studio_color[1:3], 16)
            g = int(studio_color[3:5], 16)
            b = int(studio_color[5:7], 16)
            canvas = Image.new("RGBA", canvas_size, (r, g, b, 255))
            logger.debug("No studio background — using solid color: %s", studio_color)

        # 6b: Place contact shadow at vehicle's floor position
        # Shadow sits right below the vehicle's bottom edge
        shadow_y = floor_y - int(v_h * self.contact_shadow_gen.height_ratio)
        canvas.alpha_composite(contact_shadow, dest=(0, shadow_y))

        # 6c: Place vehicle on top
        canvas.alpha_composite(vehicle, dest=(car_x, car_y))
        logger.debug(
            "Vehicle placed at (%d, %d), floor_y=%d, canvas=%s",
            car_x, car_y, floor_y, canvas_size,
        )

        return canvas


# ============================================================================
# Export for API routes
# ============================================================================


def get_compositing_service() -> AICompositingService:
    """Get compositing service instance with configured background remover.

    Uses get_background_remover() from rembg_service to select the
    appropriate BackgroundRemover implementation based on:
    - ENABLE_REMBG feature flag
    - BG_REMOVAL_ENGINE configuration (rembg, bria, birefnet)

    Falls back to MockRemover if background removal is disabled or
    the configured engine is unavailable.
    """
    from .rembg_service import get_background_remover

    background_remover = get_background_remover()
    service = AICompositingService(background_remover=background_remover)

    # Track whether a real bg removal engine is being used
    from .rembg_service import RembgRemover
    service.rembg_used = isinstance(background_remover, RembgRemover)

    return service