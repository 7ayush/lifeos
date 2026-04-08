from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..progress_engine import recalculate_goal_progress

router = APIRouter(
    prefix="/users/{user_id}/tasks",
    tags=["tasks"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/", response_model=schemas.Task)
def create_task_for_user(
    user_id: int,
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    try:
        return crud.create_user_task(db=db, task=task, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.get("/", response_model=List[schemas.Task])
def read_tasks(
    user_id: int, 
    start_date: str = None, 
    end_date: str = None, 
    skip: int = 0, 
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    tasks = crud.get_user_tasks(db, user_id=user_id, skip=skip, limit=limit)
    if start_date:
        tasks = [t for t in tasks if str(t.target_date) >= start_date]
    if end_date:
        tasks = [t for t in tasks if str(t.target_date) <= end_date]
    return tasks

@router.put("/reorder", response_model=List[schemas.Task])
def reorder_tasks_endpoint(
    user_id: int,
    request: schemas.ReorderRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    try:
        return crud.reorder_tasks(db, user_id, request.status, request.ordered_task_ids)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{task_id}", response_model=schemas.Task)
def update_task(
    user_id: int,
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    old_status = task.status
    try:
        updated_task = crud.update_task(db, task_id=task_id, task_update=task_update)
    except ValueError as e:
        error_msg = str(e)
        if "Cannot modify recurrence config on a task instance" in error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        raise HTTPException(status_code=422, detail=error_msg)

    # Trigger progress recalculation if task has a goal and status changed
    if updated_task.goal_id and task_update.status is not None and task_update.status != old_status:
        recalculate_goal_progress(db, updated_task.goal_id)

    return updated_task

@router.delete("/{task_id}")
def delete_task(
    user_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    success = crud.delete_task(db, task_id=task_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete task")
    return {"status": "success"}

# ============================
# SUBTASK ENDPOINTS
# ============================

@router.post("/{task_id}/subtasks", response_model=schemas.SubTask)
def create_subtask(
    user_id: int,
    task_id: int,
    subtask: schemas.SubTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return crud.create_subtask(db=db, subtask=subtask, task_id=task_id)

@router.patch("/{task_id}/subtasks/{subtask_id}/toggle", response_model=schemas.SubTask)
def toggle_subtask(
    user_id: int,
    task_id: int,
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    # Verify task belongs to user before toggling its subtask
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    subtask = crud.toggle_subtask(db, subtask_id=subtask_id)
    if not subtask:
        raise HTTPException(status_code=404, detail="SubTask not found")
    return subtask

@router.delete("/{task_id}/subtasks/{subtask_id}")
def delete_subtask(
    user_id: int,
    task_id: int,
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    # Verify task belongs to user before deleting its subtask
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    success = crud.delete_subtask(db, subtask_id=subtask_id)
    if not success:
        raise HTTPException(status_code=404, detail="SubTask not found")
    return {"status": "success"}
