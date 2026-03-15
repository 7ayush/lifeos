from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/journal",
    tags=["journal"],
)

@router.post("/", response_model=schemas.JournalEntry)
def create_journal_entry_for_user(
    user_id: int, entry: schemas.JournalEntryCreate, db: Session = Depends(get_db)
):
    return crud.create_journal_entry(db=db, entry=entry, user_id=user_id)

@router.get("/", response_model=List[schemas.JournalEntry])
def read_journal_entries(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    entries = crud.get_user_journal_entries(db, user_id=user_id, skip=skip, limit=limit)
    return entries
