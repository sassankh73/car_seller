"""
Core image processing services for AutoStudio AI.
Implements production compositing pipeline:
- Background removal (using external API)
- Studio background placement
- Vehicle scaling and positioning with wheel contact detection
- Contact shadow generation with studio-specific shadow profiles
- Ambient occlusion shadow for physical grounding
- Optional enhancement pipeline (feature-flagged)

Feature flags (env vars):
- ENABLE_ENHANCEMENT: Enable paint/wheel enhancement (default: false)
- ENABLE_LIGHTING_CORRECTION: Enable lighting correction (default: false)
"""

import logging
import math
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
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
# Studio Shadow Profile & Vehicle Type Definitions
# ============================================================================


@dataclass
class StudioShadowProfile:
    """Shadow parameters specific to each studio environment.

    Each studio has different lighting conditions, so shadows must
    be tuned per-studio to look natural.
    """

    floor_y: float = 0.88
    """Vertical position of the floor line as a fraction of canvas height (0.0-1.0)."""

    shadow_direction: str = "center"
    """Direction shadows fall: 'center', 'left', or 'right'.

    - center: light directly above, shadow falls straight down
    - left: light from the right, shadow offset to the left
    - right: light from the left, shadow offset to the right
    """

    shadow_blur: int = 35
    """Gaussian blur radius for the body shadow (pixels). Higher = softer."""

    shadow_opacity: float = 0.30
    """Maximum opacity of the body shadow (0.0-1.0)."""

    shadow_length: float = 1.0
    """Shadow length multiplier. 1.0 = standard, >1.0 = longer shadow."""

    tire_shadow_blur: int = 14
    """Gaussian blur radius for the tire contact shadow (pixels)."""

    tire_shadow_opacity: float = 0.55
    """Maximum opacity of the tire contact shadow (0.0-1.0)."""

    ao_shadow_opacity: float = 0.40
    """Maximum opacity of the ambient occlusion contact shadow (0.0-1.0)."""

    ao_shadow_width: float = 1.0
    """Width multiplier for the ambient occlusion shadow relative to vehicle width."""

    ao_shadow_height: float = 0.05
    """Height of the AO shadow as a fraction of canvas height."""

    vehicle_y_offset: float = 0.035
    """Additional vertical offset as a fraction of canvas height (positive = lower, negative = higher).

    This controls how far down the vehicle sits on the studio floor.
    0.035 = 3.5% of canvas height (~38px on 1080, ~76px on 4K).
    Use positive values to push the vehicle lower (better ground contact),
    negative values if the vehicle overlaps the floor too much.
    """

    vehicle_scale: float = 1.0
    """Scale multiplier applied to the vehicle type's base scale target.

    1.0 = default size, 0.9 = 10% smaller, 1.1 = 10% larger.
    Adjust to fine-tune vehicle proportions relative to the studio.
    """

    shadow_strength: float = 1.0
    """Overall shadow strength multiplier. Scales all shadow opacities.

    1.0 = default shadows, 1.3 = 30% stronger, 0.7 = 30% lighter.
    Higher values make shadows more pronounced, lower values more subtle.
    """

    horizon_y: float = 0.45
    """Vertical position of the studio horizon/vanishing point (0.0-1.0).

    Used for perspective matching: when the horizon is lower (smaller value),
    the camera is more at eye level and the vehicle should sit lower on the floor.
    When the horizon is higher (larger value), the camera is looking down more.
    """


# Vehicle type classification thresholds based on aspect ratio (width / height)
VEHICLE_TYPE_SUV = "suv"
VEHICLE_TYPE_SEDAN = "sedan"
VEHICLE_TYPE_COUPE = "coupe"
VEHICLE_TYPE_HATCHBACK = "hatchback"
VEHICLE_TYPE_WAGON = "wagon"

# Scale targets per vehicle type (fraction of canvas width)
VEHICLE_SCALE_TARGETS = {
    VEHICLE_TYPE_SUV: 0.75,        # SUVs: 70-80% canvas width
    VEHICLE_TYPE_SEDAN: 0.70,      # Sedans: 65-75% canvas width
    VEHICLE_TYPE_COUPE: 0.68,      # Coupes: 63-73% canvas width (slightly smaller)
    VEHICLE_TYPE_WAGON: 0.72,      # Wagons: 67-77% canvas width (slightly wider)
    VEHICLE_TYPE_HATCHBACK: 0.65,  # Hatchbacks: 60-70% canvas width
}


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
# Contact Shadow Generator (studio-aware, with tire contact shadows)
# ============================================================================


class ContactShadowGenerator:
    """Generates realistic contact shadows beneath the vehicle.

    Creates three shadow layers for physical grounding:
    1. Ambient occlusion contact shadow — dark band at the vehicle's base
       where it meets the floor, giving a sense of physical contact
    2. Tire contact shadows — thin, darker elliptical patches directly
       under each tire contact point
    3. Body floor shadow — wider, softer shadow under the vehicle body,
       offset based on studio lighting direction

    Studio-specific parameters are provided via StudioShadowProfile.
    """

    def generate_ambient_occlusion_shadow(
        self,
        vehicle: Image.Image,
        wheel_contact_points: List[Tuple[int, int]],
        vehicle_offset: Tuple[int, int],
        canvas_size: Tuple[int, int],
        profile: StudioShadowProfile,
    ) -> Image.Image:
        """Generate an ambient occlusion shadow under the vehicle body.

        This creates a narrow, dark band where the vehicle meets the floor,
        simulating the occlusion of ambient light in the gap between the
        vehicle's underside and the floor surface. This is critical for
        making the vehicle appear physically grounded on the surface.

        Args:
            vehicle: Scaled vehicle image (RGBA)
            wheel_contact_points: List of (x, y) contact points relative to vehicle
            vehicle_offset: (x, y) position of vehicle on canvas
            canvas_size: Canvas dimensions (width, height)
            profile: Studio shadow profile with AO shadow parameters

        Returns:
            RGBA shadow layer with ambient occlusion shadow
        """
        canvas_w, canvas_h = canvas_size
        v_w, v_h = vehicle.size

        # AO shadow dimensions
        ao_w = int(v_w * profile.ao_shadow_width)
        ao_h = max(int(canvas_h * profile.ao_shadow_height), 8)

        # Position: centered under the vehicle, just above the floor
        lowest_contact_y = max(cy for _, cy in wheel_contact_points) if wheel_contact_points else v_h
        ao_cx = vehicle_offset[0] + v_w // 2
        ao_cy = vehicle_offset[1] + lowest_contact_y

        # Build AO shadow as a horizontal gradient
        shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        shadow_arr = np.zeros((canvas_h, canvas_w), dtype=np.float32)

        # Create the shadow gradient
        y_coords, x_coords = np.ogrid[:canvas_h, :canvas_w]

        # Horizontal: strong in the center, fading at the edges
        x_dist = ((x_coords - ao_cx).astype(np.float32) / (ao_w / 2)) ** 2
        # Vertical: strongest at the floor line, fading both up and down
        # The shadow should be slightly above and below the floor line
        y_dist = ((y_coords - ao_cy).astype(np.float32) / (ao_h / 2)) ** 2

        # Combine: elliptical gradient with stronger vertical falloff above
        ellipse_dist = np.sqrt(x_dist + y_dist)

        # AO shadow is a soft gradient with stronger intensity at center
        ao_strength = np.clip(1.0 - ellipse_dist, 0, 1)
        # Use a softer falloff curve (cubic) for natural AO
        ao_strength = ao_strength ** 2.0
        ao_strength *= profile.ao_shadow_opacity

        shadow_arr = (ao_strength * 255).astype(np.uint8)

        # Build RGBA shadow layer
        r = np.zeros_like(shadow_arr)
        g = np.zeros_like(shadow_arr)
        b = np.zeros_like(shadow_arr)
        a = shadow_arr
        shadow_composite = np.stack([r, g, b, a], axis=-1)
        shadow_rgba = Image.fromarray(shadow_composite, mode="RGBA")

        # Apply light Gaussian blur for softness
        if profile.shadow_blur > 0:
            blur_radius = max(int(profile.shadow_blur * 0.4), 3)
            alpha = shadow_rgba.split()[3]
            alpha = alpha.filter(ImageFilter.GaussianBlur(blur_radius))
            r_ch, g_ch, b_ch, _ = shadow_rgba.split()
            shadow_rgba = Image.merge("RGBA", (r_ch, g_ch, b_ch, alpha))

        return shadow_rgba

    def generate_tire_contact_shadow(
        self,
        vehicle: Image.Image,
        wheel_contact_points: List[Tuple[int, int]],
        vehicle_offset: Tuple[int, int],
        canvas_size: Tuple[int, int],
        profile: StudioShadowProfile,
    ) -> Image.Image:
        """Generate thin contact shadows directly under each tire.

        Args:
            vehicle: Scaled vehicle image (RGBA)
            wheel_contact_points: List of (x, y) contact points relative to vehicle
            vehicle_offset: (x, y) position of vehicle on canvas
            canvas_size: Canvas dimensions (width, height)
            profile: Studio shadow profile with tire shadow parameters

        Returns:
            RGBA shadow layer with tire contact shadows
        """
        canvas_w, canvas_h = canvas_size
        shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

        # Tire contact shadow parameters — wider and more visible for grounding
        tire_w = int(vehicle.size[0] * 0.11)  # ~11% of vehicle width per tire (increased for better contact)
        tire_h = max(int(tire_w * 0.35), 6)   # Wider ellipse for more visible shadow (was 0.30→0.35)
        blur = profile.tire_shadow_blur
        opacity = profile.tire_shadow_opacity

        for cx_rel, cy_rel in wheel_contact_points:
            # Convert from vehicle-relative to canvas coordinates
            cx = vehicle_offset[0] + cx_rel
            cy = vehicle_offset[1] + cy_rel

            # Create small elliptical gradient for each tire
            patch_w = tire_w * 3  # Extra space for blur
            patch_h = tire_h * 4
            patch = Image.new("RGBA", (patch_w, patch_h), (0, 0, 0, 0))
            patch_arr = np.zeros((patch_h, patch_w, 4), dtype=np.uint8)

            # Elliptical gradient centered in the patch
            cy_patch = patch_h // 2
            cx_patch = patch_w // 2
            y_coords, x_coords = np.ogrid[:patch_h, :patch_w]
            x_dist = ((x_coords - cx_patch).astype(np.float32) / (tire_w / 2)) ** 2
            y_dist = ((y_coords - cy_patch).astype(np.float32) / (tire_h / 2)) ** 2
            ellipse_val = np.sqrt(x_dist + y_dist)

            alpha_val = np.clip(1.0 - ellipse_val, 0, 1)
            alpha_val = alpha_val ** 1.3  # Slightly softer falloff for natural look
            alpha_val *= opacity

            patch_arr[:, :, 0] = 0  # R
            patch_arr[:, :, 1] = 0  # G
            patch_arr[:, :, 2] = 0  # B
            patch_arr[:, :, 3] = (alpha_val * 255).astype(np.uint8)

            patch = Image.fromarray(patch_arr, mode="RGBA")

            # Apply blur for softness
            if blur > 0:
                patch = patch.filter(ImageFilter.GaussianBlur(blur))

            # Paste onto shadow layer at the tire contact point
            dest_x = cx - patch_w // 2
            dest_y = cy - patch_h // 2
            shadow_layer.alpha_composite(patch, dest=(dest_x, dest_y))

        return shadow_layer

    def generate_body_floor_shadow(
        self,
        vehicle: Image.Image,
        wheel_contact_points: List[Tuple[int, int]],
        vehicle_offset: Tuple[int, int],
        canvas_size: Tuple[int, int],
        profile: StudioShadowProfile,
    ) -> Image.Image:
        """Generate the wider, softer body shadow on the floor.

        Args:
            vehicle: Scaled vehicle image (RGBA)
            wheel_contact_points: List of (x, y) contact points relative to vehicle
            vehicle_offset: (x, y) position of vehicle on canvas
            canvas_size: Canvas dimensions (width, height)
            profile: Studio shadow profile with shadow parameters

        Returns:
            RGBA shadow layer with the body floor shadow
        """
        canvas_w, canvas_h = canvas_size
        v_w, v_h = vehicle.size

        # Calculate shadow dimensions based on vehicle size
        shadow_w = int(v_w * 1.15 * profile.shadow_length)
        shadow_h = max(int(v_h * 0.08 * profile.shadow_length), 20)

        # Shadow offset based on direction
        if profile.shadow_direction == "left":
            offset_x = -int(v_w * 0.05)  # Shadow shifted left
        elif profile.shadow_direction == "right":
            offset_x = int(v_w * 0.05)  # Shadow shifted right
        else:
            offset_x = 0  # Center: no horizontal offset

        # Shadow center position on canvas
        # Center the shadow horizontally under the vehicle
        shadow_cx = vehicle_offset[0] + v_w // 2 + offset_x
        # Place shadow top edge just below the lowest wheel contact point
        lowest_contact_y = max(cy for _, cy in wheel_contact_points) if wheel_contact_points else v_h
        shadow_top_y = vehicle_offset[1] + lowest_contact_y

        # Build shadow as elliptical gradient
        shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        shadow_arr = np.zeros((canvas_h, canvas_w), dtype=np.float32)

        # Elliptical gradient centered at shadow position
        y_coords, x_coords = np.ogrid[:canvas_h, :canvas_w]
        x_dist = ((x_coords - shadow_cx).astype(np.float32) / (shadow_w / 2)) ** 2
        # Shadow stretches downward slightly from the contact line
        y_center = shadow_top_y + shadow_h // 2
        y_dist = ((y_coords - y_center).astype(np.float32) / (shadow_h / 2)) ** 2
        ellipse_dist = np.sqrt(x_dist + y_dist)

        shadow_strength = np.clip(1.0 - ellipse_dist, 0, 1)
        # Smoother falloff for more natural shadow appearance
        shadow_strength = shadow_strength ** 1.8
        shadow_strength *= profile.shadow_opacity

        shadow_arr = (shadow_strength * 255).astype(np.uint8)

        # Build RGBA shadow layer
        r = np.zeros_like(shadow_arr)
        g = np.zeros_like(shadow_arr)
        b = np.zeros_like(shadow_arr)
        a = shadow_arr
        shadow_composite = np.stack([r, g, b, a], axis=-1)
        shadow_rgba = Image.fromarray(shadow_composite, mode="RGBA")

        # Apply Gaussian blur for extra softness
        if profile.shadow_blur > 0:
            alpha = shadow_rgba.split()[3]
            alpha = alpha.filter(ImageFilter.GaussianBlur(profile.shadow_blur))
            r_ch, g_ch, b_ch, _ = shadow_rgba.split()
            shadow_rgba = Image.merge("RGBA", (r_ch, g_ch, b_ch, alpha))

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
        if "A" in image.getbands():
            alpha = image.split()[3]
        else:
            alpha = Image.new("L", image.size, 255)

        img = image.convert("RGB")

        r, g, b = img.split()
        r = ImageEnhance.Brightness(r).enhance(self.color_balance[0])
        g = ImageEnhance.Brightness(g).enhance(self.color_balance[1])
        b = ImageEnhance.Brightness(b).enhance(self.color_balance[2])
        img = Image.merge("RGB", (r, g, b))

        img = ImageEnhance.Brightness(img).enhance(self.brightness)
        img = ImageEnhance.Contrast(img).enhance(self.contrast)

        if self.sharpen > 0:
            img = ImageEnhance.Sharpness(img).enhance(1 + self.sharpen)

        result = Image.merge("RGBA", img.split() + (alpha,))
        return result


# ============================================================================
# Perspective Corrector (preserved for future use)
# ============================================================================


class PerspectiveCorrector:
    """Corrects perspective and maintains proper car proportions.

    NOTE: Not currently used in the production pipeline.
    Vehicle perspective is preserved as-is to avoid distortion.
    Future perspective correction should be based on explicit wheel
    geometry and horizon detection, not estimated transforms.
    """

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

        if self.scale_factor != 1.0:
            new_w = int(w * self.scale_factor)
            new_h = int(h * self.scale_factor)
            image = image.resize((new_w, new_h), Image.LANCZOS)

        if self.keystone_correct:
            pass  # Reserved for future OpenCV integration

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
    2. Crop to vehicle bounding box & classify vehicle type
    3. Scale vehicle based on type (SUV/sedan/coupe/wagon/hatchback)
    4. Detect wheel contact points (lowest opaque pixels)
    5. [Optional] Lighting correction (ENABLE_LIGHTING_CORRECTION)
    6. [Optional] Enhancement (ENABLE_ENHANCEMENT)
    7. Generate ambient occlusion shadow + tire contact shadows + body floor shadow
    8. Composite: studio bg → AO shadow → body shadow → tire shadow → vehicle

    Wheel contact detection ensures vehicles sit ON the floor rather
    than floating above it, matching OEM configurator imagery.

    Target output resembles:
    - BMW configurator imagery
    - Audi configurator imagery
    - Volvo configurator imagery
    - Mercedes configurator imagery
    - Dealer studio photography
    - Automotive marketplace listing images
    """

    # Default floor position ratio (overridden by studio shadow profile)
    FLOOR_POSITION_RATIO = 0.88

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

        # Shadow generators (studio-aware)
        self.shadow_generator = ContactShadowGenerator()

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

    # -----------------------------------------------------------------------
    # Wheel contact point detection
    # -----------------------------------------------------------------------

    def _detect_wheel_contact_points(self, vehicle: Image.Image) -> List[Tuple[int, int]]:
        """Detect the lowest opaque pixels in the vehicle image (wheel contact line).

        Scans the alpha channel bottom-up to find where the vehicle's
        wheels make contact with the ground. This is used to anchor
        the vehicle to the studio floor.

        The detection uses a two-threshold approach:
        - A higher threshold (alpha > 30) for identifying wheel segments
        - A lower threshold (alpha > 10) for finding the true bottom of each
          tire, catching anti-aliased edge pixels that are the actual contact

        Each segment scans the ENTIRE height of its column range (not just
        a restricted wheel region) to ensure the absolute lowest opaque pixel
        is found. This prevents vehicles from floating above the floor.

        Supports SUV, Sedan, Coupe, Wagon, and Hatchback body types.
        Handles up to 4 visible wheel contact points.

        Args:
            vehicle: Vehicle image with transparent background (RGBA), already cropped

        Returns:
            List of (x, y) tuples representing wheel contact points,
            relative to the vehicle image top-left corner.
        """
        if "A" not in vehicle.getbands():
            # No alpha channel — treat entire bottom row as contact
            w, h = vehicle.size
            return [(w // 4, h - 1), (3 * w // 4, h - 1)]

        alpha = np.array(vehicle.split()[3])
        h, w = alpha.shape

        if alpha.max() == 0:
            # Fully transparent — shouldn't happen after bg removal
            logger.warning("Vehicle image is fully transparent — using bottom edge as contact")
            return [(w // 4, h - 1), (3 * w // 4, h - 1)]

        # Two thresholds: higher for segment detection, lower for bottom pixel detection
        alpha_threshold = 30   # For identifying wheel segments (filters noise)
        bottom_threshold = 10  # For finding the true lowest tire pixel (catches anti-aliased edges)

        # Find the lowest row that has significant opaque content
        # Scan bottom-up, looking for rows with enough opaque pixels
        row_opaque_counts = np.sum(alpha > alpha_threshold, axis=1)

        # Find the bottom-most row with a meaningful amount of opaque pixels
        # (at least 3% of the vehicle width, to filter out noise)
        min_opaque_width = max(int(w * 0.03), 5)

        bottom_row = h - 1
        for row in range(h - 1, -1, -1):
            if row_opaque_counts[row] >= min_opaque_width:
                bottom_row = row
                break

        # Now find wheel contact points in the bottom region
        # Wheels are typically in the bottom 25% of the vehicle (expanded from 18%)
        # to better capture SUV/large vehicle wheels which sit lower relative to body
        wheel_region_top = max(bottom_row - int(h * 0.25), 0)
        wheel_region = alpha[wheel_region_top:, :]

        # Find columns that have opaque pixels in the wheel region
        col_opaque = np.any(wheel_region > alpha_threshold, axis=0)

        if not col_opaque.any():
            # Fallback: use the bottom row
            logger.debug("No wheel region detected — using bottom row")
            return [(w // 4, bottom_row), (3 * w // 4, bottom_row)]

        # Find contiguous segments of opaque columns (these represent wheels/tires)
        segments = []
        in_segment = False
        seg_start = 0

        for col_idx in range(len(col_opaque)):
            if col_opaque[col_idx] and not in_segment:
                in_segment = True
                seg_start = col_idx
            elif not col_opaque[col_idx] and in_segment:
                in_segment = False
                segments.append((seg_start, col_idx - 1))

        if in_segment:
            segments.append((seg_start, len(col_opaque) - 1))

        # Filter out very small segments (noise) — keep segments at least 2.5% of width
        min_segment_width = max(int(w * 0.025), 3)
        significant_segments = [
            (start, end) for start, end in segments
            if (end - start) >= min_segment_width
        ]

        if not significant_segments:
            # Fallback: use the largest segment or default positions
            logger.debug("No significant wheel segments found — using default positions")
            return [(w // 4, bottom_row), (3 * w // 4, bottom_row)]

        # For each significant segment, find the TRUE lowest opaque pixel
        # by scanning the ENTIRE height of that segment's columns bottom-up.
        # This is the key fix: we must not restrict to the wheel region because
        # the very bottom pixels of tires (often anti-aliased with low alpha)
        # exist below the wheel region boundary.
        contact_points = []
        for seg_start, seg_end in significant_segments:
            # Scan the full height of this segment's columns, bottom-up
            segment_cols = alpha[:, seg_start:seg_end + 1]

            # Find the absolute lowest row in this segment with any opaque pixel
            # Use the lower threshold (alpha > 10) for bottom detection to catch
            # anti-aliased tire edges that would be missed with a higher threshold
            lowest_row = None
            for row in range(h - 1, -1, -1):
                if np.any(segment_cols[row, :] > bottom_threshold):
                    lowest_row = row
                    break

            if lowest_row is None:
                # No opaque pixels in this segment at all (shouldn't happen)
                continue

            # Find the center column at the lowest row for this segment
            row_pixels = segment_cols[lowest_row, :]
            opaque_cols = np.where(row_pixels > bottom_threshold)[0]

            if len(opaque_cols) == 0:
                continue

            center_col = opaque_cols[len(opaque_cols) // 2]
            contact_points.append((
                seg_start + center_col,  # x relative to vehicle
                lowest_row,               # y relative to vehicle (absolute bottom)
            ))

        # Intelligent contact point selection based on count
        if len(contact_points) >= 4:
            # For 4+ points: keep the two outermost plus two inner
            # This handles SUVs and wagons with visible front/rear wheels on both sides
            contact_points.sort(key=lambda p: p[0])
            # Keep leftmost, rightmost, and two middle-ish
            leftmost = contact_points[0]
            rightmost = contact_points[-1]
            # From the middle points, pick the two that are most separated
            middle_points = contact_points[1:-1]
            if len(middle_points) >= 2:
                # Find the pair with the most separation
                best_pair = None
                best_dist = 0
                for i in range(len(middle_points)):
                    for j in range(i + 1, len(middle_points)):
                        dist = abs(middle_points[j][0] - middle_points[i][0])
                        if dist > best_dist:
                            best_dist = dist
                            best_pair = (middle_points[i], middle_points[j])
                if best_pair:
                    contact_points = [leftmost, best_pair[0], best_pair[1], rightmost]
                else:
                    contact_points = [leftmost, rightmost]
            else:
                contact_points = [leftmost, rightmost]

        elif len(contact_points) == 3:
            # Keep leftmost and rightmost for best floor contact
            contact_points.sort(key=lambda p: p[0])
            contact_points = [contact_points[0], contact_points[-1]]

        elif len(contact_points) == 1:
            # Add a symmetric point
            cx, cy = contact_points[0]
            contact_points.append((w - cx, cy))

        if len(contact_points) == 0:
            # Ultimate fallback
            contact_points = [(w // 4, bottom_row), (3 * w // 4, bottom_row)]

        # Use the LOWEST (largest Y) contact point as the definitive anchor
        # This ensures we use the true bottom of the tires, not an approximate row
        lowest_y = max(cy for _, cy in contact_points)

        logger.debug(
            "Wheel contact points detected: %s (bottom_row=%d, lowest_contact_y=%d, vehicle_h=%d)",
            contact_points, bottom_row, lowest_y, h,
        )
        return contact_points

    # -----------------------------------------------------------------------
    # Vehicle type classification
    # -----------------------------------------------------------------------

    def _classify_vehicle_type(self, vehicle: Image.Image) -> str:
        """Classify vehicle type based on aspect ratio.

        Uses the width/height ratio of the cropped vehicle to estimate
        whether it's an SUV, sedan, coupe, wagon, or hatchback.
        This determines the appropriate scale factor.

        Args:
            vehicle: Vehicle image with transparent background (RGBA), cropped to bbox

        Returns:
            Vehicle type string: VEHICLE_TYPE_SUV, VEHICLE_TYPE_SEDAN,
            VEHICLE_TYPE_COUPE, VEHICLE_TYPE_WAGON, or VEHICLE_TYPE_HATCHBACK
        """
        v_w, v_h = vehicle.size
        aspect_ratio = v_w / v_h if v_h > 0 else 2.5

        if aspect_ratio < 2.0:
            # Tall vehicles (aspect ratio < 2.0) — SUVs, trucks, large vehicles
            vehicle_type = VEHICLE_TYPE_SUV
        elif aspect_ratio > 2.8:
            # Wide/short vehicles (aspect ratio > 2.8) — hatchbacks, compacts
            vehicle_type = VEHICLE_TYPE_HATCHBACK
        elif 2.0 <= aspect_ratio < 2.3:
            # Narrower sedans and coupes — could be either
            # Coupes tend to be shorter/smaller, sedans larger
            # Use pixel count as a heuristic: more pixels = larger car = sedan
            pixel_count = v_w * v_h
            if pixel_count < 200000:  # Smaller silhouette
                vehicle_type = VEHICLE_TYPE_COUPE
            else:
                vehicle_type = VEHICLE_TYPE_SEDAN
        elif 2.3 <= aspect_ratio <= 2.5:
            # Wagons: wider than sedans but not as extreme as hatchbacks
            # They often have more rectangular profiles
            pixel_count = v_w * v_h
            if pixel_count > 300000:  # Larger silhouette suggests wagon
                vehicle_type = VEHICLE_TYPE_WAGON
            else:
                vehicle_type = VEHICLE_TYPE_SEDAN
        else:
            # Standard vehicles (2.5–2.8) — sedans
            vehicle_type = VEHICLE_TYPE_SEDAN

        logger.debug(
            "Vehicle classified as '%s' (aspect_ratio=%.2f, size=%dx%d)",
            vehicle_type, aspect_ratio, v_w, v_h,
        )
        return vehicle_type

    # -----------------------------------------------------------------------
    # Vehicle scaling (type-aware)
    # -----------------------------------------------------------------------

    def _scale_vehicle(self, vehicle: Image.Image, vehicle_type: Optional[str] = None, vehicle_scale: float = 1.0) -> Image.Image:
        """Scale vehicle to appropriate canvas width based on type, maintaining aspect ratio.

        Crops to the bounding box of non-transparent pixels first to remove
        any transparent padding, then scales to the target width.

        SUVs scale to ~75%, sedans to ~70%, coupes to ~68%,
        wagons to ~72%, hatchbacks to ~65% of canvas width.

        The vehicle_scale multiplier adjusts the base scale target for fine-tuning
        the vehicle's visual proportion relative to the studio. Values < 1.0 make
        the vehicle smaller (more studio visible), values > 1.0 make it larger.

        Args:
            vehicle: Vehicle image with transparent background (RGBA)
            vehicle_type: Optional pre-classified vehicle type. If None, will be classified.
            vehicle_scale: Scale multiplier applied to the base scale target (default: 1.0).

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

        # Classify vehicle type if not provided
        if vehicle_type is None:
            vehicle_type = self._classify_vehicle_type(vehicle)

        # Get scale target based on vehicle type, then apply vehicle_scale multiplier
        base_width_ratio = VEHICLE_SCALE_TARGETS.get(vehicle_type, 0.70)
        width_ratio = base_width_ratio * vehicle_scale

        # Calculate scale factor based on canvas width
        target_width = int(self.studio_width * width_ratio)
        scale_factor = target_width / v_w

        new_w = int(v_w * scale_factor)
        new_h = int(v_h * scale_factor)

        # Ensure we don't exceed available vertical space
        # Leave at least 5% at top and space for shadow below
        max_height = int(self.studio_height * 0.85)
        if new_h > max_height:
            height_scale = max_height / new_h
            new_w = int(new_w * height_scale)
            new_h = int(new_h * height_scale)

        scaled = vehicle.resize((new_w, new_h), Image.LANCZOS)
        logger.debug(
            "Vehicle scaled: %dx%d -> %dx%d (scale_factor=%.2f, type=%s, vehicle_scale=%.2f, base_ratio=%.2f)",
            v_w, v_h, new_w, new_h, scale_factor, vehicle_type, vehicle_scale, base_width_ratio,
        )
        return scaled

    # -----------------------------------------------------------------------
    # Main compositing pipeline
    # -----------------------------------------------------------------------

    def process(
        self,
        car_image: Image.Image,
        studio_background: Optional[Image.Image] = None,
        studio_color: str = "#1a1a1a",
        original_image: Optional[Image.Image] = None,
        shadow_profile: Optional[StudioShadowProfile] = None,
    ) -> Image.Image:
        """
        Process car image through production AI pipeline.

        Pipeline:
        1. Remove background
        2. Crop to bounding box & classify vehicle type
        3. Scale vehicle based on type
        4. Detect wheel contact points
        5. [Optional] Lighting correction
        6. [Optional] Enhancement
        7. Generate AO shadow + tire contact shadows + body floor shadow
        8. Composite: studio bg → AO shadow → body shadow → tire shadow → vehicle

        Args:
            car_image: Original car image (mobile phone photo)
            studio_background: Studio background image (must be loaded by caller)
            studio_color: Fallback studio floor color (hex) if no background image
            original_image: Original unprocessed image (for optional wheel preservation)
            shadow_profile: Studio-specific shadow parameters. If None, uses defaults.

        Returns:
            Professionally composed final image (RGBA)
        """
        if shadow_profile is None:
            shadow_profile = StudioShadowProfile()

        canvas_size = (self.studio_width, self.studio_height)
        floor_y = int(self.studio_height * shadow_profile.floor_y)

        # ── Step 1: Remove background ──
        car_no_bg = self.background_remover.remove_background(car_image)
        logger.debug(
            "BackgroundRemover output mode=%s size=%s",
            car_no_bg.mode,
            car_no_bg.size,
        )
        self.transparent_image = car_no_bg.copy()

        # ── Step 2: Classify vehicle type ──
        vehicle_type = self._classify_vehicle_type(car_no_bg)

        # ── Step 3: Scale vehicle based on type (with profile scale multiplier) ──
        vehicle = self._scale_vehicle(car_no_bg, vehicle_type=vehicle_type, vehicle_scale=shadow_profile.vehicle_scale)
        logger.debug(
            "Scaled vehicle mode=%s size=%s type=%s",
            vehicle.mode,
            vehicle.size,
            vehicle_type,
        )

        # ── Step 4: Detect wheel contact points ──
        wheel_contacts = self._detect_wheel_contact_points(vehicle)
        logger.debug(
            "Wheel contact points: %s (vehicle size: %s)",
            wheel_contacts,
            vehicle.size,
        )

        # ── Step 5: Optional lighting correction ──
        if ENABLE_LIGHTING_CORRECTION:
            vehicle = self.lighting_corrector.correct(vehicle)
            logger.debug(
                "LightingCorrector output mode=%s size=%s",
                vehicle.mode,
                vehicle.size,
            )
        else:
            logger.debug("LightingCorrector SKIPPED (ENABLE_LIGHTING_CORRECTION=false)")

        # ── Step 6: Optional enhancement ──
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

        # ── Step 7: Calculate vehicle position using wheel contact points ──
        v_w, v_h = vehicle.size
        car_x = (self.studio_width - v_w) // 2  # Centered horizontally

        # The key fix: use the LOWEST wheel contact point Y to anchor
        # the vehicle to the floor, NOT the bottom of the bounding box.
        # This prevents floating vehicles when there's transparent space
        # below the wheels.
        lowest_contact_y = max(cy for _, cy in wheel_contacts)

        # ── PERCENTAGE-BASED GROUNDING OFFSETS ──
        # All offsets are fractions of canvas height, ensuring consistent
        # grounding regardless of resolution (1080p, 4K, etc.).
        # On a 1080px canvas: 0.01 = 10.8px, 0.02 = 21.6px, 0.035 = 37.8px

        canvas_h = self.studio_height

        # Tire compression: fraction of canvas height for overlap with floor.
        # Real tires compress under weight, so contact patch overlaps the floor.
        # 0.006 = ~6.5px on 1080, ~13px on 4K
        TIRE_COMPRESSION = 0.006

        # Vehicle type grounding offsets (fraction of canvas height).
        # All types get downward push to prevent "floating car" appearance.
        # Heavier vehicles need more because bg removal leaves more artifacts
        # around large wheel wells, and their visual weight needs deeper grounding.
        VEHICLE_TYPE_OFFSET = {
            VEHICLE_TYPE_SUV: 0.010,        # ~10.8px on 1080
            VEHICLE_TYPE_WAGON: 0.008,      # ~8.6px on 1080
            VEHICLE_TYPE_SEDAN: 0.006,      # ~6.5px on 1080
            VEHICLE_TYPE_COUPE: 0.004,      # ~4.3px on 1080
            VEHICLE_TYPE_HATCHBACK: 0.004,  # ~4.3px on 1080
        }
        vehicle_type_offset = VEHICLE_TYPE_OFFSET.get(vehicle_type, 0.006)

        # Profile Y offset: fraction of canvas height from studio config.
        # Default 0.035 = ~37.8px on 1080, ~75.6px on 4K
        profile_y_offset = shadow_profile.vehicle_y_offset

        # Convert all offsets to pixels
        tire_compression_px = int(canvas_h * TIRE_COMPRESSION)
        vehicle_type_px = int(canvas_h * vehicle_type_offset)
        profile_y_px = int(canvas_h * profile_y_offset)

        # Position vehicle so the lowest wheel contact point sits at floor_y,
        # with tire compression + vehicle type offset + profile offset
        car_y = floor_y - lowest_contact_y + tire_compression_px + vehicle_type_px + profile_y_px

        # Comprehensive debug logging for vehicle placement diagnostics
        logger.info(
            "Vehicle placement: car_x=%d, car_y=%d, floor_y=%d, lowest_contact_y=%d, "
            "vehicle_h=%d, vehicle_w=%d, canvas_h=%d, vehicle_type=%s, "
            "tire_compression=%.3f(%dpx), type_offset=%.3f(%dpx), profile_offset=%.3f(%dpx)",
            car_x, car_y, floor_y, lowest_contact_y, v_h, v_w, canvas_h, vehicle_type,
            TIRE_COMPRESSION, tire_compression_px,
            vehicle_type_offset, vehicle_type_px,
            profile_y_offset, profile_y_px,
        )

        # ── Step 8: Generate shadows ──
        # Apply shadow_strength multiplier from profile to all shadow opacities.
        # This allows per-studio tuning of overall shadow intensity without
        # changing individual shadow parameters.
        shadow_render_profile = StudioShadowProfile(
            floor_y=shadow_profile.floor_y,
            shadow_direction=shadow_profile.shadow_direction,
            shadow_blur=shadow_profile.shadow_blur,
            shadow_opacity=min(shadow_profile.shadow_opacity * shadow_profile.shadow_strength, 1.0),
            shadow_length=shadow_profile.shadow_length,
            tire_shadow_blur=shadow_profile.tire_shadow_blur,
            tire_shadow_opacity=min(shadow_profile.tire_shadow_opacity * shadow_profile.shadow_strength, 1.0),
            ao_shadow_opacity=min(shadow_profile.ao_shadow_opacity * shadow_profile.shadow_strength, 1.0),
            ao_shadow_width=shadow_profile.ao_shadow_width,
            ao_shadow_height=shadow_profile.ao_shadow_height,
            vehicle_y_offset=shadow_profile.vehicle_y_offset,
            vehicle_scale=shadow_profile.vehicle_scale,
            shadow_strength=shadow_profile.shadow_strength,
            horizon_y=shadow_profile.horizon_y,
        )

        # 8a: Ambient occlusion shadow (dark contact band at vehicle base)
        ao_shadow = self.shadow_generator.generate_ambient_occlusion_shadow(
            vehicle=vehicle,
            wheel_contact_points=wheel_contacts,
            vehicle_offset=(car_x, car_y),
            canvas_size=canvas_size,
            profile=shadow_render_profile,
        )

        # 8b: Tire contact shadows (thin, dark patches under each wheel)
        tire_shadow = self.shadow_generator.generate_tire_contact_shadow(
            vehicle=vehicle,
            wheel_contact_points=wheel_contacts,
            vehicle_offset=(car_x, car_y),
            canvas_size=canvas_size,
            profile=shadow_render_profile,
        )

        # 8c: Body floor shadow (wider, softer shadow under the vehicle body)
        body_shadow = self.shadow_generator.generate_body_floor_shadow(
            vehicle=vehicle,
            wheel_contact_points=wheel_contacts,
            vehicle_offset=(car_x, car_y),
            canvas_size=canvas_size,
            profile=shadow_render_profile,
        )

        # ── Step 9: Composite final image ──
        # 9a: Canvas starts with studio background or solid color fallback
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

        # 9b: Place ambient occlusion shadow first (closest to the floor surface)
        canvas.alpha_composite(ao_shadow, dest=(0, 0))

        # 9c: Place body floor shadow on top of AO shadow
        canvas.alpha_composite(body_shadow, dest=(0, 0))

        # 9d: Place tire contact shadow on top of body shadow
        canvas.alpha_composite(tire_shadow, dest=(0, 0))

        # 9e: Place vehicle on top of everything
        canvas.alpha_composite(vehicle, dest=(car_x, car_y))

        logger.info(
            "Compositing complete: vehicle at (%d, %d), floor_y=%d, "
            "wheel_contacts=%d, shadow_direction=%s, canvas=%s, vehicle_type=%s",
            car_x, car_y, floor_y,
            len(wheel_contacts),
            shadow_profile.shadow_direction,
            canvas_size,
            vehicle_type,
        )

        # ── Step 10: Debug image (if enabled) ──
        if os.getenv("DEBUG_COMPOSITION", "false").lower() == "true":
            self._save_debug_image(
                canvas=canvas,
                vehicle=vehicle,
                car_x=car_x,
                car_y=car_y,
                floor_y=floor_y,
                wheel_contacts=wheel_contacts,
                lowest_contact_y=lowest_contact_y,
                tire_compression_px=tire_compression_px,
                vehicle_type_px=vehicle_type_px,
                profile_y_px=profile_y_px,
                shadow_profile=shadow_profile,
                vehicle_type=vehicle_type,
            )

        return canvas

    def _save_debug_image(
        self,
        canvas: Image.Image,
        vehicle: Image.Image,
        car_x: int,
        car_y: int,
        floor_y: int,
        wheel_contacts: List[Tuple[int, int]],
        lowest_contact_y: int,
        tire_compression_px: int,
        vehicle_type_px: int,
        profile_y_px: int,
        shadow_profile: StudioShadowProfile,
        vehicle_type: str,
    ) -> None:
        """Save a debug image showing placement calculations.

        Draws diagnostic overlays:
        - Red line: floor position (floor_y)
        - Green circles: wheel contact points
        - Blue rectangle: vehicle bounding box
        - Yellow line: lowest contact point Y
        - Cyan line: horizon line (horizon_y)

        Saved to STORAGE_DIR / debug / debug_composition_<timestamp>.png
        """
        import time
        from pathlib import Path

        debug_canvas = canvas.copy()

        # Import ImageDraw for annotations
        from PIL import ImageDraw
        draw = ImageDraw.Draw(debug_canvas)

        canvas_w, canvas_h = debug_canvas.size

        # Red line: floor position
        draw.line([(0, floor_y), (canvas_w, floor_y)], fill=(255, 0, 0, 200), width=3)
        draw.text((10, floor_y - 20), f"floor_y={floor_y} ({shadow_profile.floor_y:.2f})", fill=(255, 0, 0, 255))

        # Cyan line: horizon position
        horizon_y = int(canvas_h * shadow_profile.horizon_y)
        draw.line([(0, horizon_y), (canvas_w, horizon_y)], fill=(0, 255, 255, 200), width=2)
        draw.text((10, horizon_y + 5), f"horizon_y={horizon_y} ({shadow_profile.horizon_y:.2f})", fill=(0, 255, 255, 255))

        # Blue rectangle: vehicle bounding box
        v_w, v_h = vehicle.size
        draw.rectangle(
            [(car_x, car_y), (car_x + v_w, car_y + v_h)],
            outline=(0, 100, 255, 200),
            width=2,
        )
        draw.text((car_x + 5, car_y + 5), f"vehicle ({v_w}x{v_h})", fill=(0, 100, 255, 255))

        # Yellow line: lowest contact point Y (on canvas)
        contact_canvas_y = car_y + lowest_contact_y
        draw.line([(0, contact_canvas_y), (canvas_w, contact_canvas_y)], fill=(255, 255, 0, 200), width=2)
        draw.text((10, contact_canvas_y + 5), f"lowest_contact_y={contact_canvas_y}", fill=(255, 255, 0, 255))

        # Green circles: wheel contact points (on canvas)
        for cx_rel, cy_rel in wheel_contacts:
            cx_canvas = car_x + cx_rel
            cy_canvas = car_y + cy_rel
            r = 12
            draw.ellipse(
                [(cx_canvas - r, cy_canvas - r), (cx_canvas + r, cy_canvas + r)],
                outline=(0, 255, 0, 255),
                width=3,
            )
            draw.text((cx_canvas + r + 5, cy_canvas - 8), f"({cx_rel},{cy_rel})", fill=(0, 255, 0, 255))

        # Summary text
        total_offset = tire_compression_px + vehicle_type_px + profile_y_px
        summary_lines = [
            f"type={vehicle_type}  canvas={canvas_w}x{canvas_h}",
            f"car_y={car_y}  floor_y={floor_y}  contact_y={lowest_contact_y}",
            f"offsets: tire={tire_compression_px}px + type={vehicle_type_px}px + profile={profile_y_px}px = {total_offset}px",
            f"vehicle_y_offset={shadow_profile.vehicle_y_offset:.3f}  shadow_strength={shadow_profile.shadow_strength:.2f}",
        ]
        y_text = 10
        for line in summary_lines:
            draw.text((canvas_w - 400, y_text), line, fill=(255, 255, 255, 255))
            y_text += 18

        # Save to debug directory
        storage_dir = Path(__file__).parent.parent / "storage" / "debug"
        storage_dir.mkdir(parents=True, exist_ok=True)
        timestamp = int(time.time())
        debug_path = storage_dir / f"debug_composition_{timestamp}.png"
        debug_canvas.save(debug_path, format="PNG")
        logger.info("Debug composition image saved to %s", debug_path)


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