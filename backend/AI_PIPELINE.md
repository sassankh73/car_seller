# AI Image Processing Pipeline

## Overview

AutoStudio AI uses a sophisticated multi-stage image processing pipeline to transform mobile phone car photos into professional studio-quality images. The pipeline combines computer vision techniques with AI-powered enhancements.

## Pipeline Architecture

```
┌─────────────────┐
│  Original Image │
│  (Mobile Photo) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 1. Background   │
│    Removal      │
│    (AI-based)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Perspective  │
│    Correction   │
│    (Keystone)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Lighting     │
│    Correction   │
│    (Color/Bright)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. Wheel        │
│    Preservation │
│    (Detail Sharp)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Paint        │
│    Enhancement  │
│    (Specular)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. Shadow       │
│    Generation   │
│    (Gradient)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 7. Reflection   │
│    Generation   │
│    (Floor Mirror)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 8. Final        │
│    Composite    │
│    (Layer Blend)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Export (HD/4K) │
└─────────────────┘
```

## Processing Stages

### 1. Background Removal
- **Method**: External AI API (remove.bg, clipdrop, or custom model)
- **Output**: RGBA image with transparent background
- **Quality**: Edge-aware matte with sub-pixel precision

### 2. Perspective Correction
- **Keystone Correction**: Corrects upward/downward camera angle
- **Scale Adjustment**: Normalizes car size across different photos
- **Horizon Alignment**: Ensures car sits level with studio floor

### 3. Lighting Correction
- **Brightness**: +5% to +15% boost for mobile photos
- **Contrast**: +15% to +25% for punchier look
- **Color Balance**: Warm tone adjustment (slight red/blue reduction)
- **Sharpening**: Subtle detail enhancement (0.5-0.6 strength)

### 4. Wheel Preservation
- **Detection**: Identifies wheel regions (bottom corners of car mask)
- **Selective Sharpening**: 1.3-1.4x sharpening on wheel areas
- **Detail Merge**: Optionally merge wheel details from original photo
- **Rim Enhancement**: Accentuates spoke patterns and metallic finish

### 5. Paint Reflection Enhancement
- **Luminance Mapping**: Identifies highlight areas on car body
- **Specular Boost**: +20% to +30% enhancement on reflective surfaces
- **Highlight Mask**: Creates natural-looking glossy finish
- **Smoothness Filter**: Subtle noise reduction for clean paint look

### 6. Shadow Generation
- **Contact Shadow**: Dark, sharp shadow directly under car
- **Ambient Shadow**: Soft gradient shadow extending outward
- **Direction**: Configurable light angle (default: 30-45 degrees)
- **Blur Radius**: 20-30px for natural soft edges
- **Opacity**: 60-70% for realistic density
- **Distance Fade**: Gradient fade based on distance from car

### 7. Floor Reflection
- **Mirror Effect**: Vertical flip of car image
- **Opacity Gradient**: Strong at bottom, fades toward car
- **Noise Injection**: 3-5% noise for realistic floor imperfections
- **Blur**: 3-5px blur for semi-gloss floor finish
- **Height Ratio**: Reflection is 20-25% of car height

### 8. Final Composite
- **Layer Order**: Background → Shadow → Reflection → Car
- **Alpha Blending**: Professional alpha compositing
- **Color Matching**: Car color temperature matched to studio
- **Edge Blending**: Soft edges where car meets floor

## Studio Templates

| Studio | Floor Color | Lighting | Use Case |
|--------|-------------|----------|----------|
| Luxury Showroom | #2a2a2a (dark gray) | Warm, dramatic | Premium listings |
| White Studio | #f5f5f5 (off-white) | Bright, even | Catalog photos |
| Dark Cinematic | #0a0a0a (near black) | High contrast | Marketing materials |
| Outdoor Dealership | #3a3a3a (medium gray) | Natural daylight | Inventory photos |

## Export Quality

### HD (1920x1080)
- Standard web quality
- Fast processing (~2-5 seconds)
- Suitable for online listings, social media

### 4K (3840x2160)
- Professional print quality
- Longer processing (~5-15 seconds)
- Suitable for large format prints, billboards

## API Integration

### Request Format
```bash
POST /api/studio/process
Content-Type: multipart/form-data

file: <car_image.jpg>
studio_key: luxury_showroom
enhance_wheels: true
enhance_paint: true
export_quality: hd
```

### Response
- **Format**: PNG with transparency
- **Headers**: 
  - `X-Studio-Key`: Selected studio
  - `X-Export-Quality`: Resolution tier
  - `Content-Disposition`: Download filename

## Configuration

All processing parameters are configurable in `backend/app/services/image_processing.py`:

```python
# Shadow settings
ShadowGenerator(
    blur_radius=25,      # Shadow softness
    opacity=0.7,         # Shadow density
    offset_x=0,          # Horizontal offset
    offset_y=20,         # Vertical offset
    angle_deg=30         # Light angle
)

# Reflection settings
ReflectionGenerator(
    reflection_height_ratio=0.2,  # Reflection height vs car
    fade_strength=0.6,            # Max opacity
    noise_intensity=0.03,         # Floor imperfection
    blur_radius=3                 # Mirror blur
)

# Lighting settings
LightingCorrector(
    brightness=1.05,              # +5% brightness
    contrast=1.15,                # +15% contrast
    color_balance=(1.0, 0.98, 0.95),  # RGB balance
    sharpen=0.6                   # Sharpening strength
)
```

## Future Enhancements

1. **AI-Based Car Detection**: Use YOLO or similar for precise car segmentation
2. **Depth Estimation**: Generate depth maps for more realistic shadows
3. **Environment Mapping**: Match car reflections to studio environment
4. **Batch Processing**: Process multiple cars simultaneously
5. **Custom Studios**: User-uploaded studio backgrounds
6. **Video Export**: 360° spin videos from multiple angles

## Performance

- **Processing Time**: 2-15 seconds depending on resolution
- **Memory**: ~500MB peak for 4K processing
- **Throughput**: ~10 images/minute on standard server

## Dependencies

- **Pillow**: Image manipulation
- **NumPy**: Array operations for pixel processing
- **External API**: Background removal (remove.bg, etc.)
