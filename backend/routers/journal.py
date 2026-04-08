from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/users/{user_id}/journal",
    tags=["journal"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/", response_model=schemas.JournalEntry)
def create_journal_entry_for_user(
    user_id: int,
    entry: schemas.JournalEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.create_journal_entry(db=db, entry=entry, user_id=user_id)

@router.get("/", response_model=List[schemas.JournalEntry])
def read_journal_entries(
    user_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    entries = crud.get_user_journal_entries(db, user_id=user_id, skip=skip, limit=limit)
    return entries

@router.put("/{entry_id}", response_model=schemas.JournalEntry)
def update_journal_entry(
    user_id: int,
    entry_id: int,
    entry: schemas.JournalEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    # Ensure entry belongs to user
    db_entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id, models.JournalEntry.user_id == user_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    return crud.update_journal_entry(db, entry_id=entry_id, entry=entry)

@router.delete("/{entry_id}")
def delete_journal_entry(
    user_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    # Ensure entry belongs to user
    db_entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id, models.JournalEntry.user_id == user_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    success = crud.delete_journal_entry(db, entry_id=entry_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete journal entry")
    return {"status": "success"}
