#!/usr/bin/env python3
"""Generate a contact sheet showing all 8 studio backgrounds side-by-side."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

STUDIOS_DIR = Path(__file__).parent / "app" / "static" / "studios"
OUTPUT_PATH = Path(__file__).parent / "studio_contact_sheet.png"

# Studio keys in order
STUDIO_KEYS = [
    "white_corner_light_epoxy",
    "white_corner_ceramic_tile",
    "light_gray_corner_medium_epoxy",
    "dark_gray_corner_concrete",
    "black_corner_dark_epoxy",
    "commercial_showroom_tile",
    "industrial_concrete",
    "matte_black_automotive",
]

STUDIO_LABELS = [
    "1. White Corner + Light Gray Epoxy",
    "2. White Corner + Ceramic Tile",
    "3. Light Gray Corner + Medium Epoxy",
    "4. Dark Gray Corner + Concrete",
    "5. Black Corner + Dark Epoxy",
    "6. Commercial Showroom + Tile",
    "7. Industrial + Concrete",
    "8. Matte Black Automotive",
]

# Layout: 4 columns × 2 rows
COLS = 4
ROWS = 2
THUMB_W = 480
THUMB_H = 270  # 16:9 aspect
LABEL_H = 30
PADDING = 10
MARGIN = 20


def main():
    # Calculate canvas size
    grid_w = COLS * THUMB_W + (COLS - 1) * PADDING
    grid_h = ROWS * (THUMB_H + LABEL_H) + (ROWS - 1) * PADDING
    canvas_w = grid_w + 2 * MARGIN
    canvas_h = grid_h + 2 * MARGIN + 40  # Extra for title

    # Create canvas
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#1a1a1a")
    draw = ImageDraw.Draw(canvas)

    # Try to get a font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 16)
            title_font = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 22)
        except (IOError, OSError):
            font = ImageFont.load_default()
            title_font = ImageFont.load_default()

    # Draw title
    draw.text((MARGIN, 8), "AutoStudio — Corner Studio Contact Sheet", fill="#ffffff", font=title_font)

    y_start = MARGIN + 35

    for idx, (key, label) in enumerate(zip(STUDIO_KEYS, STUDIO_LABELS)):
        col = idx % COLS
        row = idx // COLS

        x = MARGIN + col * (THUMB_W + PADDING)
        y = y_start + row * (THUMB_H + LABEL_H + PADDING)

        # Load studio image
        img_path = STUDIOS_DIR / f"{key}.png"
        if not img_path.exists():
            print(f"WARNING: {img_path} not found, skipping")
            continue

        img = Image.open(img_path).convert("RGB")
        img = img.resize((THUMB_W, THUMB_H), Image.LANCZOS)

        # Paste onto canvas
        canvas.paste(img, (x, y))

        # Draw border around thumbnail
        draw.rectangle([x - 1, y - 1, x + THUMB_W, y + THUMB_H], outline="#555555", width=1)

        # Draw label below thumbnail
        draw.text((x + 4, y + THUMB_H + 6), label, fill="#cccccc", font=font)

    # Save
    canvas.save(str(OUTPUT_PATH), "PNG", quality=95)
    print(f"Contact sheet saved to: {OUTPUT_PATH}")
    print(f"Size: {canvas_w}x{canvas_h}")


if __name__ == "__main__":
    main()