"""
Migration script to add habit_id and task_type columns to the tasks table.

This is needed for existing databases where SQLAlchemy's create_all()
won't add new columns to already-existing tables.

Usage:
    python -m backend.migrate_habit_task_sync

This script is idempotent — safe to run multiple times.
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


def column_exists(cursor, table: str, column: str) -> bool:
    """Check if a column exists in a table using PRAGMA."""
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def migrate():
    db_path = get_db_path(DATABASE_URL)
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Nothing to migrate.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if not column_exists(cursor, "tasks", "habit_id"):
        cursor.execute("ALTER TABLE tasks ADD COLUMN habit_id INTEGER REFERENCES habits(id)")
        print("Added 'habit_id' column to tasks table.")
    else:
        print("'habit_id' column already exists. Skipping.")

    if not column_exists(cursor, "tasks", "task_type"):
        cursor.execute("ALTER TABLE tasks ADD COLUMN task_type VARCHAR DEFAULT 'manual'")
        print("Added 'task_type' column to tasks table.")
    else:
        print("'task_type' column already exists. Skipping.")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate()
