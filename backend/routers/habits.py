import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/habits",
    tags=["habits"],
)

@router.post("/", response_model=schemas.Habit)
def create_habit_for_user(
    user_id: int, habit: schemas.HabitCreate, db: Session = Depends(get_db)
):
    return crud.create_user_habit(db=db, habit=habit, user_id=user_id)

@router.get("/", response_model=List[schemas.Habit])
def read_habits(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    habits = crud.get_user_habits(db, user_id=user_id, skip=skip, limit=limit)
    return habits

@router.post("/{habit_id}/log", response_model=schemas.Habit)
def log_habit_status(
    user_id: int, habit_id: int, status: str, log_date: Optional[datetime.date] = None, db: Session = Depends(get_db)
):
    if log_date is None:
        log_date = datetime.date.today()
    
    if log_date > datetime.date.today():
        raise HTTPException(status_code=400, detail="Cannot log status for future dates")
    
    if status not in ["Done", "Missed"]:
        raise HTTPException(status_code=400, detail="Status must be 'Done' or 'Missed'")

    # Validate habit exists and belongs to user
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id, models.Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    crud.log_habit(db=db, habit_id=habit_id, status=status, log_date=log_date)
    
    # Return updated habit
    return habit

@router.put("/{habit_id}", response_model=schemas.Habit)
def update_habit(
    user_id: int, habit_id: int, habit_update: schemas.HabitUpdate, db: Session = Depends(get_db)
):
    # Validate habit exists and belongs to user
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id, models.Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    return crud.update_user_habit(db=db, habit_id=habit_id, habit=habit_update)

@router.delete("/{habit_id}")
def delete_habit(user_id: int, habit_id: int, db: Session = Depends(get_db)):
    # Validate habit exists and belongs to user
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id, models.Habit.user_id == user_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    
    success = crud.delete_user_habit(db=db, habit_id=habit_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete habit")
    
    return {"message": "Habit deleted successfully"}
