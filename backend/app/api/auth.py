from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.models import User, get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_email,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Checks if the email already exists and creates a new user
    with a hashed password.
    """
    existing_user = get_user_by_email(db, email=user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = create_user(db, email=user.email, password=user.password, name=user.name)

    access_token = create_access_token(data={"sub": new_user.email})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=new_user.email,
        name=new_user.name,
    )


@router.post("/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and return a JWT token.

    Returns a 401 error if credentials are invalid.
    """
    db_user = authenticate_user(db, email=user.email, password=user.password)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": db_user.email})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        email=db_user.email,
        name=db_user.name,
    )


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    """
    Request a password reset.

    For security, always returns success even if the user does not exist,
    to prevent email enumeration attacks.
    """
    # In production, this would send a reset link via email
    return {
        "detail": "If an account with that email exists, a reset link has been sent."
    }


@router.post("/signup")
def signup_legacy(user: UserCreate, db: Session = Depends(get_db)):
    """Legacy endpoint - use /register instead"""
    return register(user, db)


@router.post("/token")
def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    OAuth2 compatible token login endpoint.

    Accepts username (email) and password from form data.
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}