"""
Authentication middleware for AutoStudio AI.

This module contains middleware functions for JWT authentication.
"""

import logging
import traceback

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.models import SessionLocal, Role
from app.services.auth import decode_access_token, get_user_by_email

logger = logging.getLogger(__name__)


async def authenticate_middleware(request: Request, call_next):
    """
    Middleware to validate JWT tokens on protected routes.

    This middleware:
    1. Checks for Bearer token in Authorization header
    2. Validates the JWT token
    3. Adds the current user to the request state
    """
    # Skip authentication for public routes — exact-path or explicit prefix matches only
    public_exact = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/logout",
        "/api/auth/token",
        "/api/auth/signup",
        "/docs",
        "/openapi.json",
        "/health",
        "/api/version",
    }
    # Prefix matches for static assets and public plan listing
    public_prefixes = [
        "/static/",
        "/api/billing/plans",
        "/api/studio/",   # GET /api/studio/* (listing/details) — public; POST /process requires auth
        "/api/studio",    # exact GET /api/studio listing
    ]

    path = request.url.path
    # POST /api/studio/process is NOT public — require auth
    is_public = (
        path in public_exact
        or (
            request.method != "POST"
            and any(path == p or (p.endswith("/") and path.startswith(p)) for p in public_prefixes)
        )
        or (request.method in ("GET",) and path in {"/api/studio"})
    )

    if is_public:
        return await call_next(request)

    # Accept token from Authorization header or httpOnly cookie
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token format"},
            )
        token = parts[1]
    else:
        token = request.cookies.get("auth_token")
        if not token:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Not authenticated"},
            )

    # Validate token with proper DB session management
    db: Session = SessionLocal()
    try:
        payload = decode_access_token(token)
        if not payload or not payload.sub:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
            )

        logger.debug("auth_middleware: validating user email=%s path=%s", payload.sub, path)

        # Get user from database
        user = get_user_by_email(db, email=payload.sub)
        if not user or not user.is_active:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "User not found or inactive"},
            )

        # Check if user is disabled
        if user.is_disabled:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Account is disabled. Please contact support."},
            )

        logger.debug("auth_middleware: user id=%s role=%s path=%s", user.id, user.role, path)

        # Add user and db session to request state
        request.state.current_user = user
        request.state.db = db

        response = await call_next(request)
        return response
    except Exception as exc:
        logger.error(
            "auth_middleware UNHANDLED EXCEPTION: path=%s method=%s error=%s\n%s",
            path, request.method, exc, traceback.format_exc(),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
    finally:
        db.close()


def require_admin_role(request: Request, call_next):
    """
    Middleware decorator to require admin role.
    
    Usage:
        @app.get("/admin")
        @require_admin_role
        def admin_route():
            ...
    """
    async def wrapper(*args, **kwargs):
        user = get_current_user(request)
        if not user or user.role != Role.ADMIN:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Admin access required"},
            )
        return await call_next(request)
    return wrapper


def require_role(*allowed_roles: Role):
    """
    Decorator factory for role-based access control.
    
    Usage:
        @app.get("/premium-feature")
        @require_role(Role.ADMIN, Role.PREMIUM)
        def premium_feature():
            ...
    """
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            user = get_current_user(request)
            if not user or user.role not in allowed_roles:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Insufficient permissions"},
                )
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator


def get_current_user(request: Request):
    """
    Get the current authenticated user from request state.

    Usage:
        @app.get("/protected")
        def protected_route(user: User = Depends(get_current_user)):
            return {"user": user}
    """
    return getattr(request.state, "current_user", None)


def get_db_session(request: Request):
    """
    Get the database session from request state.

    Usage:
        @app.get("/protected")
        def protected_route(db: Session = Depends(get_db_session)):
            return {"db": db}
    """
    return getattr(request.state, "db", None)


def get_current_editor(request: Request):
    """
    Get the current authenticated editor (EDITOR or ADMIN) or raise 403.

    ADMIN can access all editor endpoints — mirrors get_current_admin pattern.
    """
    user = get_current_user(request)
    if not user or user.role not in (Role.EDITOR, Role.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")
    return user


def get_current_admin(request: Request):
    """
    Get the current authenticated admin user or raise 403.
    
    Allows ADMIN role to access admin routes.
    
    Usage:
        @app.get("/admin")
        def admin_route(user: User = Depends(get_current_admin)):
            return {"user": user}
    """
    user = get_current_user(request)
    if not user or user.role not in (Role.ADMIN,):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
