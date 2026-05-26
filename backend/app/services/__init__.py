# Image processing services for AutoStudio AI
from .image_processing import (
    AICompositingService,
    BackgroundRemover,
    LightingCorrector,
    MockRemover,
    PaintReflectionEnhancer,
    PerspectiveCorrector,
    ReflectionGenerator,
    RemoveBGRemover,
    ShadowGenerator,
    WheelPreserver,
    get_compositing_service,
)

__all__ = [
    "AICompositingService",
    "BackgroundRemover",
    "RemoveBGRemover",
    "MockRemover",
    "ShadowGenerator",
    "ReflectionGenerator",
    "LightingCorrector",
    "PerspectiveCorrector",
    "WheelPreserver",
    "PaintReflectionEnhancer",
    "get_compositing_service",
]
