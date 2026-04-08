from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import crud, models, schemas
from ..auth import get_current_user

router = APIRouter(
    prefix="/users/{user_id}",
    tags=["notifications"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


# ============================
# NOTIFICATION ENDPOINTS
# ============================
# NOTE: read-all and unread-count routes MUST be defined before {notification_id}
# routes to avoid path parameter conflicts.

@router.get("/notifications", response_model=List[schemas.NotificationOut])
def get_user_notifications(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.get_user_notifications(db, user_id)


@router.get("/notifications/unread-count", response_model=schemas.UnreadCountResponse)
def get_unread_count(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    count = crud.get_unread_count(db, user_id)
    return {"count": count}


@router.put("/notifications/read-all")
def mark_all_notifications_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    crud.mark_all_notifications_read(db, user_id)
    return {"status": "ok"}


@router.put("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    user_id: int,
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    notification = crud.mark_notification_read(db, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.delete("/notifications/{notification_id}", response_model=schemas.NotificationOut)
def dismiss_notification(
    user_id: int,
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    notification = crud.dismiss_notification(db, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


# ============================
# REMINDER CONFIG ENDPOINTS
# ============================

@router.get("/reminder-config", response_model=schemas.ReminderConfigOut)
def get_reminder_config(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    return crud.get_reminder_config(db, user_id)


@router.put("/reminder-config", response_model=schemas.ReminderConfigOut)
def update_reminder_config(
    user_id: int,
    config: schemas.ReminderConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    try:
        return crud.update_reminder_config(db, user_id, config)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
