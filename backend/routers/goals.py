from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/goals",
    tags=["goals"],
)

@router.post("/", response_model=schemas.Goal)
def create_goal_for_user(
    user_id: int, goal: schemas.GoalCreate, db: Session = Depends(get_db)
):
    return crud.create_user_goal(db=db, goal=goal, user_id=user_id)

@router.get("/", response_model=List[schemas.Goal])
def read_goals(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    goals = crud.get_user_goals(db, user_id=user_id, skip=skip, limit=limit)
    return goals
