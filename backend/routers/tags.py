from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/tags",
    tags=["tags"],
)


@router.post("/", response_model=schemas.TagOut)
def create_tag(user_id: int, tag: schemas.TagCreate, db: Session = Depends(get_db)):
    return crud.create_tag(db=db, user_id=user_id, tag=tag)


@router.get("/", response_model=List[schemas.TagOut])
def list_tags(user_id: int, db: Session = Depends(get_db)):
    return crud.get_user_tags(db=db, user_id=user_id)


@router.put("/{tag_id}", response_model=schemas.TagOut)
def update_tag(
    user_id: int, tag_id: int, tag: schemas.TagUpdate, db: Session = Depends(get_db)
):
    return crud.update_tag(db=db, tag_id=tag_id, user_id=user_id, tag_update=tag)


@router.delete("/{tag_id}")
def delete_tag(user_id: int, tag_id: int, db: Session = Depends(get_db)):
    crud.delete_tag(db=db, tag_id=tag_id, user_id=user_id)
    return {"ok": True}
