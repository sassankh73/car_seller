"""
Background removal service using Rembg (U²Net) via HTTP API.

Implements the BackgroundRemover ABC from image_processing.py.
Communicates with the rembg Docker container over HTTP.

Architecture:
- RembgRemover: Calls rembg HTTP API at REMBG_SERVICE_URL
- Graceful fallback: If rembg is unavailable, falls back to MockRemover
- Engine abstraction: BG_REMOVAL_ENGINE env var selects the engine
  Future engines (BRIA, BiRefNet) can be added as new BackgroundRemover implementations
"""

import io
import logging
import os

import httpx
from PIL import Image

from .image_processing import BackgroundRemover, MockRemover

logger = logging.getLogger(__name__)

# Configuration from environment
ENABLE_REMBG = os.getenv("ENABLE_REMBG", "false").lower() == "true"
BG_REMOVAL_ENGINE = os.getenv("BG_REMOVAL_ENGINE", "rembg").lower()
REMBG_SERVICE_URL = os.getenv("REMBG_SERVICE_URL", "http://rembg:7000")

# Timeout settings (seconds)
REMBG_TIMEOUT = int(os.getenv("REMBG_TIMEOUT", "30"))


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

        Sends the image as a POST request to the rembg service.
        Falls back to MockRemover if the service is unavailable.

        Args:
            image: Input PIL Image (any mode)

        Returns:
            RGBA PIL Image with transparent background
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