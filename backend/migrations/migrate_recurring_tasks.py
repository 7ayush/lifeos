"""
Migration script to add recurrence fields to the tasks table for recurring task support.
Run this once to update the existing database schema.

Usage:
    python -m backend.migrate_recurring_tasks
"""

import sqlite3
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifeos.db")


def get_db_path(url: str) -> str:
    """Extract the file path from a sqlite:/// URL."""
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    raise ValueError(f"Unsupported DATABASE_URL: {url}")


DB_PATH = get_db_path(DATABASE_URL)

COLUMNS_TO_ADD = [
    ("parent_task_id", "INTEGER REFERENCES tasks(id)"),
    ("frequency_type", "TEXT"),
    ("repeat_interval", "INTEGER DEFAULT 1"),
    ("repeat_days", "TEXT"),
    ("ends_type", "TEXT"),
    ("ends_on_date", "DATE"),
    ("ends_after_occurrences", "INTEGER"),
]


def get_existing_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}


def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    existing = get_existing_columns(cursor, "tasks")
    added = []

    for col_name, col_def in COLUMNS_TO_ADD:
        if col_name not in existing:
            cursor.execute(f"ALTER TABLE tasks ADD COLUMN {col_name} {col_def}")
            added.append(col_name)
            print(f"  ✓ Added column: {col_name}")
        else:
            print(f"  – Column already exists: {col_name}")

    conn.commit()
    conn.close()

    if added:
        print(f"\n✅ Migration complete. Added {len(added)} column(s).")
    else:
        print("\n✅ No changes needed. All columns already exist.")


if __name__ == "__main__":
    print(f"Migrating database: {DB_PATH}")
    migrate()
