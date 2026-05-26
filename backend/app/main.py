from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, projects, studio
from .api.billing import routes as billing_routes

app = FastAPI(title="AutoStudio AI Backend")

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
