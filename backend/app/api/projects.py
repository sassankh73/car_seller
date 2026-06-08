from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import Project, User
from app.middleware.auth import get_current_user, get_db_session

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str
    background: str  # studio key


class ProjectOut(BaseModel):
    id: int
    name: str
    background: str
    image_url: Optional[str] = None
    watermark_applied: Optional[bool] = False
    created_at: Optional[datetime] = None
    user_id: int

    class Config:
        from_attributes = True


@router.post("", response_model=ProjectOut)
def create_project(
    project: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Create a new project with user ownership."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not db:
        raise HTTPException(status_code=500, detail="Database session not available")
    db_project = Project(
        name=project.name,
        background=project.background,
        user_id=current_user.id,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("", response_model=List[ProjectOut])
def list_projects(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """List all projects owned by the current user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not db:
        raise HTTPException(status_code=500, detail="Database session not available")
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return projects


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Get a specific project by ID (user must be owner)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not db:
        raise HTTPException(status_code=500, detail="Database session not available")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Delete a project (user must be owner)."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not db:
        raise HTTPException(status_code=500, detail="Database session not available")
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"detail": "Project deleted successfully"}