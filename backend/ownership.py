"""Centralized resource ownership validation for FastAPI routes.

Provides a registry of ownership checker functions and a factory that
produces FastAPI ``Depends``-compatible callables.  Each checker looks up
a resource by ID (single DB query) and returns the resource together with
the ``user_id`` that owns it.

Checkers come in two flavours:

* **Simple** – ``(db, resource_id) -> (resource, owner_user_id) | None``
* **Multi-param** – ``(db, resource_id, path_params) -> …`` same return.

The factory inspects the checker's signature at call time and passes
``path_params`` only when the checker accepts three positional arguments.
"""

import inspect
from typing import Any, Callable, Dict, Optional, Tuple, Union

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from . import models

# ---------------------------------------------------------------------------
# Type aliases & registry
# ---------------------------------------------------------------------------

OwnershipChecker = Callable[[Session, int], Optional[Tuple[Any, int]]]
"""Simple signature: (db_session, resource_id) -> (resource, owner_user_id) | None"""

MultiParamOwnershipChecker = Callable[[Session, int, Dict[str, Any]], Optional[Tuple[Any, int]]]
"""Extended signature: (db_session, resource_id, path_params) -> (resource, owner_user_id) | None"""

_registry: Dict[str, Union[OwnershipChecker, MultiParamOwnershipChecker]] = {}


def register_ownership_checker(
    resource_type: str,
    checker: Union[OwnershipChecker, MultiParamOwnershipChecker],
) -> None:
    """Register an ownership checker for *resource_type*."""
    _registry[resource_type] = checker


def _checker_wants_path_params(checker: Callable) -> bool:
    """Return True when *checker* accepts ≥ 3 positional parameters."""
    try:
        sig = inspect.signature(checker)
        positional_kinds = {
            inspect.Parameter.POSITIONAL_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        }
        return (
            sum(1 for p in sig.parameters.values() if p.kind in positional_kinds)
            >= 3
        )
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Dependency factory
# ---------------------------------------------------------------------------

def require_ownership(
    resource_type: str,
    id_param: Optional[str] = None,
    error_detail: Optional[str] = None,
):
    """Return a FastAPI dependency that validates resource ownership.

    Parameters
    ----------
    resource_type:
        Key previously passed to ``register_ownership_checker``.
    id_param:
        Name of the path parameter that carries the resource ID.
        Defaults to ``"{resource_type}_id"`` (e.g. ``"notification_id"``).
    error_detail:
        Custom 404 message.  Defaults to ``"{Resource_type} not found"``.
    """

    if id_param is None:
        id_param = f"{resource_type}_id"
    if error_detail is None:
        error_detail = f"{resource_type.capitalize()} not found"

    async def _dependency(
        request: Request,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user),
    ) -> Any:
        # Extract the resource ID from path parameters
        resource_id = request.path_params.get(id_param)
        if resource_id is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )
        resource_id = int(resource_id)

        checker = _registry.get(resource_type)
        if checker is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No ownership checker registered for '{resource_type}'",
            )

        result = checker(db, resource_id, dict(request.path_params)) if _checker_wants_path_params(checker) else checker(db, resource_id)

        # Not found
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

        resource, owner_user_id = result

        # Wrong owner
        if owner_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )

        return resource

    return _dependency


# ---------------------------------------------------------------------------
# Checker registrations
# ---------------------------------------------------------------------------

def _check_notification(db: Session, notification_id: int):
    """Return (notification, owner_user_id) or None."""
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id)
        .first()
    )
    if notification is None:
        return None
    return (notification, notification.user_id)


register_ownership_checker("notification", _check_notification)


def _check_subtask(db: Session, subtask_id: int, path_params: Dict[str, Any]):
    """Return (subtask, owner_user_id) or None.

    Validates both that the subtask exists *and* that its ``task_id``
    matches the ``task_id`` present in the URL path (path consistency).
    """
    task_id_raw = path_params.get("task_id")
    if task_id_raw is None:
        return None
    task_id = int(task_id_raw)

    subtask = (
        db.query(models.SubTask)
        .join(models.Task, models.SubTask.task_id == models.Task.id)
        .filter(
            models.SubTask.id == subtask_id,
            models.SubTask.task_id == task_id,
        )
        .first()
    )
    if subtask is None:
        return None
    return (subtask, subtask.task.user_id)


register_ownership_checker("subtask", _check_subtask)


def _check_task(db: Session, task_id: int):
    """Return (task, owner_user_id) or None."""
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id)
        .first()
    )
    if task is None:
        return None
    return (task, task.user_id)


register_ownership_checker("task", _check_task)
