"""
Migration script to create tags and task_tags tables
for the Task Tags feature.

Usage:
    python -m backend.migrate_tags
    python -m backend.migrate_tags downgrade

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

    if not table_exists(cursor, "tags"):
        cursor.execute("""
            CREATE TABLE tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                name VARCHAR(30) NOT NULL,
                color VARCHAR,
                CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
            )
        """)
        cursor.execute("CREATE INDEX ix_tags_id ON tags (id)")
        print("  ✓ Created table: tags")
    else:
        print("  – Table already exists: tags")

    if not table_exists(cursor, "task_tags"):
        cursor.execute("""
            CREATE TABLE task_tags (
                task_id INTEGER NOT NULL REFERENCES tasks(id),
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, tag_id)
            )
        """)
        print("  ✓ Created table: task_tags")
    else:
        print("  – Table already exists: task_tags")

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

    if table_exists(cursor, "task_tags"):
        cursor.execute("DROP TABLE task_tags")
        print("  ✓ Dropped table: task_tags")
    else:
        print("  – Table does not exist: task_tags")

    if table_exists(cursor, "tags"):
        cursor.execute("DROP TABLE tags")
        print("  ✓ Dropped table: tags")
    else:
        print("  – Table does not exist: tags")

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
