from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

router = APIRouter()

# Simple in‑memory user store for MVP (replace with DB)
users_db: dict[str, dict[str, str | None]] = {}


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/register")
def signup(user: UserCreate):
    if user.email in users_db:
        raise HTTPException(status_code=400, detail="User already exists")
    # NOTE: Store hashed passwords in production!
    users_db[user.email] = {"password": user.password, "name": user.name}
    return {"msg": "User created", "email": user.email}


@router.post("/login")
def login(user: UserLogin):
    stored_user = users_db.get(user.email)
    stored_pw = stored_user["password"] if stored_user else None
    if not stored_user or stored_pw != user.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Return a fake token for MVP
    return {
        "access_token": "fake-jwt-token",
        "token_type": "bearer",
        "email": user.email,
    }


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """
    MVP forgot-password endpoint.

    For security, always return success even if the user does not exist,
    so the endpoint does not leak account existence.
    """
    return {
        "detail": "If an account with that email exists, a reset link has been sent."
    }


@router.post("/signup")
def signup_legacy(user: UserCreate):
    """Legacy endpoint - use /register instead"""
    return signup(user)
