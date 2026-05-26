from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()

# In‑memory store for demo purposes
projects_store = {}


class ProjectCreate(BaseModel):
    name: str
    background: str  # studio key


class ProjectOut(BaseModel):
    id: str
    name: str
    background: str
    image_url: Optional[str] = None


@router.post("/", response_model=ProjectOut)
def create_project(project: ProjectCreate, user: str = Depends(lambda: "demo_user")):
    import uuid

    proj_id = str(uuid.uuid4())
    projects_store[proj_id] = {
        "id": proj_id,
        "name": project.name,
        "background": project.background,
        "image_url": None,
    }
    return projects_store[proj_id]


@router.get("/", response_model=List[ProjectOut])
def list_projects(user: str = Depends(lambda: "demo_user")):
    return list(projects_store.values())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, user: str = Depends(lambda: "demo_user")):
    proj = projects_store.get(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj
