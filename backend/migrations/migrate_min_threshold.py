"""Add min_threshold_pct column to habits table."""
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifeos.db")


def migrate():
    if not DATABASE_URL.startswith("sqlite"):
        print("This migration script only supports SQLite.")
        return

    db_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(habits)")
    columns = [col[1] for col in cursor.fetchall()]

    if "min_threshold_pct" not in columns:
        cursor.execute("ALTER TABLE habits ADD COLUMN min_threshold_pct INTEGER DEFAULT 80")
        conn.commit()
        print("Added min_threshold_pct column to habits table.")
    else:
        print("min_threshold_pct column already exists.")

    conn.close()


if __name__ == "__main__":
    migrate()
