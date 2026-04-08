from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get("/{user_id}/settings", response_model=schemas.UserSettingsOut)
def get_user_settings(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user


@router.patch("/{user_id}/settings", response_model=schemas.UserSettingsOut)
def update_user_settings(
    user_id: int,
    settings: schemas.UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if settings.theme_preference is not None:
        current_user.theme_preference = settings.theme_preference
        db.commit()
        db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=schemas.User)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Users can only look up their own profile."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user
