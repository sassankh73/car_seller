"""
Background removal service using Rembg (U²Net) via HTTP API.

Implements the BackgroundRemover ABC from image_processing.py.
Communicates with the rembg Docker container over HTTP.

Architecture:
- RembgRemover: Calls rembg HTTP API at REMBG_SERVICE_URL
- AlphaMatteRefiner: Post-processes rembg output to remove halos, fringes,
  and preserve thin details (mirrors, antennas, wheel spokes)
- Graceful fallback: If rembg is unavailable, falls back to MockRemover
- Engine abstraction: BG_REMOVAL_ENGINE env var selects the engine
  Future engines (BRIA, BiRefNet) can be added as new BackgroundRemover implementations
"""

import io
import logging
import os

import httpx
import numpy as np
from PIL import Image, ImageFilter

from .image_processing import BackgroundRemover, MockRemover

logger = logging.getLogger(__name__)

# Configuration from environment
ENABLE_REMBG = os.getenv("ENABLE_REMBG", "false").lower() == "true"
BG_REMOVAL_ENGINE = os.getenv("BG_REMOVAL_ENGINE", "rembg").lower()
REMBG_SERVICE_URL = os.getenv("REMBG_SERVICE_URL", "http://rembg:7000")

# Timeout settings (seconds)
REMBG_TIMEOUT = int(os.getenv("REMBG_TIMEOUT", "30"))


# ============================================================================
# Alpha Matte Refiner — Post-processing for vehicle extraction quality
# ============================================================================


class AlphaMatteRefiner:
    """Post-processes rembg output to produce clean vehicle cutouts.

    Solves common rembg artifacts:
    - White halos around vehicle edges (color contamination from original bg)
    - Gray fringes on semi-transparent edge pixels
    - Lost thin details (mirrors, antennas, spoilers, wheel spokes)
    - Jagged alpha edges

    Pipeline:
    1. Alpha matte cleanup — fill small holes, remove noise
    2. Thin detail preservation — morphological closing to bridge gaps
    3. Edge feathering — smooth harsh alpha transitions
    4. Color decontamination — replace contaminated edge RGB with interior color
    """

    def __init__(
        self,
        close_radius: int = 2,
        noise_threshold: int = 100,
        feather_radius: float = 1.5,
        decontamination_width: int = 3,
    ):
        """Initialize the refiner.

        Args:
            close_radius: Radius for morphological closing kernel. Preserves thin
                          structures by bridging small gaps. Default 2.
            noise_threshold: Minimum connected component size (in pixels) to keep.
                             Components smaller than this are removed as noise. Default 100.
            feather_radius: Gaussian blur radius for alpha edge feathering. Default 1.5.
            decontamination_width: How many pixels inward to sample for color
                                   decontamination. Default 3.
        """
        self.close_radius = close_radius
        self.noise_threshold = noise_threshold
        self.feather_radius = feather_radius
        self.decontamination_width = decontamination_width

    def _morphological_close(self, mask: np.ndarray, radius: int) -> np.ndarray:
        """Apply morphological closing using numpy operations.

        Closing = dilation followed by erosion.
        This fills small holes and bridges thin gaps without losing detail.
        """
        # Create a circular structuring element
        y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
        struct = (x * x + y * y) <= radius * radius

        # Pad the mask to handle borders
        padded = np.pad(mask, radius, mode='constant', constant_values=0)

        # Dilation: pixel is 1 if any neighbor under the structuring element is 1
        dilated = np.zeros_like(mask)
        h, w = mask.shape
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if struct[dy + radius, dx + radius]:
                    shifted = padded[radius + dy:radius + dy + h, radius + dx:radius + dx + w]
                    dilated = np.maximum(dilated, shifted)

        # Erosion of dilated result
        padded_d = np.pad(dilated, radius, mode='constant', constant_values=1)
        closed = np.ones_like(mask)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if struct[dy + radius, dx + radius]:
                    shifted = padded_d[radius + dy:radius + dy + h, radius + dx:radius + dx + w]
                    closed = np.minimum(closed, shifted)

        return closed

    def _morphological_dilate(self, mask: np.ndarray, radius: int) -> np.ndarray:
        """Apply morphological dilation using numpy operations."""
        y, x = np.ogrid[-radius:radius + 1, -radius:radius + 1]
        struct = (x * x + y * y) <= radius * radius

        padded = np.pad(mask, radius, mode='constant', constant_values=0)
        dilated = np.zeros_like(mask)
        h, w = mask.shape
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if struct[dy + radius, dx + radius]:
                    shifted = padded[radius + dy:radius + dy + h, radius + dx:radius + dx + w]
                    dilated = np.maximum(dilated, shifted)
        return dilated

    def _remove_small_components(self, mask: np.ndarray, min_size: int) -> np.ndarray:
        """Remove connected components smaller than min_size pixels.

        This removes noise artifacts without affecting the main vehicle shape.
        Uses a simple flood-fill approach.
        """
        if min_size <= 0:
            return mask

        # Label connected components using a simple BFS approach
        h, w = mask.shape
        visited = np.zeros_like(mask, dtype=bool)
        labels = np.zeros_like(mask, dtype=np.int32)
        label_id = 0
        component_sizes = {}

        for y in range(h):
            for x in range(w):
                if mask[y, x] and not visited[y, x]:
                    label_id += 1
                    # BFS flood fill
                    stack = [(y, x)]
                    size = 0
                    while stack:
                        cy, cx = stack.pop()
                        if cy < 0 or cy >= h or cx < 0 or cx >= w:
                            continue
                        if visited[cy, cx] or not mask[cy, cx]:
                            continue
                        visited[cy, cx] = True
                        labels[cy, cx] = label_id
                        size += 1
                        stack.extend([
                            (cy - 1, cx), (cy + 1, cx),
                            (cy, cx - 1), (cy, cx + 1),
                        ])
                    component_sizes[label_id] = size

        # Keep only components larger than min_size
        result = np.zeros_like(mask)
        for lid, size in component_sizes.items():
            if size >= min_size:
                result[labels == lid] = 1

        return result

    def refine_alpha(self, image: Image.Image) -> Image.Image:
        """Step 1: Clean up the alpha matte.

        - Fill small holes in the mask (morphological closing)
        - Remove isolated noise pixels (small component removal)
        - Smooth the alpha channel edges slightly

        Args:
            image: RGBA image from rembg (may have holes/noise in alpha)

        Returns:
            RGBA image with cleaned alpha channel
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        img_array = np.array(image)
        alpha = img_array[:, :, 3].copy()

        # Binary mask for morphological operations
        binary = (alpha > 128).astype(np.uint8)

        # Step 1a: Morphological closing to fill small holes and bridge thin gaps
        # This preserves thin structures (antennas, mirror stalks, wheel spokes)
        # that rembg may have partially cut through
        closed = self._morphological_close(binary, self.close_radius)

        # Step 1b: Remove small noise components (isolated transparent pixels
        # that rembg incorrectly kept)
        # We keep only components larger than the threshold
        cleaned = self._remove_small_components(closed, self.noise_threshold)

        # Step 1c: Create a smooth alpha by combining original alpha with cleaned mask
        # Where the cleaned mask is 0, force alpha to 0 (removed noise)
        # Where the cleaned mask is 1, keep original alpha (preserves AA edges)
        # Where the original was 0 but cleaned is 1, set alpha to a minimum (filled holes)
        new_alpha = np.where(
            cleaned > 0,
            np.maximum(alpha, 128),  # Keep original AA or ensure minimum visibility
            np.where(alpha > 200, 0, alpha * 0)  # Remove noise, keep AA edges near object
        ).astype(np.uint8)

        # Step 1d: Smooth the alpha channel with a gentle Gaussian blur
        # This eliminates jagged pixel-level edges
        alpha_pil = Image.fromarray(new_alpha, mode="L")
        alpha_pil = alpha_pil.filter(ImageFilter.GaussianBlur(radius=self.feather_radius))
        new_alpha = np.array(alpha_pil)

        # Re-threshold: ensure crisp edges by pushing strong pixels to 255,
        # weak pixels to 0, but keeping a soft transition zone
        new_alpha = np.where(
            new_alpha > 200, 255,
            np.where(new_alpha < 30, 0, new_alpha)
        ).astype(np.uint8)

        img_array[:, :, 3] = new_alpha
        return Image.fromarray(img_array, mode="RGBA")

    def preserve_thin_details(self, image: Image.Image) -> Image.Image:
        """Step 2: Preserve thin structures like mirrors, antennas, spoilers.

        Uses morphological closing with a larger kernel specifically targeted
        at re-connecting thin horizontal and vertical structures that rembg
        may have broken.

        Args:
            image: RGBA image (after alpha cleanup)

        Returns:
            RGBA image with thin details preserved
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        img_array = np.array(image)
        alpha = img_array[:, :, 3].copy()

        # Binary mask
        binary = (alpha > 64).astype(np.uint8)

        # Horizontal closing — reconnects thin horizontal structures
        # (mirror stalks, spoiler bridges, roof rails)
        h_kernel_size = 8
        padded = np.pad(binary, ((0, 0), (h_kernel_size, h_kernel_size)), mode='constant')
        h_dilated = np.zeros_like(binary)
        h, w = binary.shape
        for dx in range(-h_kernel_size, h_kernel_size + 1):
            shifted = padded[:, h_kernel_size + dx:h_kernel_size + dx + w]
            h_dilated = np.maximum(h_dilated, shifted)
        # Erode back
        padded_d = np.pad(h_dilated, ((0, 0), (h_kernel_size, h_kernel_size)), mode='constant', constant_values=1)
        h_closed = np.ones_like(binary)
        for dx in range(-h_kernel_size, h_kernel_size + 1):
            shifted = padded_d[:, h_kernel_size + dx:h_kernel_size + dx + w]
            h_closed = np.minimum(h_closed, shifted)

        # Vertical closing — reconnects thin vertical structures
        # (antennas, door pillars, flag poles)
        v_kernel_size = 3
        padded = np.pad(binary, ((v_kernel_size, v_kernel_size), (0, 0)), mode='constant')
        v_dilated = np.zeros_like(binary)
        for dy in range(-v_kernel_size, v_kernel_size + 1):
            shifted = padded[v_kernel_size + dy:v_kernel_size + dy + h, :]
            v_dilated = np.maximum(v_dilated, shifted)
        padded_d = np.pad(v_dilated, ((v_kernel_size, v_kernel_size), (0, 0)), mode='constant', constant_values=1)
        v_closed = np.ones_like(binary)
        for dy in range(-v_kernel_size, v_kernel_size + 1):
            shifted = padded_d[v_kernel_size + dy:v_kernel_size + dy + h, :]
            v_closed = np.minimum(v_closed, shifted)

        # Combine: a pixel is foreground if it was foreground in original OR
        # in either directional close (recovering thin details)
        combined = np.maximum(np.maximum(binary, h_closed), v_closed).astype(np.uint8)

        # Update alpha: where combined mask is 1, ensure minimum alpha
        new_alpha = np.where(
            combined > 0,
            np.maximum(alpha, 180),  # Ensure thin details are visible
            np.minimum(alpha, 30)     # Remove noise near thin structures
        ).astype(np.uint8)

        img_array[:, :, 3] = new_alpha
        return Image.fromarray(img_array, mode="RGBA")

    def feather_edges(self, image: Image.Image) -> Image.Image:
        """Step 3: Feather alpha edges for smooth transitions.

        Creates a 1-3px soft transition zone at the boundary of the object,
        eliminating the "sticker" look of hard pixel edges.

        Args:
            image: RGBA image (after alpha cleanup and thin detail preservation)

        Returns:
            RGBA image with feathered edges
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        img_array = np.array(image)
        alpha = img_array[:, :, 3].copy().astype(np.float32)

        # Apply a gentle Gaussian blur to the alpha channel
        # This creates a smooth transition at edges
        alpha_pil = Image.fromarray(alpha.astype(np.uint8), mode="L")
        alpha_blurred = alpha_pil.filter(ImageFilter.GaussianBlur(radius=1.0))
        alpha_blurred_arr = np.array(alpha_blurred).astype(np.float32)

        # Blend: keep interior alpha values, only feather the transition zone
        # Transition zone: pixels where original alpha is between 30 and 225
        transition_mask = (alpha > 30) & (alpha < 225)

        # In transition zones, use the blurred alpha for smoother edges
        # In solid zones (alpha >= 225), keep original
        # In transparent zones (alpha <= 30), keep original
        new_alpha = np.where(
            transition_mask,
            np.maximum(alpha, alpha_blurred_arr),  # Use blurred for softer edges
            alpha
        ).astype(np.uint8)

        img_array[:, :, 3] = new_alpha
        return Image.fromarray(img_array, mode="RGBA")

    def decontaminate_colors(self, image: Image.Image) -> Image.Image:
        """Step 4: Remove color contamination at edges (white/gray halos and fringes).

        Semi-transparent edge pixels often contain color from the original background
        (white, gray, etc.) which creates visible halos and fringes when composited
        onto a new background. This method replaces those contaminated colors with
        the nearest interior (opaque) color.

        Args:
            image: RGBA image (after alpha cleanup, thin detail preservation, feathering)

        Returns:
            RGBA image with decontaminated edge colors
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")

        img_array = np.array(image, dtype=np.float32)
        alpha = img_array[:, :, 3].copy()

        # Identify edge pixels: semi-transparent or near-edge
        # These are the pixels most likely to have background color contamination
        edge_mask = (alpha > 10) & (alpha < 240)

        if not edge_mask.any():
            # No edges to decontaminate
            return image

        h, w = alpha.shape

        # Create a distance map from the nearest fully opaque pixel
        # For each semi-transparent pixel, find the color of the nearest opaque pixel
        opaque_mask = alpha >= 240

        if not opaque_mask.any():
            # No opaque pixels — can't decontaminate
            return image

        # Dilate the opaque region inward to get "interior color" samples
        # This gives us the true vehicle color at each edge pixel
        # Use a simple approach: for each edge pixel, look inward for the nearest opaque pixel
        # We do this by creating a "nearest opaque color" map

        # Create RGB arrays
        rgb = img_array[:, :, :3].copy()

        # For decontamination, we replace the edge pixel RGB with a blend of
        # its current color and the nearest interior (opaque) color
        # Step 1: Dilate the opaque region by decontamination_width pixels
        dilated_opaque = opaque_mask.astype(np.uint8)

        # Simple iterative dilation for finding interior colors
        for _ in range(self.decontamination_width):
            padded = np.pad(dilated_opaque, 1, mode='constant', constant_values=0)
            new_dilated = np.zeros_like(dilated_opaque)
            h_inner, w_inner = dilated_opaque.shape
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    shifted = padded[1 + dy:1 + dy + h_inner, 1 + dx:1 + dx + w_inner]
                    new_dilated = np.maximum(new_dilated, shifted)
            dilated_opaque = new_dilated

        dilated_opaque = dilated_opaque.astype(bool)

        # Create a reference color image by replacing non-opaque pixels with
        # their nearest opaque neighbor's color using a simple averaging approach
        # Start with the opaque pixels
        reference_rgb = np.zeros_like(rgb)
        reference_count = np.zeros((h, w), dtype=np.float32)

        # For each pixel, accumulate color from nearby opaque pixels
        # Use a small window for efficiency
        window = self.decontamination_width + 2
        for dy in range(-window, window + 1):
            for dx in range(-window, window + 1):
                # Shifted opaque mask
                shifted_opaque = np.roll(np.roll(opaque_mask, dy, axis=0), dx, axis=1)
                shifted_rgb = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)

                # Zero out invalid rolls
                if dy > 0:
                    shifted_opaque[:dy, :] = False
                elif dy < 0:
                    shifted_opaque[dy:, :] = False
                if dx > 0:
                    shifted_opaque[:, :dx] = False
                elif dx < 0:
                    shifted_opaque[:, dx:] = False

                # Accumulate color from opaque neighbors
                mask = shifted_opaque & ~opaque_mask  # Only update non-opaque pixels
                for c in range(3):
                    reference_rgb[:, :, c] += np.where(mask, shifted_rgb[:, :, c], 0)
                reference_count += mask.astype(np.float32)

        # Average the accumulated colors
        valid = reference_count > 0
        for c in range(3):
            reference_rgb[:, :, c] = np.where(
                valid,
                reference_rgb[:, :, c] / reference_count,
                rgb[:, :, c]
            )

        # For opaque pixels, keep their original color
        reference_rgb = np.where(
            opaque_mask[:, :, np.newaxis],
            rgb,
            reference_rgb
        )

        # Step 2: Blend edge pixel colors toward the interior reference color
        # The blending factor is proportional to how transparent the pixel is
        # More transparent = more contamination = stronger correction
        alpha_float = alpha / 255.0
        # Correction strength: 0 for fully opaque, 1 for very transparent
        correction_strength = np.where(
            edge_mask,
            1.0 - alpha_float,
            0.0
        )

        # Reduce correction strength to avoid over-correction
        correction_strength = correction_strength * 0.85

        # Apply correction
        for c in range(3):
            img_array[:, :, c] = np.where(
                edge_mask,
                rgb[:, :, c] * (1 - correction_strength) + reference_rgb[:, :, c] * correction_strength,
                rgb[:, :, c]
            )

        # Clip to valid range
        img_array[:, :, :3] = np.clip(img_array[:, :, :3], 0, 255)
        img_array[:, :, 3] = alpha.astype(np.uint8)

        result = Image.fromarray(img_array.astype(np.uint8), mode="RGBA")

        # Final pass: ensure alpha >= decontaminated pixels are properly opaque
        # at edges so there's no remaining fringe
        result_array = np.array(result)
        final_alpha = result_array[:, :, 3].copy()
        # Boost edge alpha slightly to ensure clean edges
        final_alpha = np.where(
            (final_alpha > 100) & (final_alpha < 240),
            np.minimum(final_alpha + 20, 255),
            final_alpha
        ).astype(np.uint8)
        result_array[:, :, 3] = final_alpha

        return Image.fromarray(result_array, mode="RGBA")

    def _suppress_ground_shadow(self, image: Image.Image) -> Image.Image:
        """Step 0 (pre-process): Remove ground contact shadows from bottom of mask.

        In the bottom 20% of the image, semi-transparent pixels (alpha 30–180) are
        ground shadows. Fully opaque pixels (alpha > 200) are tires/bumpers — kept.
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        img_array = np.array(image)
        alpha = img_array[:, :, 3].copy()
        h = alpha.shape[0]
        shadow_zone_top = int(h * 0.80)
        shadow_zone = alpha[shadow_zone_top:, :]
        shadow_zone = np.where(
            (shadow_zone > 30) & (shadow_zone < 180),
            0,
            shadow_zone,
        )
        alpha[shadow_zone_top:, :] = shadow_zone
        img_array[:, :, 3] = alpha
        return Image.fromarray(img_array, mode="RGBA")

    def refine(self, image: Image.Image) -> Image.Image:
        """Apply the full refinement pipeline to a rembg output image.

        Pipeline order:
        0. Ground shadow suppression (remove floor contact shadows)
        1. Alpha matte cleanup (fill holes, remove noise)
        2. Thin detail preservation (reconnect broken structures)
        3. Edge feathering (smooth transitions)
        4. Color decontamination (remove halos and fringes)

        Args:
            image: RGBA image from rembg with transparent background

        Returns:
            Refined RGBA image with clean edges, no halos, and preserved details
        """
        logger.info("AlphaMatteRefiner: Starting refinement pipeline")
        logger.debug("  Input: mode=%s, size=%s", image.mode, image.size)

        # Step 0: Ground shadow suppression
        result = self._suppress_ground_shadow(image)
        logger.debug("  After shadow suppression: size=%s", result.size)

        # Step 1: Alpha matte cleanup
        result = self.refine_alpha(result)
        logger.debug("  After alpha cleanup: size=%s", result.size)

        # Step 2: Thin detail preservation
        result = self.preserve_thin_details(result)
        logger.debug("  After thin detail preservation: size=%s", result.size)

        # Step 3: Edge feathering
        result = self.feather_edges(result)
        logger.debug("  After edge feathering: size=%s", result.size)

        # Step 4: Color decontamination
        result = self.decontaminate_colors(result)
        logger.debug("  After color decontamination: size=%s", result.size)

        logger.info("AlphaMatteRefiner: Refinement pipeline complete")
        return result


# ============================================================================
# RembgRemover — Background removal via HTTP API
# ============================================================================


class RembgRemover(BackgroundRemover):
    """
    Background removal using the Rembg HTTP API service.

    Sends image to the rembg Docker container via HTTP POST.
    Returns RGBA image with transparent background.

    Rembg uses U²Net model for salient object detection.
    Well-suited for automotive photography: good edge detection,
    handles complex shapes like mirrors and wheels.
    """

    def __init__(self, service_url: str = REMBG_SERVICE_URL, timeout: int = REMBG_TIMEOUT):
        self.service_url = service_url.rstrip("/")
        self.timeout = timeout
        self._available = None  # Lazy health check
        self._refiner = AlphaMatteRefiner(
            close_radius=3,
            noise_threshold=150,
            feather_radius=2.0,
            decontamination_width=5,
        )

    def _check_availability(self) -> bool:
        """Check if the rembg service is reachable."""
        try:
            with httpx.Client(timeout=5) as client:
                response = client.get(f"{self.service_url}/")
                # Rembg returns 200 or 405 for root, either means it's alive
                self._available = response.status_code in (200, 405, 404)
                if self._available:
                    logger.info("Rembg service is available at %s", self.service_url)
                return self._available
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.warning("Rembg service unavailable at %s: %s", self.service_url, e)
            self._available = False
            return False

    def remove_background(self, image: Image.Image) -> Image.Image:
        """
        Remove background using the Rembg HTTP API.

        Sends the image as a POST request to the rembg service,
        then applies AlphaMatteRefiner to clean up edges and halos.
        Falls back to MockRemover if the service is unavailable.

        Args:
            image: Input PIL Image (any mode)

        Returns:
            RGBA PIL Image with transparent background, refined edges,
            decontaminated colors, and preserved thin details.
        """
        # Lazy availability check
        if self._available is None:
            self._check_availability()

        if not self._available:
            logger.warning("Rembg service not available, falling back to MockRemover")
            return MockRemover().remove_background(image)

        try:
            # Convert image to PNG bytes
            img_buffer = io.BytesIO()
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(img_buffer, format="PNG", quality=95)
            img_buffer.seek(0)

            # Call rembg HTTP API
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    f"{self.service_url}/api/remove",
                    files={"file": ("image.png", img_buffer, "image/png")},
                )

            if response.status_code == 200:
                # Parse the returned PNG (with transparent background)
                result_image = Image.open(io.BytesIO(response.content))
                if result_image.mode != "RGBA":
                    result_image = result_image.convert("RGBA")
                logger.info("Rembg background removal successful")

                # Apply AlphaMatteRefiner to clean up edges, halos, fringes
                result_image = self._refiner.refine(result_image)

                return result_image
            else:
                logger.warning(
                    "Rembg returned status %d, falling back to MockRemover",
                    response.status_code,
                )
                self._available = False
                return MockRemover().remove_background(image)

        except httpx.ConnectError as e:
            logger.warning("Rembg connection failed: %s, falling back to MockRemover", e)
            self._available = False
            return MockRemover().remove_background(image)

        except httpx.TimeoutException as e:
            logger.warning("Rembg timeout: %s, falling back to MockRemover", e)
            self._available = False
            return MockRemover().remove_background(image)

        except Exception as e:
            logger.warning(
                "Rembg unexpected error: %s, falling back to MockRemover", e
            )
            self._available = False
            return MockRemover().remove_background(image)


def get_background_remover() -> BackgroundRemover:
    """
    Factory function to get the configured BackgroundRemover implementation.

    Reads BG_REMOVAL_ENGINE and ENABLE_REMBG from environment.
    Falls back to MockRemover if:
    - ENABLE_REMBG is false
    - Configured engine is unavailable
    - Any error occurs during initialization

    Future engines can be added here:
    - BG_REMOVAL_ENGINE=bria -> BriaRemover
    - BG_REMOVAL_ENGINE=birefnet -> BiRefNetRemover
    - BG_REMOVAL_ENGINE=rembg -> RembgRemover (current default)

    Returns:
        BackgroundRemover instance
    """
    if not ENABLE_REMBG:
        logger.info("Background removal disabled (ENABLE_REMBG=false), using MockRemover")
        return MockRemover()

    engine = BG_REMOVAL_ENGINE

    if engine == "rembg":
        try:
            remover = RembgRemover()
            # Quick health check — if rembg is down, fall back immediately
            if remover._check_availability():
                logger.info("Using RembgRemover (engine=%s, url=%s)", engine, REMBG_SERVICE_URL)
                return remover
            else:
                logger.warning("Rembg service unavailable, falling back to MockRemover")
                return MockRemover()
        except Exception as e:
            logger.warning("Failed to initialize RembgRemover: %s, falling back to MockRemover", e)
            return MockRemover()

    # Future: Add BRIA engine
    # elif engine == "bria":
    #     try:
    #         return BriaRemover(BRIA_SERVICE_URL)
    #     except Exception:
    #         logger.warning("BRIA unavailable, falling back to MockRemover")
    #         return MockRemover()

    # Future: Add BiRefNet engine
    # elif engine == "birefnet":
    #     try:
    #         return BiRefNetRemover(BIREFNET_SERVICE_URL)
    #     except Exception:
    #         logger.warning("BiRefNet unavailable, falling back to MockRemover")
    #         return MockRemover()

    else:
        logger.warning(
            "Unknown BG_REMOVAL_ENGINE '%s', falling back to MockRemover", engine
        )
        return MockRemover()