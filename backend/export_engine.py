"""Export engine — serialization and export building for LifeOS data."""

import csv
import io
import json
import zipfile
from datetime import date, datetime
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session, joinedload

from .models import Task, Goal, Habit, JournalEntry, Note

EXPORTABLE_TYPES = {"tasks", "goals", "habits", "journal", "notes"}

CSV_COLUMNS: Dict[str, List[str]] = {
    "tasks": [
        "id", "title", "description", "status", "priority", "energy_level",
        "estimated_minutes", "actual_minutes", "target_date", "created_at",
        "task_type", "tags",
    ],
    "goals": [
        "id", "title", "description", "status", "category", "priority",
        "target_date", "created_at", "progress",
    ],
    "habits": [
        "id", "title", "target_x", "target_y_days", "start_date",
        "current_streak", "frequency_type", "repeat_interval", "repeat_days",
    ],
    "journal": [
        "id", "entry_date", "content", "mood", "created_at",
    ],
    "notes": [
        "id", "title", "content", "folder", "created_at", "updated_at",
    ],
}


def query_export_data(
    db: Session,
    user_id: int,
    data_types: List[str],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, List[dict]]:
    """Query requested data types for a user with optional date filtering.

    Filters on ``created_at`` for most models, but uses ``entry_date`` for
    journal entries.  Returns a dict mapping data-type names to serialized
    record lists.
    """
    result: Dict[str, List[dict]] = {}

    for dtype in data_types:
        if dtype == "tasks":
            q = (
                db.query(Task)
                .options(joinedload(Task.subtasks), joinedload(Task.tags))
                .filter(Task.user_id == user_id)
            )
            if start_date is not None:
                q = q.filter(Task.created_at >= start_date)
            if end_date is not None:
                q = q.filter(Task.created_at <= end_date)
            result["tasks"] = serialize_tasks(q.all())

        elif dtype == "goals":
            q = (
                db.query(Goal)
                .options(joinedload(Goal.tasks))
                .filter(Goal.user_id == user_id)
            )
            if start_date is not None:
                q = q.filter(Goal.created_at >= start_date)
            if end_date is not None:
                q = q.filter(Goal.created_at <= end_date)
            result["goals"] = serialize_goals(q.all())

        elif dtype == "habits":
            q = (
                db.query(Habit)
                .options(joinedload(Habit.logs))
                .filter(Habit.user_id == user_id)
            )
            if start_date is not None:
                q = q.filter(Habit.start_date >= start_date)
            if end_date is not None:
                q = q.filter(Habit.start_date <= end_date)
            result["habits"] = serialize_habits(q.all())

        elif dtype == "journal":
            q = db.query(JournalEntry).filter(JournalEntry.user_id == user_id)
            if start_date is not None:
                q = q.filter(JournalEntry.entry_date >= start_date)
            if end_date is not None:
                q = q.filter(JournalEntry.entry_date <= end_date)
            result["journal"] = serialize_journal(q.all())

        elif dtype == "notes":
            q = db.query(Note).filter(Note.user_id == user_id)
            if start_date is not None:
                q = q.filter(Note.created_at >= start_date)
            if end_date is not None:
                q = q.filter(Note.created_at <= end_date)
            result["notes"] = serialize_notes(q.all())

    return result


def _str_or_none(value: Any) -> Any:
    """Convert date/datetime values to ISO strings, pass through others."""
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def serialize_tasks(tasks: List[Task]) -> List[dict]:
    """Convert Task ORM objects to export dicts, including subtasks and tags."""
    results = []
    for t in tasks:
        subtasks = [
            {"id": st.id, "title": st.title, "is_complete": st.is_complete}
            for st in (t.subtasks or [])
        ]
        tags = [tag.name for tag in (t.tags or [])]
        results.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "energy_level": t.energy_level,
            "estimated_minutes": t.estimated_minutes,
            "actual_minutes": t.actual_minutes,
            "target_date": _str_or_none(t.target_date),
            "created_at": _str_or_none(t.created_at),
            "task_type": t.task_type,
            "subtasks": subtasks,
            "tags": tags,
        })
    return results


def _compute_goal_progress_from_tasks(goal: Goal) -> int:
    """Compute goal progress as percentage of Done tasks. Returns 0 if no tasks."""
    tasks = goal.tasks
    if not tasks:
        return 0
    done = sum(1 for t in tasks if t.status == "Done")
    return int(round((done / len(tasks)) * 100))


def serialize_goals(goals: List[Goal]) -> List[dict]:
    """Convert Goal ORM objects to export dicts including progress."""
    results = []
    for g in goals:
        progress = _compute_goal_progress_from_tasks(g)
        results.append({
            "id": g.id,
            "title": g.title,
            "description": g.description,
            "status": g.status,
            "category": g.category,
            "priority": g.priority,
            "target_date": _str_or_none(g.target_date),
            "created_at": _str_or_none(g.created_at),
            "progress": progress,
        })
    return results


def serialize_habits(habits: List[Habit]) -> List[dict]:
    """Convert Habit ORM objects to export dicts, including logs."""
    results = []
    for h in habits:
        logs = [
            {"log_date": _str_or_none(log.log_date), "status": log.status}
            for log in (h.logs or [])
        ]
        results.append({
            "id": h.id,
            "title": h.title,
            "target_x": h.target_x,
            "target_y_days": h.target_y_days,
            "start_date": _str_or_none(h.start_date),
            "current_streak": h.current_streak,
            "frequency_type": h.frequency_type,
            "repeat_interval": h.repeat_interval,
            "repeat_days": h.repeat_days,
            "logs": logs,
        })
    return results


def serialize_journal(entries: List[JournalEntry]) -> List[dict]:
    """Convert JournalEntry ORM objects to export dicts."""
    return [
        {
            "id": e.id,
            "entry_date": _str_or_none(e.entry_date),
            "content": e.content,
            "mood": e.mood,
            "created_at": _str_or_none(e.created_at),
        }
        for e in entries
    ]


def serialize_notes(notes: List[Note]) -> List[dict]:
    """Convert Note ORM objects to export dicts."""
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "folder": n.folder,
            "created_at": _str_or_none(n.created_at),
            "updated_at": _str_or_none(n.updated_at),
        }
        for n in notes
    ]

def build_json_export(data: Dict[str, List[dict]], user_id: int) -> bytes:
    """Build JSON export with metadata envelope. Returns UTF-8 bytes."""
    export: Dict[str, Any] = {
        "metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "format": "json",
        },
    }
    for key, records in data.items():
        export[key] = records
    return json.dumps(export, ensure_ascii=False, indent=2).encode("utf-8")

def build_csv_single(data_type: str, records: List[dict]) -> bytes:
    """Build a single CSV file with UTF-8 BOM prefix. Returns bytes."""
    columns = CSV_COLUMNS[data_type]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for record in records:
        row = []
        for col in columns:
            value = record.get(col, "")
            # For tasks, join tags with semicolons
            if data_type == "tasks" and col == "tags":
                value = ";".join(value) if isinstance(value, list) else value
            if value is None:
                value = ""
            row.append(value)
        writer.writerow(row)
    csv_str = buf.getvalue()
    return b"\xef\xbb\xbf" + csv_str.encode("utf-8")


def build_csv_zip(data: Dict[str, List[dict]]) -> bytes:
    """Build a ZIP archive containing one CSV per data type. Returns bytes."""
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for data_type, records in data.items():
            csv_bytes = build_csv_single(data_type, records)
            zf.writestr(f"{data_type}.csv", csv_bytes)
    return zip_buf.getvalue()


