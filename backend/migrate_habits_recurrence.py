"""
Migration script to add recurrence fields to the habits table.
Run this once to update the existing database schema.

Usage:
    python -m backend.migrate_habits_recurrence
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "lifeos.db")

COLUMNS_TO_ADD = [
    ("frequency_type", "TEXT DEFAULT 'flexible'"),
    ("repeat_interval", "INTEGER DEFAULT 1"),
    ("repeat_days", "TEXT"),
    ("ends_type", "TEXT DEFAULT 'never'"),
    ("ends_on_date", "DATE"),
    ("ends_after_occurrences", "INTEGER"),
]


def get_existing_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}


def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    existing = get_existing_columns(cursor, "habits")
    added = []

    for col_name, col_def in COLUMNS_TO_ADD:
        if col_name not in existing:
            cursor.execute(f"ALTER TABLE habits ADD COLUMN {col_name} {col_def}")
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
