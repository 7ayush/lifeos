from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..progress_engine import batch_compute_progress, recalculate_goal_progress

router = APIRouter(
    prefix="/users/{user_id}/goals",
    tags=["goals"],
)


def _verify_owner(current_user: models.User, user_id: int):
    """Ensure the authenticated user matches the URL user_id."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/", response_model=schemas.Goal)
def create_goal_for_user(
    user_id: int,
    goal: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.create_user_goal(db=db, goal=goal, user_id=user_id)

@router.get("/", response_model=List[schemas.GoalWithProgress])
def read_goals(
    user_id: int,
    skip: int = 0,
    limit: int = Query(default=100, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    goals = crud.get_user_goals(db, user_id=user_id, skip=skip, limit=limit)
    goal_ids = [g.id for g in goals]
    progress_map = batch_compute_progress(db, goal_ids)
    result = []
    for g in goals:
        goal_data = schemas.GoalWithProgress.model_validate(g)
        goal_data.progress = progress_map.get(g.id, 0)
        result.append(goal_data)
    return result

@router.get("/{goal_id}", response_model=schemas.GoalDetailWithHistory)
def get_goal_detail(
    user_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    detail = crud.get_goal_detail(db, goal_id=goal_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Goal not found")
    if detail["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Recalculate progress (triggers side effects: snapshot, milestones, auto-complete)
    progress = recalculate_goal_progress(db, goal_id)

    # Fetch milestones ordered by threshold
    milestones = (
        db.query(models.GoalMilestone)
        .filter(models.GoalMilestone.goal_id == goal_id)
        .order_by(models.GoalMilestone.threshold)
        .all()
    )

    # Fetch progress history ordered by date descending
    progress_history = (
        db.query(models.ProgressSnapshot)
        .filter(models.ProgressSnapshot.goal_id == goal_id)
        .order_by(models.ProgressSnapshot.date.desc())
        .all()
    )

    detail["progress"] = progress
    detail["milestones"] = milestones
    detail["progress_history"] = progress_history
    return detail

@router.put("/{goal_id}", response_model=schemas.Goal)
def update_goal(
    user_id: int,
    goal_id: int,
    goal: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    existing = crud.get_goal(db, goal_id=goal_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    if existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return crud.update_user_goal(db=db, goal_id=goal_id, goal=goal)

@router.delete("/{goal_id}")
def delete_goal(
    user_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    existing = crud.get_goal(db, goal_id=goal_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    if existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    crud.delete_user_goal(db=db, goal_id=goal_id)
    return {"ok": True}

@router.get("/{goal_id}/progress")
def get_goal_progress(
    user_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    existing = crud.get_goal(db, goal_id=goal_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Goal not found")
    if existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    progress = crud.compute_goal_progress(db, goal_id=goal_id)
    return {"goal_id": goal_id, "progress": progress}
