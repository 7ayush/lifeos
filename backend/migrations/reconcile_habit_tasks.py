"""Reconcile habit-task statuses with their HabitLog records.

Use case: habit logs that were inserted via raw SQL (e.g., seed_data.py)
bypass the log_habit() CRUD function, so their linked tasks never get
updated. This script walks every HabitLog and syncs the corresponding
habit-task's status using the same mapping as log_habit():

  HabitLog.Done   → Task.Done
  HabitLog.Missed → Task.Failed

Tasks with no matching log are left as-is. Run this once after seeding
or any direct DB manipulation of habit_logs.
"""
from backend.database import SessionLocal
from backend import models


STATUS_MAP = {"Done": "Done", "Missed": "Failed"}


def reconcile():
    db = SessionLocal()
    try:
        logs = db.query(models.HabitLog).all()
        updated = 0
        missing_tasks = 0
        already_synced = 0

        for log in logs:
            desired = STATUS_MAP.get(log.status)
            if desired is None:
                continue

            task = (
                db.query(models.Task)
                .filter(
                    models.Task.habit_id == log.habit_id,
                    models.Task.task_type == "habit",
                    models.Task.target_date == log.log_date,
                )
                .first()
            )
            if not task:
                missing_tasks += 1
                continue

            if task.status == desired:
                already_synced += 1
                continue

            task.status = desired
            updated += 1

        db.commit()
        print(f"Reconciled {updated} habit-tasks.")
        print(f"  Already in sync: {already_synced}")
        print(f"  Logs without a linked task: {missing_tasks}")
    finally:
        db.close()


if __name__ == "__main__":
    reconcile()
