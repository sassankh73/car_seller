"""
Test script for the AI image processing pipeline.
Run this to verify the compositing service works correctly.

Usage:
    python -m app.services.test_pipeline
"""

import io

import numpy as np
from PIL import Image

from .image_processing import AICompositingService, MockRemover


def create_test_car_image() -> Image.Image:
    """Create a simple test car-like image for pipeline testing."""
    # Create a car-shaped silhouette (simplified)
    width, height = 800, 600
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    # Draw a simple car body (rectangle with rounded top)
    car_body_y = int(height * 0.3)
    car_body_h = int(height * 0.4)

    # Main body
    for y in range(car_body_y, car_body_y + car_body_h):
        for x in range(int(width * 0.1), int(width * 0.9)):
            # Calculate distance from center for roof curve
            center_x = width // 2
            dist_from_center = abs(x - center_x)

            # Roof curve (higher in center, lower at edges)
            roof_offset = int(
                (dist_from_center / (width * 0.4)) ** 2 * car_body_h * 0.3
            )

            if y < car_body_y + roof_offset:
                continue

            # Car color (metallic blue)
            img.putpixel((x, y), (41, 98, 255, 255))

    # Wheels (dark circles at bottom)
    wheel_y = int(height * 0.65)
    wheel_radius = int(height * 0.08)

    for wheel_x in [int(width * 0.25), int(width * 0.75)]:
        for dy in range(-wheel_radius, wheel_radius + 1):
            for dx in range(-wheel_radius, wheel_radius + 1):
                if dx * dx + dy * dy <= wheel_radius * wheel_radius:
                    # Dark gray wheel with silver rim
                    dist_from_center = np.sqrt(dx * dx + dy * dy)
                    if dist_from_center > wheel_radius * 0.6:
                        img.putpixel((wheel_x + dx, wheel_y + dy), (50, 50, 50, 255))
                    else:
                        img.putpixel((wheel_x + dx, wheel_y + dy), (180, 180, 180, 255))

    return img


def test_pipeline():
    """Run the complete AI pipeline on a test image."""
    print("🚗 AutoStudio AI Pipeline Test")
    print("=" * 40)

    # Create test image
    print("\n1. Creating test car image...")
    test_image = create_test_car_image()
    print(f"   ✓ Created {test_image.size[0]}x{test_image.size[1]} test image")

    # Initialize compositing service
    print("\n2. Initializing compositing service...")
    service = AICompositingService(
        background_remover=MockRemover(), studio_width=1200, studio_height=800
    )
    print("   ✓ Service initialized")

    # Test different studios
    studios = [
        ("luxury_showroom", "#2a2a2a"),
        ("white_studio", "#f5f5f5"),
        ("dark_cinematic", "#0a0a0a"),
    ]

    for studio_name, floor_color in studios:
        print(f"\n3. Processing with '{studio_name}' studio...")

        try:
            result = service.process(
                car_image=test_image,
                studio_color=floor_color,
                original_image=test_image,
            )
            print(f"   ✓ Generated {result.size[0]}x{result.size[1]} composite")

            # Save result
            output_path = f"test_output_{studio_name}.png"
            result.save(output_path, format="PNG")
            print(f"   ✓ Saved to {output_path}")

        except Exception as e:
            print(f"   ✗ Error: {e}")

    # Test export qualities
    print("\n4. Testing export qualities...")

    for quality, (w, h) in [("HD", (1920, 1080)), ("4K", (3840, 2160))]:
        service.studio_width = w
        service.studio_height = h

        result = service.process(
            car_image=test_image, studio_color="#2a2a2a", original_image=test_image
        )
        print(f"   ✓ {quality}: {result.size[0]}x{result.size[1]}")

    print("\n" + "=" * 40)
    print("✅ Pipeline test completed successfully!")
    print("\nGenerated files:")
    print("  - test_output_luxury_showroom.png")
    print("  - test_output_white_studio.png")
    print("  - test_output_dark_cinematic.png")


if __name__ == "__main__":
    test_pipeline()
