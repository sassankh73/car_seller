from dotenv import load_dotenv

load_dotenv()

import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from typing import List

from .api import auth, projects, studio
from .api.billing import routes as billing_routes
from .api.admin import router as admin_router
from .middleware.auth import authenticate_middleware, get_current_user
from .models import init_db, SessionLocal, Role, User
from .api.studio import StudioOut
from .schemas.auth import UserResponse
from .services.auth import hash_password, get_user_by_email

logger = logging.getLogger(__name__)


def ensure_admin_user():
    """
    Ensure the bootstrap admin account exists.

    Creates admin@autostudio.local with ADMIN role if it doesn't exist.
    Password is read from the ADMIN_PASSWORD environment variable.
    """
    admin_email = "admin@autostudio.local"
    admin_password = os.getenv("ADMIN_PASSWORD", "AdminPass123")

    db = SessionLocal()
    try:
        existing = get_user_by_email(db, email=admin_email)
        if existing:
            logger.info(f"Admin user already exists: {admin_email}")
            return

        admin_user = User(
            email=admin_email,
            hashed_password=hash_password(admin_password),
            name="Admin",
            role=Role.ADMIN,
            is_active=True,
            is_disabled=False,
            is_superuser=True,
        )
        db.add(admin_user)
        db.commit()
        logger.info(f"Created admin user: {admin_email} with role ADMIN")
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}")
        db.rollback()
    finally:
        db.close()


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """
    Middleware to normalize paths by stripping trailing slashes for API routes.
    This prevents FastAPI from issuing redirects that leak internal hostnames.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        # Only normalize API routes that have trailing slash
        # But skip paths that are meant to have trailing slashes (like /api/projects/)
        skip_paths = ["/api/projects", "/api/studio", "/api/billing"]
        if path.startswith("/api/") and path.endswith("/") and not any(path.startswith(sp) for sp in skip_paths):
            # Strip trailing slash
            normalized_path = path.rstrip("/")
            request.scope["path"] = normalized_path
        response = await call_next(request)
        return response


app = FastAPI(title="AutoStudio AI Backend", redirect_slashes=False)


# Add authenticate middleware
@app.middleware("http")
async def add_auth_middleware(request: Request, call_next):
    return await authenticate_middleware(request, call_next)


@app.on_event("startup")
async def on_startup():
    """Initialize database on startup and ensure admin user exists."""
    init_db()
    ensure_admin_user()


# Serve static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Add trailing slash middleware BEFORE CORS
app.add_middleware(TrailingSlashMiddleware)

# CORS configuration to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])

@app.get("/api/studio", response_model=List[StudioOut])
def direct_studio_list():
    """Direct route for /api/studio without trailing slash."""
    return studio.list_studios()

app.include_router(billing_routes.router, prefix="/api/billing", tags=["billing"])
app.include_router(admin_router, prefix="/api", tags=["admin"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "message": "AutoStudio AI Backend is running"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(request: Request):
    """
    Get current authenticated user info from the JWT token.

    The auth middleware validates the JWT and sets request.state.current_user.
    """
    user = get_current_user(request)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value if user.role else "free",
        is_active=user.is_active,
    )