"""
Migration script to create water_entries and water_goals tables
for the Water Intake Tracker feature.

Usage:
    python -m backend.migrate_water_intake
    python -m backend.migrate_water_intake downgrade

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

    if not table_exists(cursor, "water_entries"):
        cursor.execute("""
            CREATE TABLE water_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                amount_ml INTEGER NOT NULL,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX ix_water_entries_id ON water_entries (id)")
        cursor.execute("CREATE INDEX ix_water_entries_user_id ON water_entries (user_id)")
        print("  ✓ Created table: water_entries")
    else:
        print("  – Table already exists: water_entries")

    if not table_exists(cursor, "water_goals"):
        cursor.execute("""
            CREATE TABLE water_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                amount_ml INTEGER NOT NULL DEFAULT 2000,
                updated_at DATETIME
            )
        """)
        cursor.execute("CREATE INDEX ix_water_goals_id ON water_goals (id)")
        print("  ✓ Created table: water_goals")
    else:
        print("  – Table already exists: water_goals")

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

    if table_exists(cursor, "water_entries"):
        cursor.execute("DROP TABLE water_entries")
        print("  ✓ Dropped table: water_entries")
    else:
        print("  – Table does not exist: water_entries")

    if table_exists(cursor, "water_goals"):
        cursor.execute("DROP TABLE water_goals")
        print("  ✓ Dropped table: water_goals")
    else:
        print("  – Table does not exist: water_goals")

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
