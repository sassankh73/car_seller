#!/usr/bin/env python3
"""Generate automotive corner studio backgrounds with 3D perspective.

Each studio is a realistic 3D corner room with:
- Visible rear wall, left wall, right wall, ceiling, floor
- Sharp 90° corners (no cyclorama, no curved transitions)
- Deep room perspective with natural vanishing point
- Eye-level camera with slight downward tilt
- Commercial showroom lighting with ceiling light strips

8 Unique Studios:
1. white_corner_light_epoxy      - White corner + light gray epoxy floor
2. white_corner_ceramic_tile     - White corner + ceramic tile floor
3. light_gray_corner_medium_epoxy - Light gray corner + medium gray epoxy
4. dark_gray_corner_concrete     - Dark gray corner + concrete floor
5. black_corner_dark_epoxy       - Black corner + dark epoxy floor
6. commercial_showroom_tile      - Commercial showroom + tile floor
7. industrial_concrete           - Industrial dark + concrete floor
8. matte_black_automotive        - Matte black + matte black epoxy
"""

import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Output directory
STUDIOS_DIR = Path(__file__).parent / "app" / "static" / "studios"

# Canvas size for full-res studios (4K ultra-high resolution)
WIDTH = 3840
HEIGHT = 2160

# Large value for "no intersection"
NO_HIT = 1e18


def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to (R, G, B) tuple."""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def generate_corner_studio(
    name: str,
    rear_wall_color: str,
    left_wall_color: str,
    right_wall_color: str,
    ceiling_color: str,
    floor_color: str,
    room_width: float = 16.0,
    room_height: float = 4.0,
    room_depth: float = 10.0,
    camera_height: float = 0.55,
    camera_pitch_deg: float = -7.0,
    fov_h_deg: float = 90.0,
    floor_type: str = "epoxy",
    epoxy_tint: str = "#000000",
    epoxy_tint_strength: float = 0.02,
    tile_size: float = 0.6,
    grout_color: str = "#888888",
    grout_width: float = 0.012,
    concrete_noise_strength: float = 0.04,
    ceiling_light_strips: bool = True,
    light_strip_brightness: float = 0.12,
    light_strip_spacing: float = 2.0,
    light_strip_width: float = 0.15,
) -> Image.Image:
    """Generate a 3D corner studio background with perspective depth.

    Renders a rectangular room from inside using ray-plane intersections.
    Camera is positioned at eye height with a slight downward tilt to maximize
    floor visibility (~60% floor, ~30% walls, ~10% ceiling).

    All corners are sharp 90° — no cyclorama, no curved transitions.

    Args:
        name: Studio identifier (for logging)
        rear_wall_color: Hex color for the rear wall (facing camera)
        left_wall_color: Hex color for the left wall
        right_wall_color: Hex color for the right wall
        ceiling_color: Hex color for the ceiling
        floor_color: Hex color for the floor base
        room_width: Room width in meters
        room_height: Room height in meters
        room_depth: Room depth in meters (camera to back wall)
        camera_height: Camera height in meters from floor
        camera_pitch_deg: Camera pitch in degrees (negative = looking down)
        fov_h_deg: Horizontal field of view in degrees
        floor_type: "epoxy", "tile", or "concrete"
        epoxy_tint: Subtle tint for epoxy floor depth effect
        epoxy_tint_strength: Strength of epoxy tint (0.0-0.05)
        tile_size: Tile size in meters
        grout_color: Hex color for tile grout lines
        grout_width: Grout line width in meters
        concrete_noise_strength: Noise variation for concrete (0.0-0.1)
        ceiling_light_strips: Whether to add light strips on ceiling
        light_strip_brightness: How much brighter light strips are (0.0-0.3)
        light_strip_spacing: Spacing between light strips in meters
        light_strip_width: Light strip width in meters

    Returns:
        PIL Image (RGBA) 1920x1080
    """
    half_w = room_width / 2.0

    # ── Camera Setup ──
    pitch_rad = np.radians(camera_pitch_deg)
    cos_p = np.cos(pitch_rad)
    sin_p = np.sin(pitch_rad)

    half_fov = np.radians(fov_h_deg / 2.0)
    focal = (WIDTH / 2.0) / np.tan(half_fov)

    # ── Pixel Coordinate Grids ──
    px = np.arange(WIDTH, dtype=np.float64)
    py = np.arange(HEIGHT, dtype=np.float64)
    px_g, py_g = np.meshgrid(px, py)

    # Camera-space ray directions
    cam_dx = (px_g + 0.5 - WIDTH / 2.0) / focal
    cam_dy = (HEIGHT / 2.0 - py_g - 0.5) / focal

    # Apply pitch rotation around X axis
    # R_x(θ) applied to (cam_dx, cam_dy, -1):
    #   ray_dx = cam_dx
    #   ray_dy = cam_dy * cos(θ) + sin(θ)
    #   ray_dz = cam_dy * sin(θ) - cos(θ)
    ray_dx = cam_dx
    ray_dy = cam_dy * cos_p + sin_p
    ray_dz = cam_dy * sin_p - cos_p

    # ── Surface Intersections ──
    # Floor (y=0)
    t_floor = np.where(ray_dy < 0, -camera_height / ray_dy, NO_HIT)
    # Ceiling (y=room_height)
    t_ceil = np.where(ray_dy > 0, (room_height - camera_height) / ray_dy, NO_HIT)
    # Left wall (x=-half_w)
    t_left = np.where(ray_dx < 0, -half_w / ray_dx, NO_HIT)
    # Right wall (x=half_w)
    t_right = np.where(ray_dx > 0, half_w / ray_dx, NO_HIT)
    # Back wall (z=-room_depth)
    t_back = np.where(ray_dz < 0, -room_depth / ray_dz, NO_HIT)

    # ── Hit Points for Bounds Validation ──
    eps = 0.001

    # Floor hit
    hx_f = t_floor * ray_dx
    hz_f = t_floor * ray_dz
    valid_floor = (np.abs(hx_f) <= half_w + eps) & (hz_f >= -room_depth - eps) & (hz_f <= eps)
    t_floor = np.where(valid_floor, t_floor, NO_HIT)

    # Ceiling hit
    hx_c = t_ceil * ray_dx
    hz_c = t_ceil * ray_dz
    valid_ceil = (np.abs(hx_c) <= half_w + eps) & (hz_c >= -room_depth - eps) & (hz_c <= eps)
    t_ceil = np.where(valid_ceil, t_ceil, NO_HIT)

    # Left wall hit
    hy_l = camera_height + t_left * ray_dy
    hz_l = t_left * ray_dz
    valid_left = (hy_l >= -eps) & (hy_l <= room_height + eps) & (hz_l >= -room_depth - eps) & (hz_l <= eps)
    t_left = np.where(valid_left, t_left, NO_HIT)

    # Right wall hit
    hy_r = camera_height + t_right * ray_dy
    hz_r = t_right * ray_dz
    valid_right = (hy_r >= -eps) & (hy_r <= room_height + eps) & (hz_r >= -room_depth - eps) & (hz_r <= eps)
    t_right = np.where(valid_right, t_right, NO_HIT)

    # Back wall hit
    hx_b = t_back * ray_dx
    hy_b = camera_height + t_back * ray_dy
    valid_back = (np.abs(hx_b) <= half_w + eps) & (hy_b >= -eps) & (hy_b <= room_height + eps)
    t_back = np.where(valid_back, t_back, NO_HIT)

    # ── Find Closest Surface ──
    t_all = np.stack([t_floor, t_ceil, t_left, t_right, t_back], axis=-1)
    surface_id = np.argmin(t_all, axis=-1)  # 0=floor, 1=ceil, 2=left, 3=right, 4=back
    t_min = np.min(t_all, axis=-1)

    # Final hit points (world coordinates)
    hit_x = t_min * ray_dx
    hit_y = camera_height + t_min * ray_dy
    hit_z = t_min * ray_dz

    # Distance from camera for shading
    dist = np.sqrt(hit_x ** 2 + (hit_y - camera_height) ** 2 + hit_z ** 2)

    # ── Surface Masks ──
    is_floor = surface_id == 0
    is_ceil = surface_id == 1
    is_left = surface_id == 2
    is_right = surface_id == 3
    is_back = surface_id == 4

    # ── Shading Calculations ──

    # Distance attenuation (subtle darkening with distance)
    dist_shade = 1.0 / (1.0 + 0.004 * dist)

    # Wall vertical gradient (overhead lighting: brighter in middle, darker at top/bottom)
    wall_y_ratio = np.clip(hit_y / room_height, 0.0, 1.0)
    wall_shade = 0.93 + 0.07 * np.sin(np.pi * wall_y_ratio)

    # Floor depth gradient (lighter near camera, darker near back wall)
    floor_depth_ratio = np.clip(-hit_z / room_depth, 0.0, 1.0)
    floor_shade = 1.0 - 0.08 * floor_depth_ratio

    # Corner ambient occlusion
    ao = np.ones((HEIGHT, WIDTH), dtype=np.float64)

    # Floor near walls
    floor_dist_left = hit_x + half_w
    floor_dist_right = half_w - hit_x
    floor_dist_back = hit_z + room_depth
    floor_min_wall = np.minimum(np.minimum(floor_dist_left, floor_dist_right), floor_dist_back)
    ao = np.where(is_floor, 1.0 - 0.10 * np.exp(-floor_min_wall / 0.25), ao)

    # Left wall near corners
    left_ao = (1.0 - 0.08 * np.exp(-(hit_z + room_depth) / 0.25)) * \
              (1.0 - 0.05 * np.exp(-hit_y / 0.2)) * \
              (1.0 - 0.05 * np.exp(-(room_height - hit_y) / 0.2))
    ao = np.where(is_left, left_ao, ao)

    # Right wall near corners
    right_ao = (1.0 - 0.08 * np.exp(-(hit_z + room_depth) / 0.25)) * \
               (1.0 - 0.05 * np.exp(-hit_y / 0.2)) * \
               (1.0 - 0.05 * np.exp(-(room_height - hit_y) / 0.2))
    ao = np.where(is_right, right_ao, ao)

    # Back wall near side walls, floor, ceiling
    back_dist_side = np.minimum(hit_x + half_w, half_w - hit_x)
    back_ao = (1.0 - 0.08 * np.exp(-back_dist_side / 0.25)) * \
              (1.0 - 0.05 * np.exp(-hit_y / 0.2)) * \
              (1.0 - 0.05 * np.exp(-(room_height - hit_y) / 0.2))
    ao = np.where(is_back, back_ao, ao)

    # Ceiling near walls
    ceil_dist_left = hit_x + half_w
    ceil_dist_right = half_w - hit_x
    ceil_dist_back = hit_z + room_depth
    ceil_min_wall = np.minimum(np.minimum(ceil_dist_left, ceil_dist_right), ceil_dist_back)
    ao = np.where(is_ceil, 1.0 - 0.06 * np.exp(-ceil_min_wall / 0.3), ao)

    # ── Build Image ──
    canvas = np.zeros((HEIGHT, WIDTH, 4), dtype=np.float64)

    floor_rgb = np.array(hex_to_rgb(floor_color), dtype=np.float64)
    rear_rgb = np.array(hex_to_rgb(rear_wall_color), dtype=np.float64)
    left_rgb = np.array(hex_to_rgb(left_wall_color), dtype=np.float64)
    right_rgb = np.array(hex_to_rgb(right_wall_color), dtype=np.float64)
    ceil_rgb = np.array(hex_to_rgb(ceiling_color), dtype=np.float64)

    for c in range(3):
        canvas[:, :, c] = np.where(
            is_floor, floor_rgb[c] * floor_shade * dist_shade * ao, canvas[:, :, c]
        )
        canvas[:, :, c] = np.where(
            is_ceil, ceil_rgb[c] * dist_shade * ao, canvas[:, :, c]
        )
        canvas[:, :, c] = np.where(
            is_left, left_rgb[c] * wall_shade * dist_shade * ao, canvas[:, :, c]
        )
        canvas[:, :, c] = np.where(
            is_right, right_rgb[c] * wall_shade * dist_shade * ao, canvas[:, :, c]
        )
        canvas[:, :, c] = np.where(
            is_back, rear_rgb[c] * wall_shade * dist_shade * ao, canvas[:, :, c]
        )

    canvas[:, :, 3] = 255.0

    # ── Ceiling Light Strips ──
    if ceiling_light_strips:
        # Light strips run across the ceiling width at regular depth intervals
        strip_phase = np.mod(-hit_z, light_strip_spacing)  # 0 to spacing
        strip_center = light_strip_spacing / 2.0
        in_strip = np.abs(strip_phase - strip_center) < (light_strip_width / 2.0)

        # Also add a subtle bright line reflected on the floor below each strip
        # (NOT a reflection — just a subtle illumination gradient on the floor)
        floor_strip_phase = np.mod(-hit_z + light_strip_spacing / 2.0, light_strip_spacing)
        floor_strip_center = light_strip_spacing / 2.0
        floor_under_strip = np.abs(floor_strip_phase - floor_strip_center) < (light_strip_width * 3.0 / 2.0)
        floor_strip_glow = 0.02 * np.exp(-np.abs(floor_strip_phase - floor_strip_center) / (light_strip_width * 2.0))

        for c in range(3):
            # Ceiling strips
            bright = np.minimum(255.0, canvas[:, :, c] * (1.0 + light_strip_brightness))
            canvas[:, :, c] = np.where(is_ceil & in_strip, bright, canvas[:, :, c])
            # Subtle floor illumination under strips
            canvas[:, :, c] = np.where(
                is_floor & floor_under_strip,
                np.minimum(255.0, canvas[:, :, c] * (1.0 + floor_strip_glow)),
                canvas[:, :, c],
            )

    # ── Floor-Specific Textures ──
    if floor_type == "epoxy":
        epoxy_rgb = np.array(hex_to_rgb(epoxy_tint), dtype=np.float64)
        # Center-to-edge depth shift (subtle epoxy depth effect)
        center_x = np.abs(hit_x) / half_w  # 0 at center, 1 at edge
        center_z = np.abs(hit_z) / room_depth  # 0 at camera, 1 at back
        center_dist = np.sqrt(center_x ** 2 + center_z ** 2)
        depth_f = 1.0 - epoxy_tint_strength * center_dist
        for c in range(3):
            val = canvas[:, :, c] * depth_f + epoxy_rgb[c] * epoxy_tint_strength * (1.0 - depth_f)
            canvas[:, :, c] = np.where(is_floor, val, canvas[:, :, c])

    elif floor_type == "tile":
        grout_rgb_arr = np.array(hex_to_rgb(grout_color), dtype=np.float64)
        # World-space tile grid aligned with room walls
        pos_x = np.mod(hit_x + 1000 * tile_size, tile_size)  # offset to handle negatives
        pos_z = np.mod(-hit_z + 1000 * tile_size, tile_size)
        half_g = grout_width / 2.0
        is_grout = (
            (pos_x < half_g)
            | (pos_x > tile_size - half_g)
            | (pos_z < half_g)
            | (pos_z > tile_size - half_g)
        )

        # Subtle per-tile color variation
        tile_col = np.floor((hit_x + 1000 * tile_size) / tile_size).astype(np.int64)
        tile_row = np.floor((-hit_z + 1000 * tile_size) / tile_size).astype(np.int64)
        tile_hash = np.mod(tile_col * 7 + tile_row * 13, 11).astype(np.float64) / 11.0
        tile_var = 0.985 + 0.03 * tile_hash

        for c in range(3):
            tile_val = canvas[:, :, c] * tile_var
            grout_val = grout_rgb_arr[c] * floor_shade * dist_shade * ao
            canvas[:, :, c] = np.where(
                is_floor & is_grout, grout_val, np.where(is_floor, tile_val, canvas[:, :, c])
            )

    elif floor_type == "concrete":
        # Deterministic hash-based noise for concrete texture
        scale = 80.0
        nx = (hit_x * scale).astype(np.int64)
        nz = (hit_z * scale).astype(np.int64)
        # Multi-step hash for better distribution
        h = nx * 374761393 + nz * 668265263
        h = np.bitwise_xor(h, np.right_shift(h, 13)) * np.int64(1274126177)
        h = np.bitwise_xor(h, np.right_shift(h, 16))
        noise = (np.bitwise_and(h, 0x7FFFFFFF)).astype(np.float64) / 2147483647.0
        noise_f = 1.0 - concrete_noise_strength + 2.0 * concrete_noise_strength * noise
        noise_f = np.clip(noise_f, 1.0 - concrete_noise_strength, 1.0 + concrete_noise_strength)
        for c in range(3):
            canvas[:, :, c] = np.where(is_floor, canvas[:, :, c] * noise_f, canvas[:, :, c])

    # ── Convert to uint8 ──
    canvas_u8 = np.clip(canvas, 0, 255).astype(np.uint8)
    img = Image.fromarray(canvas_u8, mode="RGBA")

    # Subtle anti-aliasing blur to soften pixel-level edges
    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))

    print(f"Generated corner studio: {name} ({WIDTH}x{HEIGHT})")
    return img


def generate_preview(full_img: Image.Image, preview_width: int = 400) -> Image.Image:
    """Generate a smaller preview image from a full-size studio."""
    ratio = preview_width / full_img.size[0]
    preview_height = int(full_img.size[1] * ratio)
    resample = getattr(Image, "LANCZOS", getattr(Image.Resampling, "LANCZOS", 1))
    preview = full_img.resize((preview_width, preview_height), resample)
    return preview


# ── Studio Definitions ──
# Automotive corner studios with realistic 3D perspective
# Each studio has distinct wall colors and floor type
STUDIOS = [
    {
        "key": "white_corner_light_epoxy",
        "name": "White Corner Studio — Light Gray Epoxy",
        "rear_wall_color": "#F5F5F5",
        "left_wall_color": "#EEEEEE",
        "right_wall_color": "#EEEEEE",
        "ceiling_color": "#E8E8E8",
        "floor_color": "#D8D8D8",
        "floor_type": "epoxy",
        "epoxy_tint": "#C8C0B8",
        "epoxy_tint_strength": 0.03,
    },
    {
        "key": "white_corner_ceramic_tile",
        "name": "White Corner Studio — Ceramic Tile",
        "rear_wall_color": "#F0F0F0",
        "left_wall_color": "#E8E8E8",
        "right_wall_color": "#E8E8E8",
        "ceiling_color": "#E0E0E0",
        "floor_color": "#D0D0D0",
        "floor_type": "tile",
        "tile_size": 0.6,
        "grout_color": "#B8B8B8",
        "grout_width": 0.012,
    },
    {
        "key": "light_gray_corner_medium_epoxy",
        "name": "Light Gray Corner Studio — Medium Gray Epoxy",
        "rear_wall_color": "#E0E0E0",
        "left_wall_color": "#D5D5D5",
        "right_wall_color": "#D5D5D5",
        "ceiling_color": "#D0D0D0",
        "floor_color": "#909090",
        "floor_type": "epoxy",
        "epoxy_tint": "#807870",
        "epoxy_tint_strength": 0.02,
    },
    {
        "key": "dark_gray_corner_concrete",
        "name": "Dark Gray Corner Studio — Concrete Floor",
        "rear_wall_color": "#404040",
        "left_wall_color": "#383838",
        "right_wall_color": "#383838",
        "ceiling_color": "#353535",
        "floor_color": "#555555",
        "floor_type": "concrete",
        "concrete_noise_strength": 0.04,
    },
    {
        "key": "black_corner_dark_epoxy",
        "name": "Black Corner Studio — Dark Epoxy Floor",
        "rear_wall_color": "#1A1A1A",
        "left_wall_color": "#151515",
        "right_wall_color": "#151515",
        "ceiling_color": "#121212",
        "floor_color": "#353535",
        "floor_type": "epoxy",
        "epoxy_tint": "#2A2820",
        "epoxy_tint_strength": 0.02,
    },
    {
        "key": "commercial_showroom_tile",
        "name": "Commercial Showroom — Tile Floor",
        "rear_wall_color": "#909090",
        "left_wall_color": "#888888",
        "right_wall_color": "#888888",
        "ceiling_color": "#858585",
        "floor_color": "#A0A0A0",
        "floor_type": "tile",
        "tile_size": 0.8,
        "grout_color": "#707070",
        "grout_width": 0.015,
    },
    {
        "key": "industrial_concrete",
        "name": "Industrial Automotive Studio — Concrete Floor",
        "rear_wall_color": "#2A2A2A",
        "left_wall_color": "#252525",
        "right_wall_color": "#252525",
        "ceiling_color": "#222222",
        "floor_color": "#484848",
        "floor_type": "concrete",
        "concrete_noise_strength": 0.05,
    },
    {
        "key": "matte_black_automotive",
        "name": "Matte Black Automotive Studio",
        "rear_wall_color": "#0A0A0A",
        "left_wall_color": "#080808",
        "right_wall_color": "#080808",
        "ceiling_color": "#060606",
        "floor_color": "#151515",
        "floor_type": "epoxy",
        "epoxy_tint": "#100E08",
        "epoxy_tint_strength": 0.02,
    },
]


def main():
    """Generate all studio backgrounds and previews."""
    STUDIOS_DIR.mkdir(parents=True, exist_ok=True)

    for studio in STUDIOS:
        print(f"\nGenerating {studio['key']}...")

        full_img = generate_corner_studio(
            name=studio["key"],
            rear_wall_color=studio["rear_wall_color"],
            left_wall_color=studio["left_wall_color"],
            right_wall_color=studio["right_wall_color"],
            ceiling_color=studio["ceiling_color"],
            floor_color=studio["floor_color"],
            floor_type=studio.get("floor_type", "epoxy"),
            epoxy_tint=studio.get("epoxy_tint", "#000000"),
            epoxy_tint_strength=studio.get("epoxy_tint_strength", 0.02),
            tile_size=studio.get("tile_size", 0.6),
            grout_color=studio.get("grout_color", "#888888"),
            grout_width=studio.get("grout_width", 0.012),
            concrete_noise_strength=studio.get("concrete_noise_strength", 0.04),
            ceiling_light_strips=studio.get("ceiling_light_strips", True),
            light_strip_brightness=studio.get("light_strip_brightness", 0.12),
            light_strip_spacing=studio.get("light_strip_spacing", 2.0),
            light_strip_width=studio.get("light_strip_width", 0.15),
        )

        # Save full-size PNG
        full_path = STUDIOS_DIR / f"{studio['key']}.png"
        full_img.save(str(full_path), "PNG")
        print(f"  Saved: {full_path}")

        # Generate and save preview
        preview = generate_preview(full_img)
        preview_path = STUDIOS_DIR / f"{studio['key']}_preview.png"
        preview.save(str(preview_path), "PNG")
        print(f"  Saved: {preview_path}")

    print(f"\nAll {len(STUDIOS)} studios generated in {STUDIOS_DIR}")


if __name__ == "__main__":
    main()