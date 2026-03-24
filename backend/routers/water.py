from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/api/water",
    tags=["water"],
)


@router.post("/entries", response_model=schemas.WaterEntryOut)
def create_entry(
    entry: schemas.WaterEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.create_water_entry(db, user_id=current_user.id, entry=entry)


@router.get("/entries", response_model=List[schemas.WaterEntryOut])
def get_entries(
    date: date = Query(..., description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_water_entries_by_date(db, user_id=current_user.id, target_date=date)


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = db.query(models.WaterEntry).filter(models.WaterEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(entry)
    db.commit()
    return {"message": "Entry deleted"}


@router.get("/progress", response_model=List[schemas.DailyProgressOut])
def get_progress(
    start_date: date = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: date = Query(..., description="End date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_daily_progress(db, user_id=current_user.id, start_date=start_date, end_date=end_date)


@router.put("/goal", response_model=schemas.WaterGoalOut)
def update_goal(
    goal: schemas.WaterGoalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.upsert_water_goal(db, user_id=current_user.id, amount_ml=goal.amount_ml)


@router.get("/goal", response_model=schemas.WaterGoalOut)
def get_goal(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    goal = crud.get_water_goal(db, user_id=current_user.id)
    if goal:
        return goal
    return schemas.WaterGoalOut(amount_ml=2000)
