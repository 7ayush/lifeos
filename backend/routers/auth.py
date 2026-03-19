from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import verify_google_token, create_access_token, get_current_user

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.post("/google", response_model=schemas.TokenResponse)
def google_login(request: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Google OAuth. Creates a new user if first login."""
    google_info = verify_google_token(request.credential)

    google_id = google_info["sub"]
    email = google_info.get("email", "")
    name = google_info.get("name", "")
    picture = google_info.get("picture", "")

    # Check if user exists by google_id first, then by email
    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            # Link existing email-based account to Google
            user.google_id = google_id
            user.avatar_url = picture or user.avatar_url
        else:
            # Create new user
            user = models.User(
                email=email,
                username=name,
                google_id=google_id,
                avatar_url=picture,
                password_hash="",
            )
            db.add(user)

    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})
    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserProfile.model_validate(user),
    )


@router.get("/me", response_model=schemas.UserProfile)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.put("/me", response_model=schemas.UserProfile)
def update_me(
    update: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update the authenticated user's profile."""
    if update.username is not None:
        current_user.username = update.username
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user
