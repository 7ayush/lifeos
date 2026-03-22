"""
Migration script to create progress_snapshots and goal_milestones tables
for the Goal Progress Tracking feature.

Usage:
    python -m backend.migrate_goal_progress
    python -m backend.migrate_goal_progress downgrade

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

    if not table_exists(cursor, "progress_snapshots"):
        cursor.execute("""
            CREATE TABLE progress_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                progress INTEGER NOT NULL,
                CONSTRAINT uq_snapshot_goal_date UNIQUE (goal_id, date)
            )
        """)
        cursor.execute("CREATE INDEX ix_progress_snapshots_id ON progress_snapshots (id)")
        print("  ✓ Created table: progress_snapshots")
    else:
        print("  – Table already exists: progress_snapshots")

    if not table_exists(cursor, "goal_milestones"):
        cursor.execute("""
            CREATE TABLE goal_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                threshold INTEGER NOT NULL,
                achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_milestone_goal_threshold UNIQUE (goal_id, threshold)
            )
        """)
        cursor.execute("CREATE INDEX ix_goal_milestones_id ON goal_milestones (id)")
        print("  ✓ Created table: goal_milestones")
    else:
        print("  – Table already exists: goal_milestones")

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

    if table_exists(cursor, "goal_milestones"):
        cursor.execute("DROP TABLE goal_milestones")
        print("  ✓ Dropped table: goal_milestones")
    else:
        print("  – Table does not exist: goal_milestones")

    if table_exists(cursor, "progress_snapshots"):
        cursor.execute("DROP TABLE progress_snapshots")
        print("  ✓ Dropped table: progress_snapshots")
    else:
        print("  – Table does not exist: progress_snapshots")

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
