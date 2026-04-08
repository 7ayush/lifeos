from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/users/{user_id}/notes",
    tags=["notes"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/", response_model=schemas.Note)
def create_note(
    user_id: int,
    note: schemas.NoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.create_note(db=db, note=note, user_id=user_id)

@router.get("/", response_model=List[schemas.Note])
def read_notes(
    user_id: int,
    folder: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.get_user_notes(db, user_id=user_id, folder=folder, skip=skip, limit=limit)

@router.put("/{note_id}", response_model=schemas.Note)
def update_note(
    user_id: int,
    note_id: int,
    note_update: schemas.NoteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return crud.update_note(db, note_id=note_id, note_update=note_update)

@router.delete("/{note_id}")
def delete_note(
    user_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == user_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    success = crud.delete_note(db, note_id=note_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete note")
    return {"status": "success"}
