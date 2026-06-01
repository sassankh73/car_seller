from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from .api import auth, projects, studio
from .api.billing import routes as billing_routes


class TrailingSlashMiddleware(BaseHTTPMiddleware):
    """
    Middleware to normalize paths by adding trailing slashes for API routes.
    This prevents FastAPI from issuing redirects that leak internal hostnames.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        # Only normalize API routes that don't already have trailing slash
        if path.startswith("/api/") and not path.endswith("/"):
            # Check if path with trailing slash would match a route
            normalized_path = path + "/"
            request.scope["path"] = normalized_path
        response = await call_next(request)
        return response


app = FastAPI(title="AutoStudio AI Backend", redirect_slashes=False)

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
app.include_router(billing_routes.router, prefix="/api/billing", tags=["billing"])
