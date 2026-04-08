from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..week_summary_engine import build_weekly_review, get_current_week_identifier, get_week_boundaries

router = APIRouter(tags=["weekly-review"])


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


def _validate_week(week: str):
    """Validate week identifier format, raising HTTP 422 on invalid format."""
    try:
        get_week_boundaries(week)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid week format. Expected YYYY-Www (e.g. 2025-W03)",
        )


@router.get(
    "/users/{user_id}/weekly-review",
    response_model=schemas.WeeklyReviewResponse,
)
def get_weekly_review(
    user_id: int,
    week: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    if week is None:
        week = get_current_week_identifier()
    try:
        data = build_weekly_review(db, user_id, week)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid week format. Expected YYYY-Www (e.g. 2025-W03)",
        )
    return data


@router.put(
    "/users/{user_id}/weekly-review/{week}/reflection",
    response_model=schemas.WeeklyReflectionOut,
)
def upsert_reflection(
    user_id: int,
    week: str,
    body: schemas.WeeklyReflectionIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    _validate_week(week)
    reflection = crud.upsert_weekly_reflection(db, user_id, week, body.content)
    return reflection


@router.post(
    "/users/{user_id}/weekly-review/{week}/focus-tasks",
    response_model=schemas.FocusTaskOut,
)
def add_focus_task(
    user_id: int,
    week: str,
    body: schemas.FocusTaskIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    _validate_week(week)

    # Check task exists
    task = db.query(models.Task).filter(models.Task.id == body.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check focus task limit
    count = crud.count_focus_tasks(db, user_id, week)
    if count >= 7:
        raise HTTPException(
            status_code=400,
            detail="Maximum of 7 focus tasks per week reached",
        )

    # Check for duplicate
    existing = (
        db.query(models.FocusTask)
        .filter(
            models.FocusTask.user_id == user_id,
            models.FocusTask.task_id == body.task_id,
            models.FocusTask.week_identifier == week,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Task is already a focus task for this week",
        )

    focus_task = crud.add_focus_task(db, user_id, body.task_id, week)
    # Eagerly load the task relationship for the response
    db.refresh(focus_task)
    task_obj = db.query(models.Task).filter(models.Task.id == focus_task.task_id).first()
    return schemas.FocusTaskOut(
        id=focus_task.id,
        user_id=focus_task.user_id,
        task_id=focus_task.task_id,
        week_identifier=focus_task.week_identifier,
        task_title=task_obj.title,
        task_status=task_obj.status,
        task_priority=task_obj.priority,
        created_at=focus_task.created_at,
    )


@router.delete("/users/{user_id}/weekly-review/{week}/focus-tasks/{task_id}")
def remove_focus_task(
    user_id: int,
    week: str,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    _validate_week(week)

    # Check focus task exists before removing
    existing = (
        db.query(models.FocusTask)
        .filter(
            models.FocusTask.user_id == user_id,
            models.FocusTask.task_id == task_id,
            models.FocusTask.week_identifier == week,
        )
        .first()
    )
    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Focus task not found for this week",
        )

    crud.remove_focus_task(db, user_id, task_id, week)
    return {"ok": True}


@router.post(
    "/users/{user_id}/weekly-review/{week}/focus-tasks/create",
    response_model=schemas.FocusTaskOut,
)
def create_and_add_focus_task(
    user_id: int,
    week: str,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    _validate_week(week)

    # Check focus task limit
    count = crud.count_focus_tasks(db, user_id, week)
    if count >= 7:
        raise HTTPException(
            status_code=400,
            detail="Maximum of 7 focus tasks per week reached",
        )

    # Create the new task
    new_task = crud.create_user_task(db=db, task=task_data, user_id=user_id)

    # Add it as a focus task
    focus_task = crud.add_focus_task(db, user_id, new_task.id, week)
    db.refresh(focus_task)
    return schemas.FocusTaskOut(
        id=focus_task.id,
        user_id=focus_task.user_id,
        task_id=focus_task.task_id,
        week_identifier=focus_task.week_identifier,
        task_title=new_task.title,
        task_status=new_task.status,
        task_priority=new_task.priority,
        created_at=focus_task.created_at,
    )
