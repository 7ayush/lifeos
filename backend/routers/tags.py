from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/users/{user_id}/tags",
    tags=["tags"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/", response_model=schemas.TagOut)
def create_tag(
    user_id: int,
    tag: schemas.TagCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.create_tag(db=db, user_id=user_id, tag=tag)


@router.get("/", response_model=List[schemas.TagOut])
def list_tags(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.get_user_tags(db=db, user_id=user_id)


@router.put("/{tag_id}", response_model=schemas.TagOut)
def update_tag(
    user_id: int,
    tag_id: int,
    tag: schemas.TagUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.update_tag(db=db, tag_id=tag_id, user_id=user_id, tag_update=tag)


@router.delete("/{tag_id}")
def delete_tag(
    user_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    crud.delete_tag(db=db, tag_id=tag_id, user_id=user_id)
    return {"ok": True}
