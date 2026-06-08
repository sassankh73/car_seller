# Studio Background Images

## Location
Studio images are stored in: `backend/app/static/studios/`

## Studio Catalog

The following 8 automotive corner studios are available — all with 3D perspective depth:

| Studio Key | Full Image | Preview Image | Description |
|------------|-----------|---------------|-------------|
| `white_corner_light_epoxy` | `white_corner_light_epoxy.png` | `white_corner_light_epoxy_preview.png` | White corner + light gray epoxy floor |
| `white_corner_ceramic_tile` | `white_corner_ceramic_tile.png` | `white_corner_ceramic_tile_preview.png` | White corner + ceramic tile floor |
| `light_gray_corner_medium_epoxy` | `light_gray_corner_medium_epoxy.png` | `light_gray_corner_medium_epoxy_preview.png` | Light gray corner + medium gray epoxy |
| `dark_gray_corner_concrete` | `dark_gray_corner_concrete.png` | `dark_gray_corner_concrete_preview.png` | Dark gray corner + concrete floor |
| `black_corner_dark_epoxy` | `black_corner_dark_epoxy.png` | `black_corner_dark_epoxy_preview.png` | Black corner + dark epoxy floor |
| `commercial_showroom_tile` | `commercial_showroom_tile.png` | `commercial_showroom_tile_preview.png` | Commercial showroom + tile floor |
| `industrial_concrete` | `industrial_concrete.png` | `industrial_concrete_preview.png` | Industrial dark + concrete floor |
| `matte_black_automotive` | `matte_black_automotive.png` | `matte_black_automotive_preview.png` | Matte black + matte black epoxy |

## Design Principles

These studios are realistic 3D corner rooms for automotive photography:

- **Visible room structure** — rear wall, left wall, right wall, ceiling, floor
- **Sharp 90° corners** — no cyclorama, no curved transitions, no infinity walls
- **Deep room perspective** — natural vanishing point, realistic corner geometry
- **~60% floor, ~30% walls, ~10% ceiling** — professional dealership composition
- **No platforms or stages** — vehicles sit directly on the floor
- **Matte finishes** — no glossy reflections, no mirror floors
- **Commercial showroom lighting** — ceiling light strips, even illumination
- **Ambient occlusion** — subtle darkening at corners for realism
- **Distance shading** — subtle darkening with depth for natural feel

## 3D Perspective Parameters

All studios use the same camera and room geometry:

- **Camera height**: 1.05m from floor (slightly below eye level)
- **Camera pitch**: -6° (slight downward tilt for maximum floor)
- **Horizontal FOV**: 68° (~30mm equivalent lens)
- **Room width**: 8.0m
- **Room height**: 3.2m
- **Room depth**: 8.0m (camera to back wall)
- **Vanishing point**: Center of image (where walls converge)

## Floor Types

- **Epoxy**: Subtle depth tint, smooth matte surface
- **Tile**: Visible grout lines (0.6-0.8m tiles), per-tile color variation
- **Concrete**: Deterministic noise texture, industrial feel

## Image Specifications

1. **Format**: PNG (RGBA)
2. **Full Resolution**: 1920×1080 pixels (HD)
3. **Preview Resolution**: 400×225 pixels
4. **Aspect Ratio**: 16:9
5. **Floor Line**: At ~78% of height (floor_y=0.78), matching shadow profiles

## Regenerating Studios

Run the generation script to create all studio images:

```bash
cd backend
python3 generate_studios.py
```

This will regenerate all 8 corner studio backgrounds and their previews.

## Shadow Profiles

Each studio has a `StudioShadowProfile` with `floor_y=0.78` that controls:

- `floor_y` (0.78): Where the vehicle's wheels sit on the floor
- `shadow_blur` (32-40): Gaussian blur radius for body shadow
- `shadow_opacity` (0.20-0.28): Opacity of the body shadow
- `shadow_length` (0.9-1.1): Length multiplier for body shadow
- `tire_shadow_blur` (13-16): Blur radius for tire contact shadows
- `tire_shadow_opacity` (0.42-0.52): Opacity for tire contact shadows
- `ao_shadow_opacity` (0.28-0.35): Ambient occlusion shadow opacity

## Fallback Behavior

If a studio background image is missing:
- The system falls back to a solid color (defined per studio in `studio.py`)
- A soft contact shadow is still generated under the vehicle
- No breaking errors — the composite remains functional