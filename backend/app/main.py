from dotenv import load_dotenv

load_dotenv()

import os
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from typing import List

from .api import auth, projects, studio
from .api.billing import routes as billing_routes
from .api.admin import router as admin_router
from .middleware.auth import authenticate_middleware, get_current_user
from .models import init_db, SessionLocal, Role, User, engine
from .api.studio import StudioOut
from .schemas.auth import UserResponse
from .services.auth import hash_password, get_user_by_email

logger = logging.getLogger(__name__)


def ensure_admin_user():
    """
    Bootstrap admin account from environment variables.

    Requires ADMIN_EMAIL and ADMIN_PASSWORD to be explicitly set.
    Skips creation (with a warning) if either is missing — never uses hardcoded credentials.
    """
    admin_email = os.getenv("ADMIN_EMAIL", "").strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()

    if not admin_email or not admin_password:
        logger.warning(
            "ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin bootstrap. "
            "Set both env vars and restart to create the admin account."
        )
        return

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
        logger.critical(f"CRITICAL: Failed to create admin user — {e}")
        db.rollback()
        raise
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

# Configure logging to show full tracebacks at DEBUG level
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d %(funcName)s: %(message)s",
    force=True,
)


# Add authenticate middleware
@app.middleware("http")
async def add_auth_middleware(request: Request, call_next):
    return await authenticate_middleware(request, call_next)


@app.on_event("startup")
async def on_startup():
    """Initialize database on startup and ensure admin user exists."""
    # --- Startup validation: log config (excluding secrets) ---
    db_url = os.getenv("DATABASE_URL", "")
    db_host = "unknown"
    if db_url:
        # Parse host from DATABASE_URL for logging (mask password)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(db_url)
            db_host = f"{parsed.hostname}:{parsed.port}"
            # Mask password in log output
            masked_url = db_url.replace(parsed.password or "", "***") if parsed.password else db_url
        except Exception:
            masked_url = "***parse error***"
            db_host = "parse_error"
    else:
        masked_url = "NOT SET"

    logger.info("=" * 60)
    logger.info("AutoStudio AI Backend - Starting Up")
    logger.info("=" * 60)
    logger.info(f"  DATABASE_URL : {masked_url}")
    logger.info(f"  DB Host      : {db_host}")
    logger.info(f"  APP_NAME     : {os.getenv('APP_NAME', 'NOT SET')}")
    logger.info(f"  APP_URL      : {os.getenv('APP_URL', 'NOT SET')}")
    logger.info(f"  FRONTEND_URL : {os.getenv('FRONTEND_URL', 'NOT SET')}")
    logger.info(f"  ENABLE_REMBG : {os.getenv('ENABLE_REMBG', 'NOT SET')}")
    logger.info(f"  REMBG_SERVICE_URL: {os.getenv('REMBG_SERVICE_URL', 'NOT SET')}")
    logger.info(f"  ADMIN_PASSWORD: {'***SET***' if os.getenv('ADMIN_PASSWORD') else 'NOT SET'}")
    logger.info("=" * 60)

    # --- Validate required config ---
    if not os.getenv("DATABASE_URL"):
        logger.critical(
            "FATAL: DATABASE_URL is not set. "
            "Copy backend/.env.example to backend/.env and configure it."
        )
        raise RuntimeError("DATABASE_URL environment variable is required but not set.")

    secret_key = os.getenv("SECRET_KEY", "")
    if not secret_key or len(secret_key) < 32:
        logger.critical(
            "FATAL: SECRET_KEY is not set or is too short (must be >= 32 characters). "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
        raise RuntimeError("SECRET_KEY environment variable must be set and at least 32 characters long.")

    # --- Test database connectivity ---
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Database connection verified: {db_host}")
    except Exception as e:
        logger.critical(f"FATAL: Cannot connect to database at {db_host}: {e}")
        logger.critical(
            "Ensure PostgreSQL is running and DATABASE_URL is correct. "
            "If using Docker, the 'postgres' service must be healthy."
        )
        raise

    # --- Initialize DB and admin ---
    init_db()
    ensure_admin_user()
    logger.info("Startup complete - AutoStudio AI Backend is ready.")


# Serve static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Add trailing slash middleware BEFORE CORS
app.add_middleware(TrailingSlashMiddleware)

# CORS configuration — explicit allow-list driven by ALLOWED_ORIGINS env var
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_allowed_origins: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
        role=user.role.value if user.role else "FREE",
        is_active=user.is_active,
        is_disabled=user.is_disabled,
        force_password_reset=user.force_password_reset,
        created_at=user.created_at,
    )
