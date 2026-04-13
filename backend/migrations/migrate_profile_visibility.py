"""
Migration script to add profile_visibility column to the users table.

This adds a 'profile_visibility' field with valid values: "public", "private".
Existing rows are set to "public" by default.

Usage:
    python -m backend.migrate_profile_visibility
    python -m backend.migrate_profile_visibility downgrade

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

    if not column_exists(cursor, "users", "profile_visibility"):
        cursor.execute("ALTER TABLE users ADD COLUMN profile_visibility TEXT DEFAULT 'public'")
        cursor.execute("UPDATE users SET profile_visibility = 'public' WHERE profile_visibility IS NULL")
        print("  ✓ Added column: profile_visibility")
    else:
        print("  – Column already exists: profile_visibility")

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

    if column_exists(cursor, "users", "profile_visibility"):
        cursor.execute("PRAGMA table_info(users)")
        columns_info = cursor.fetchall()
        columns = [col for col in columns_info if col[1] != "profile_visibility"]
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
        cursor.execute(f"CREATE TABLE users_backup ({', '.join(col_defs)})")
        cursor.execute(f"INSERT INTO users_backup ({col_names}) SELECT {col_names} FROM users")
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_backup RENAME TO users")
        cursor.execute("COMMIT")
        print("  ✓ Dropped column: profile_visibility")
    else:
        print("  – Column does not exist: profile_visibility")

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
