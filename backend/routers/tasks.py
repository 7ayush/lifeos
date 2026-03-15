from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/tasks",
    tags=["tasks"],
)

@router.post("/", response_model=schemas.Task)
def create_task_for_user(
    user_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)
):
    return crud.create_user_task(db=db, task=task, user_id=user_id)

@router.get("/", response_model=List[schemas.Task])
def read_tasks(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = crud.get_user_tasks(db, user_id=user_id, skip=skip, limit=limit)
    return tasks

@router.put("/{task_id}", response_model=schemas.Task)
def update_task(
    user_id: int, task_id: int, status: str = None, timeframe_view: str = None, db: Session = Depends(get_db)
):
    # Ensure task belongs to user
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    updated_task = crud.update_task_status_timeframe(db, task_id=task_id, status=status, timeframe_view=timeframe_view)
    return updated_task
