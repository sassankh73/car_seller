"""
Authentication middleware for AutoStudio AI.

This module contains middleware functions for JWT authentication.
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.models import SessionLocal, Role
from app.services.auth import decode_access_token, get_user_by_email


async def authenticate_middleware(request: Request, call_next):
    """
    Middleware to validate JWT tokens on protected routes.

    This middleware:
    1. Checks for Bearer token in Authorization header
    2. Validates the JWT token
    3. Adds the current user to the request state
    """
    # Skip authentication for public routes
    public_paths = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/forgot-password",
        "/api/auth/token",
        "/api/auth/signup",
        "/docs",
        "/openapi.json",
        "/health",
        "/static",
        "/api/studio",
    ]

    path = request.url.path
    is_public = any(path.startswith(p) for p in public_paths)

    if is_public:
        return await call_next(request)

    # Get authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Not authenticated"},
        )

    # Validate token format
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid token format"},
        )

    token = parts[1]

    # Validate token with proper DB session management
    db: Session = SessionLocal()
    try:
        payload = decode_access_token(token)
        if not payload or not payload.sub:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"},
            )

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

        # Add user and db session to request state
        request.state.current_user = user
        request.state.db = db

        response = await call_next(request)
        return response
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
