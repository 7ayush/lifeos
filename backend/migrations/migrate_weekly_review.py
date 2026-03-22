"""
Migration script to create weekly_reflections and focus_tasks tables
for the Weekly Review feature.

Usage:
    python -m backend.migrate_weekly_review
    python -m backend.migrate_weekly_review downgrade

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


def table_exists(cursor, table: str) -> bool:
    """Check if a table exists in the database."""
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cursor.fetchone() is not None


def upgrade():
    db_path = get_db_path(DATABASE_URL)
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Nothing to migrate.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if not table_exists(cursor, "weekly_reflections"):
        cursor.execute("""
            CREATE TABLE weekly_reflections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                week_identifier VARCHAR NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at DATETIME,
                updated_at DATETIME,
                CONSTRAINT uq_reflection_user_week UNIQUE (user_id, week_identifier)
            )
        """)
        cursor.execute("CREATE INDEX ix_weekly_reflections_id ON weekly_reflections (id)")
        print("  ✓ Created table: weekly_reflections")
    else:
        print("  – Table already exists: weekly_reflections")

    if not table_exists(cursor, "focus_tasks"):
        cursor.execute("""
            CREATE TABLE focus_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                task_id INTEGER NOT NULL REFERENCES tasks(id),
                week_identifier VARCHAR NOT NULL,
                created_at DATETIME,
                CONSTRAINT uq_focus_user_task_week UNIQUE (user_id, task_id, week_identifier)
            )
        """)
        cursor.execute("CREATE INDEX ix_focus_tasks_id ON focus_tasks (id)")
        print("  ✓ Created table: focus_tasks")
    else:
        print("  – Table already exists: focus_tasks")

    conn.commit()
    conn.close()
    print("\n✅ Upgrade complete.")


def downgrade():
    db_path = get_db_path(DATABASE_URL)
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Nothing to migrate.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if table_exists(cursor, "focus_tasks"):
        cursor.execute("DROP TABLE focus_tasks")
        print("  ✓ Dropped table: focus_tasks")
    else:
        print("  – Table does not exist: focus_tasks")

    if table_exists(cursor, "weekly_reflections"):
        cursor.execute("DROP TABLE weekly_reflections")
        print("  ✓ Dropped table: weekly_reflections")
    else:
        print("  – Table does not exist: weekly_reflections")

    conn.commit()
    conn.close()
    print("\n✅ Downgrade complete.")


if __name__ == "__main__":
    import sys

    db_path = get_db_path(DATABASE_URL)
    print(f"Database: {db_path}")

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        print("Running downgrade...")
        downgrade()
    else:
        print("Running upgrade...")
        upgrade()
