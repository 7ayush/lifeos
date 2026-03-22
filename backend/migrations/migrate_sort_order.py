"""
Migration script to add sort_order column to the tasks table.

This adds a 'sort_order' integer field for persisting task ordering within
Kanban board columns. Existing rows default to 0.

Usage:
    python -m backend.migrate_sort_order
    python -m backend.migrate_sort_order downgrade

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


def upgrade():
    db_path = get_db_path(DATABASE_URL)
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}. Nothing to migrate.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if not column_exists(cursor, "tasks", "sort_order"):
        cursor.execute("ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0")
        cursor.execute("UPDATE tasks SET sort_order = 0 WHERE sort_order IS NULL")
        print("  ✓ Added column: sort_order")
    else:
        print("  – Column already exists: sort_order")

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

    if column_exists(cursor, "tasks", "sort_order"):
        cursor.execute("PRAGMA table_info(tasks)")
        columns_info = cursor.fetchall()
        columns = [col for col in columns_info if col[1] != "sort_order"]
        col_names = ", ".join(col[1] for col in columns)

        col_defs = []
        for col in columns:
            cid, name, col_type, notnull, default_val, pk = col
            parts = [name, col_type if col_type else "TEXT"]
            if pk:
                parts.append("PRIMARY KEY")
            if notnull and not pk:
                parts.append("NOT NULL")
            if default_val is not None:
                parts.append(f"DEFAULT {default_val}")
            col_defs.append(" ".join(parts))

        cursor.execute("BEGIN TRANSACTION")
        cursor.execute(f"CREATE TABLE tasks_backup ({', '.join(col_defs)})")
        cursor.execute(f"INSERT INTO tasks_backup ({col_names}) SELECT {col_names} FROM tasks")
        cursor.execute("DROP TABLE tasks")
        cursor.execute("ALTER TABLE tasks_backup RENAME TO tasks")
        cursor.execute("COMMIT")
        print("  ✓ Dropped column: sort_order")
    else:
        print("  – Column does not exist: sort_order")

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
