# Studio Preview Images

## Location
Preview images should be stored in: `backend/app/static/studios/`

## Required Preview Images

The following preview images must exist for each studio:

| Studio Key | Preview Image Filename | Description |
|------------|----------------------|-------------|
| `luxury_showroom` | `luxury_showroom_preview.jpg` | Luxury automotive showroom environment |
| `white_minimal` | `white_minimal_preview.jpg` | White minimal studio environment |
| `cinematic_dark` | `cinematic_dark_preview.jpg` | Cinematic dark studio environment |
| `black_automotive_showroom` | `black_showroom_preview.jpg` | Black automotive showroom environment |
| `luxury_exhibition_hall` | `luxury_exhibition_preview.jpg` | Luxury exhibition hall environment |
| `glossy_reflective_floor` | `glossy_reflective_preview.jpg` | Glossy reflective floor studio |

## Image Requirements

1. **Format**: JPEG or PNG (JPEG recommended for photos)
2. **Resolution**: Minimum 1920x1080 pixels (HD), prefer 3840x2160 (4K)
3. **Aspect Ratio**: 16:9 or similar landscape orientation
4. **Content Rules**:
   - Must be an **empty** automotive exhibition/showroom environment
   - **NO VEHICLES** should be present - only the empty space where vehicles will be inserted
   - Show professional studio lighting, walls, and floor
   - Clean, professional environment without distractions

5. **File Size**: Optimize for web (under 2MB per image recommended)

## Fallback Behavior

If a preview image is missing or fails to load:
- A dark gradient fallback will be displayed
- The studio name will remain visible on the card
- No breaking errors - the card remains functional

## Image Sourcing Recommendations

1. **Free Stock Sites**: Use Pexels, Unsplash, or Pixabay
   - Search terms: "empty car showroom", "automotive exhibition hall", "luxury car display", "car studio background"
   - Filter by "No people" or "Empty" where possible

2. **AI Generation**: Use Stable Diffusion, Leonardo.AI, or similar
   - Prompt: "Empty luxury car showroom, no vehicle, professional photography, cinematic lighting, clean environment"
   - Ensure the image does NOT contain any vehicles

3. **Download Location**: Save images to `backend/app/static/studios/`