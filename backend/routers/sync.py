from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from .. import crud, models, schemas

router = APIRouter(prefix="/sync", tags=["Sync"])


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/habits/{user_id}")
def sync_habits_to_tasks(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Sync habits → tasks for a given user.
    Creates missing habit-tasks and removes orphaned ones.
    """
    _verify_owner(current_user, user_id)
    result = crud.sync_habit_tasks(db, user_id)
    return result


@router.post("/recurring-tasks/{user_id}", response_model=schemas.RecurringSyncResponse)
def sync_recurring_tasks_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Sync recurring task templates → instances for a given user.
    Creates missing task instances for the current period.
    """
    _verify_owner(current_user, user_id)
    result = crud.sync_recurring_tasks(db, user_id)
    return result

@router.post("/notifications/{user_id}", response_model=schemas.NotificationSyncResponse)
def sync_notifications_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Sync notifications for a given user.
    Generates notifications for upcoming, due-today, and overdue tasks.
    """
    _verify_owner(current_user, user_id)
    result = crud.sync_notifications(db, user_id)
    return result
