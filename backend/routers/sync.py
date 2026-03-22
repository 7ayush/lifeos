from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import crud, schemas

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/habits/{user_id}")
def sync_habits_to_tasks(user_id: int, db: Session = Depends(get_db)):
    """
    Sync habits → tasks for a given user.
    Creates missing habit-tasks and removes orphaned ones.
    """
    result = crud.sync_habit_tasks(db, user_id)
    return result


@router.post("/recurring-tasks/{user_id}", response_model=schemas.RecurringSyncResponse)
def sync_recurring_tasks_endpoint(user_id: int, db: Session = Depends(get_db)):
    """
    Sync recurring task templates → instances for a given user.
    Creates missing task instances for the current period.
    """
    result = crud.sync_recurring_tasks(db, user_id)
    return result

@router.post("/notifications/{user_id}", response_model=schemas.NotificationSyncResponse)
def sync_notifications_endpoint(user_id: int, db: Session = Depends(get_db)):
    """
    Sync notifications for a given user.
    Generates notifications for upcoming, due-today, and overdue tasks.
    """
    result = crud.sync_notifications(db, user_id)
    return result


