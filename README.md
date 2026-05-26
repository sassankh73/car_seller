# AutoStudio AI

**AutoStudio AI** is a SaaS platform that transforms mobile phone car photos into professional studio-quality images using advanced AI compositing techniques.

## Features

### AI Image Processing Pipeline
- **Background Removal**: AI-powered background extraction
- **Realistic Shadows**: Multi-layer shadow generation with gradient fade
- **Floor Reflections**: Mirror-like reflections with opacity gradients
- **Lighting Correction**: Professional brightness, contrast, and color balance
- **Perspective Correction**: Keystone correction for proper proportions
- **Wheel Preservation**: Selective sharpening for wheel details
- **Paint Enhancement**: Specular highlights for glossy finish

### SaaS Subscription System
- **Stripe Integration**: Full payment processing
- **Three Tiers**: Basic ($29), Professional ($79), Enterprise ($199)
- **Usage Tracking**: Generations, studios, 4K exports, logo branding
- **Customer Portal**: Self-service subscription management
- **Webhook Handling**: Automated payment events
- **Overage Billing**: Pay-as-you-go for extra usage

### Studio Templates
- Luxury Showroom (dark, dramatic)
- White Studio (bright, catalog-style)
- Dark Cinematic (high contrast)
- Outdoor Dealership (natural daylight)

### Export Options
- HD (1920x1080) - Fast, web-optimized
- 4K (3840x2160) - Professional print quality

## Project Structure

```
car_sellers/
├─ frontend/                     # Next.js UI
│   ├─ app/
│   │   ├─ layout.tsx           # Root layout
│   │   ├─ globals.css          # Tailwind styles
│   │   ├─ page.tsx             # Landing page
│   │   └─ dashboard/
│   │       └─ page.tsx         # Main dashboard
│   ├─ components/              # Shared components
│   ├─ public/                  # Static assets
│   ├─ package.json
│   ├─ tailwind.config.js
│   └─ next.config.js
├─ backend/
│   ├─ app/
│   │   ├─ api/
│   │   │   ├─ auth.py          # Authentication endpoints
│   │   │   ├─ projects.py      # Project management
│   │   │   └─ studio.py        # AI processing endpoint
│   │   ├─ services/
│   │   │   ├─ image_processing.py   # Core AI pipeline
│   │   │   └─ test_pipeline.py      # Pipeline tests
│   │   ├─ core/                # Settings, config
│   │   ├─ models/              # Database models
│   │   ├── static/             # Studio backgrounds
│   │   └─ main.py              # FastAPI entrypoint
│   ├─ requirements.txt
│   └─ AI_PIPELINE.md           # Pipeline documentation
└─ README.md
```

## Getting Started

### Prerequisites
- Node.js 20+ (frontend)
- Python 3.11+ (backend)
- PostgreSQL (optional for persistence)

### Backend Setup

```bash
cd car_sellers/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd car_sellers/frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Test the AI Pipeline

```bash
cd car_sellers/backend
source venv/bin/activate

# Run pipeline test
python -m app.services.test_pipeline
```

This generates test images in the backend directory.

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login

#### Projects
- `GET /api/projects/` - List user projects
- `POST /api/projects/` - Create new project
- `GET /api/projects/{id}` - Get project details

#### Studio & AI Processing
- `GET /api/studio/` - List available studios
- `GET /api/studio/{key}` - Get studio details
- `POST /api/studio/process` - Process car image

#### Billing & Subscriptions
- `GET /api/billing/plans` - List subscription plans
- `GET /api/billing/plans/{tier}` - Get specific plan
- `POST /api/billing/checkout` - Create Stripe checkout
- `GET /api/billing/portal` - Customer portal session
- `POST /api/billing/webhook` - Stripe webhook handler
- `GET /api/billing/usage/{user_id}` - Get usage stats
- `POST /api/billing/usage/{user_id}/record` - Record usage
- `POST /api/billing/calculate-cost` - Calculate overage

### Processing Request Format

```bash
curl -X POST http://localhost:8000/api/studio/process \
  -F "file=@car_photo.jpg" \
  -F "studio_key=luxury_showroom" \
  -F "enhance_wheels=true" \
  -F "enhance_paint=true" \
  -F "export_quality=hd"
```

## Configuration

### AI Pipeline Parameters

Edit `backend/app/services/image_processing.py` to customize:

```python
# Shadow settings
ShadowGenerator(
    blur_radius=25,      # Shadow softness
    opacity=0.7,         # Shadow density
    offset_y=20,         # Vertical offset
)

# Reflection settings
ReflectionGenerator(
    reflection_height_ratio=0.2,  # Height vs car
    fade_strength=0.6,            # Max opacity
    blur_radius=3,                # Mirror blur
)

# Lighting settings
LightingCorrector(
    brightness=1.05,   # +5%
    contrast=1.15,     # +15%
    sharpen=0.6,       # Sharpening
)
```

### Background Removal Integration

To integrate a real background removal API:

```python
# In image_processing.py, use RemoveBGRemover instead of MockRemover
class RemoveBGRemover(BackgroundRemover):
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def remove_background(self, image: Image.Image) -> Image.Image:
        # Call remove.bg API
        response = requests.post(
            "https://api.remove.bg/v1.0/removebg",
            files={"image_file": image_bytes},
            headers={"X-Api-Key": self.api_key},
        )
        return Image.open(io.BytesIO(response.content))
```

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations
- **Axios** - HTTP client

### Backend
- **FastAPI** - Modern Python web framework
- **Pillow** - Image processing
- **NumPy** - Array operations
- **Pydantic** - Data validation

## Roadmap

- [x] Stripe subscription billing
- [x] Usage tracking and overage billing
- [x] Customer portal integration
- [ ] PostgreSQL integration with SQLAlchemy
- [ ] JWT authentication with Google OAuth
- [ ] Real background removal API integration
- [ ] Batch processing
- [ ] Custom studio uploads
- [ ] 360° spin video generation
- [ ] Mobile app (React Native)

## License

MIT License - See LICENSE file for details.
