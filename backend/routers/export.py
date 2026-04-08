"""Export router — handles data export requests for LifeOS users."""

from datetime import date, datetime
from typing import Optional
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from .. import models
from ..export_engine import (
    EXPORTABLE_TYPES,
    query_export_data,
    build_json_export,
    build_csv_single,
    build_csv_zip,
)

router = APIRouter(prefix="/users/{user_id}/export", tags=["export"])


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/")
def export_data(
    user_id: int,
    format: str = Query("json"),
    types: str = Query(""),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)

    # Validate format
    if format not in ("json", "csv"):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid format '{format}'. Must be 'json' or 'csv'.",
        )

    # Parse and validate types
    requested = [t.strip() for t in types.split(",") if t.strip()]
    valid_types = [t for t in requested if t in EXPORTABLE_TYPES]
    if not valid_types:
        raise HTTPException(
            status_code=422,
            detail="No valid data types provided. Choose from: "
            + ", ".join(sorted(EXPORTABLE_TYPES)),
        )

    # Parse and validate dates
    parsed_start: Optional[date] = None
    parsed_end: Optional[date] = None

    if start_date is not None:
        try:
            parsed_start = date.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid start_date '{start_date}'. Expected format: YYYY-MM-DD.",
            )

    if end_date is not None:
        try:
            parsed_end = date.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid end_date '{end_date}'. Expected format: YYYY-MM-DD.",
            )

    # Query data
    data = query_export_data(db, user_id, valid_types, parsed_start, parsed_end)

    # Build filename
    today = date.today().isoformat()

    if format == "json":
        content = build_json_export(data, user_id)
        filename = f"lifeos-export-{today}.json"
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # CSV format
    if len(valid_types) == 1:
        dtype = valid_types[0]
        content = build_csv_single(dtype, data.get(dtype, []))
        filename = f"lifeos-export-{today}.csv"
        return StreamingResponse(
            io.BytesIO(content),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # Multiple types → ZIP
    content = build_csv_zip(data)
    filename = f"lifeos-export-{today}.zip"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
