"""
Core image processing services for AutoStudio AI.
Implements realistic AI compositing pipeline:
- Background removal (using external API)
- Realistic floor reflections
- Shadow matching and generation
- Lighting correction
- Perspective correction
- Wheel preservation
- Paint reflection enhancement
"""

import logging
import random
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

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
        # This would make a POST request to remove.bg or similar
        # Returning original with alpha channel added for MVP
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
# Realistic Shadow Generator
# ============================================================================


class ShadowGenerator:
    """Generates realistic car shadows based on lighting conditions."""

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
        """
        Generate a realistic shadow layer from the car mask.

        Args:
            car_mask: Single-channel mask of the car (alpha or grayscale)
            canvas_size: Size of the final canvas (width, height)

        Returns:
            Shadow image with proper gradient and blur
        """
        # Convert mask to binary
        mask = car_mask.convert("L")
        mask = mask.point(lambda p: 255 if p > 128 else 0)

        # Create shadow layer
        shadow = Image.new("L", canvas_size, 0)
        shadow.paste(255, (0, 0), mask)

        # Apply offset for realistic shadow position
        shadow = shadow.transform(
            canvas_size, Image.AFFINE, (1, 0, self.offset_x, 0, 1, self.offset_y)
        )

        # Apply Gaussian blur for soft edges
        shadow = shadow.filter(ImageFilter.GaussianBlur(self.blur_radius))

        # Create gradient fade for realistic distance-based softness
        shadow_array = np.array(shadow, dtype=np.float32)

        # Distance from car (simplified: fade towards edges)
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
# Floor Reflection Generator
# ============================================================================


class ReflectionGenerator:
    """Generates realistic floor reflections for studio photography."""

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
        """
        Generate realistic reflection below the car.

        Args:
            car_image: Car image with transparent background (RGBA)
            floor_color: Floor color hex string

        Returns:
            Reflection image to composite below the car
        """
        # Defensive: ensure image has alpha channel
        if "A" not in car_image.getbands():
            car_image = car_image.convert("RGBA")

        w, h = car_image.size

        # Extract alpha channel for reflection mask
        alpha = car_image.split()[3]

        # Create reflection of the car
        reflection = car_image.copy()
        reflection = ImageOps.flip(reflection)

        # Apply opacity gradient to reflection (stronger at bottom, fades up)
        reflection_array = np.array(reflection, dtype=np.float32)
        alpha_array = np.array(alpha, dtype=np.float32)

        reflection_height = int(h * self.reflection_height_ratio)
        for y in range(reflection_height):
            # Create fade gradient from bottom to top
            fade_factor = 1 - (y / reflection_height) ** 1.5
            fade_factor *= self.fade_strength

            # Apply noise for realistic imperfections
            noise = random.uniform(-self.noise_intensity, self.noise_intensity)
            fade_factor = np.clip(fade_factor + noise, 0, 1)

            for x in range(w):
                if alpha_array[y, x] > 0:  # Only in car area
                    # Alpha channel is the 4th channel (index 3)
                    reflection_array[y, x, 3] *= fade_factor

        reflection = Image.fromarray(np.clip(reflection_array, 0, 255).astype(np.uint8))

        # Slight blur on reflection for mirror effect
        reflection = reflection.filter(ImageFilter.GaussianBlur(self.blur_radius))

        return reflection


# ============================================================================
# Lighting Correction
# ============================================================================


class LightingCorrector:
    """Applies professional lighting corrections to the car."""

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

        # Simple perspective correction (simulated with affine transform)
        # In production, use OpenCV or deep learning based correction
        if self.keystone_correct:
            # Apply slight keystone correction
            w_new, h_new = image.size
            margin = int(w_new * 0.05)  # 5% margin

            # Perspective coefficients (slight inward slant)
            src_points = [(0, 0), (w_new, 0), (w_new, h_new), (0, h_new)]
            dst_points = [
                (margin, margin),
                (w_new - margin, margin),
                (w_new - margin * 2, h_new),
                (margin * 2, h_new),
            ]

            # Calculate transform matrix
            # (Simplified - in production use OpenCV getPerspectiveTransform)
            pass

        return image


# ============================================================================
# Wheel Preservation
# ============================================================================


class WheelPreserver:
    """Ensures wheels maintain detail and don't get over-processed."""

    def __init__(self, wheel_mask_threshold: int = 50, sharpen_strength: float = 1.3):
        self.wheel_mask_threshold = wheel_mask_threshold
        self.sharpen_strength = sharpen_strength

    def preserve(
        self, car_image: Image.Image, original_image: Optional[Image.Image] = None
    ) -> Image.Image:
        """
        Preserve wheel detail in processed car image.

        If original_image is provided, extract wheel regions from original
        and merge them into the processed image.
        """
        if original_image is None:
            # Fallback: Apply sharpening to wheel-like areas
            return ImageEnhance.Sharpness(car_image).enhance(self.sharpen_strength)

        # Detect wheel regions (simplified - in production use car detection model)
        # For now, apply global sharpening with localized wheel enhancement
        car_array = np.array(car_image)

        # Simulate wheel regions (bottom corners of car)
        h, w, _ = car_array.shape
        wheel_region_height = int(h * 0.2)
        wheel_region_width = int(w * 0.15)

        # Sharpen bottom regions (wheels)
        for y in range(h - wheel_region_height, h):
            for x in range(w):
                # Apply stronger sharpening near edges
                if x < wheel_region_width or x > w - wheel_region_width:
                    # This is a simplified version
                    pass

        return ImageEnhance.Sharpness(car_image).enhance(self.sharpen_strength)


# ============================================================================
# Paint Reflection Enhancer
# ============================================================================


class PaintReflectionEnhancer:
    """Enhances paint reflections and glossy finish."""

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
        # Extract alpha channel before RGB processing
        if "A" in image.getbands():
            alpha = image.split()[3]
        else:
            alpha = Image.new("L", image.size, 255)

        # Process RGB channels only
        img = image.convert("RGB")
        img_array = np.array(img, dtype=np.float32) / 255.0

        # Calculate luminance
        r, g, b = img_array[:, :, 0], img_array[:, :, 1], img_array[:, :, 2]
        luminance = 0.299 * r + 0.587 * g + 0.114 * b

        # Create highlight mask (areas that should be shiny)
        highlight_mask = np.clip(luminance * self.highlight_boost, 0, 1)

        # Apply specular enhancement
        enhanced = np.zeros_like(img_array)
        for c in range(3):  # RGB
            enhanced[:, :, c] = img_array[:, :, c] + (
                highlight_mask * self.specular_boost * 0.2
            )

        # Apply smoothing for glossy look
        enhanced = np.clip(enhanced, 0, 1)

        # Convert back to image
        enhanced = (enhanced * 255).astype(np.uint8)
        enhanced_img = Image.fromarray(enhanced, "RGB")

        # Subtle noise reduction for smooth finish
        if self.smoothness > 0:
            enhanced_img = enhanced_img.filter(
                ImageFilter.GaussianBlur(radius=self.smoothness)
            )
            enhanced_img = ImageEnhance.Sharpness(enhanced_img).enhance(1.2)

        # Reattach original alpha channel
        result = Image.merge("RGBA", enhanced_img.split() + (alpha,))
        return result


# ============================================================================
# Main AI Compositing Service
# ============================================================================


class AICompositingService:
    """Orchestrates all AI processing steps for professional car photography."""

    def __init__(
        self,
        background_remover: Optional[BackgroundRemover] = None,
        studio_width: int = 1200,
        studio_height: int = 800,
    ):
        self.background_remover = background_remover or MockRemover()
        self.rembg_used = False  # Track whether real bg removal was used
        self.transparent_image = None  # Store transparent vehicle image for preservation
        self.studio_width = studio_width
        self.studio_height = studio_height

        # Initialize all processing modules
        self.shadow_gen = ShadowGenerator(
            blur_radius=25, opacity=0.7, offset_x=0, offset_y=20, angle_deg=30
        )
        self.reflection_gen = ReflectionGenerator(
            reflection_height_ratio=0.2,
            fade_strength=0.6,
            noise_intensity=0.03,
            blur_radius=3,
        )
        self.lighting_corrector = LightingCorrector(
            brightness=1.05,
            contrast=1.15,
            color_balance=(1.0, 0.98, 0.95),  # Slight warm tone
            sharpen=0.6,
        )
        self.perspective_corrector = PerspectiveCorrector(
            scale_factor=0.8, keystone_correct=True
        )
        self.wheel_preserver = WheelPreserver(
            wheel_mask_threshold=60, sharpen_strength=1.4
        )
        self.paint_enhancer = PaintReflectionEnhancer(
            highlight_boost=1.4, specular_boost=1.2, smoothness=0.5
        )

    def process(
        self,
        car_image: Image.Image,
        studio_background: Optional[Image.Image] = None,
        studio_color: str = "#1a1a1a",
        original_image: Optional[Image.Image] = None,
    ) -> Image.Image:
        """
        Process car image through complete AI pipeline.

        Args:
            car_image: Original car image (mobile phone photo)
            studio_background: Optional studio background image
            studio_color: Studio floor color (hex)
            original_image: Original unprocessed image for wheel preservation

        Returns:
            Professionally composed final image
        """
        # 1. Remove background
        car_no_bg = self.background_remover.remove_background(car_image)
        logger.debug(
            "BackgroundRemover output mode=%s size=%s",
            car_no_bg.mode,
            car_no_bg.size,
        )
        # Store for preservation (avoid re-calling remove_background)
        self.transparent_image = car_no_bg.copy()

        # 2. Perspective correction
        car_corrected = self.perspective_corrector.correct(
            car_no_bg, (self.studio_width, self.studio_height)
        )
        logger.debug(
            "PerspectiveCorrector output mode=%s size=%s",
            car_corrected.mode,
            car_corrected.size,
        )

        # 3. Lighting correction
        car_lit = self.lighting_corrector.correct(car_corrected)
        logger.debug(
            "LightingCorrector output mode=%s size=%s",
            car_lit.mode,
            car_lit.size,
        )

        # 4. Wheel preservation (merge details from original if available)
        car_wheel = self.wheel_preserver.preserve(car_lit, original_image)
        logger.debug(
            "WheelPreserver output mode=%s size=%s",
            car_wheel.mode,
            car_wheel.size,
        )

        # 5. Paint reflection enhancement
        car_final = self.paint_enhancer.enhance(car_wheel)
        logger.debug(
            "PaintEnhancer output mode=%s size=%s",
            car_final.mode,
            car_final.size,
        )

        # 6. Generate realistic shadow
        shadow = self.shadow_gen.generate(
            car_final, (self.studio_width, self.studio_height)
        )

        # 7. Generate floor reflection
        reflection = self.reflection_gen.generate(car_final, studio_color)
        logger.debug(
            "ReflectionGenerator output mode=%s size=%s",
            reflection.mode,
            reflection.size,
        )

        # 8. Create final composite
        # Base canvas with studio background
        canvas = Image.new(
            "RGBA", (self.studio_width, self.studio_height), studio_color + "ff"
        )

        if studio_background:
            # Resize studio background to match canvas
            studio_resized = studio_background.resize(
                (self.studio_width, self.studio_height), Image.LANCZOS
            )
            canvas.paste(studio_resized, (0, 0))

        # Composite: shadow first
        shadow_rgba = shadow.convert("RGBA")
        shadow_alpha_array = (np.array(shadow).astype(np.float32) * 0.3).astype(np.uint8)
        shadow_rgba.putalpha(Image.fromarray(shadow_alpha_array, mode="L"))
        canvas.alpha_composite(shadow_rgba, dest=(0, self.studio_height - 100))

        # Floor reflection (on top of shadow)
        reflection_x = (self.studio_width - car_final.size[0]) // 2
        reflection_y = self.studio_height - car_final.size[1] + 20
        reflection_rgba = reflection.convert("RGBA")
        canvas.alpha_composite(reflection_rgba, dest=(reflection_x, reflection_y))

        # Car image on top
        car_x = (self.studio_width - car_final.size[0]) // 2
        car_y = self.studio_height - car_final.size[1] - 20
        canvas.alpha_composite(car_final, dest=(car_x, car_y))

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
