"""
Seed LifeOS with Ayush's personal routine — 90-Day Sprint Edition.

Reads the routine defined in /seedingRoutine.txt and creates:
  • 9 Goals covering career, wealth, gym, running, morning routine, steps,
    recovery, mind-body, and devotion.
  • Habits mapped to each goal (daily / weekly per routine).
  • One habit-linked task per habit (mirroring crud.create_user_habit).
  • Water goal set to 3000 ml.
  • Default reminder config.

Target user: ayush.kaushik711@gmail.com
  - Created on first run if they don't exist.
  • On re-run, ALL of the user's data is wiped and re-seeded (goals,
    habits, tasks, water goal, journals, notes, water entries, tags,
    reflections, focus tasks, notifications). The user row itself is
    preserved. Pass --keep-personal to preserve journals/notes/water
    entries/tags across re-seeds.

Usage (from project root):
    .venv/bin/python -m backend.seed_personal_routine              # full re-seed (default)
    .venv/bin/python -m backend.seed_personal_routine --keep-personal  # preserve journals/notes/water entries/tags

Works with both SQLite and PostgreSQL (uses the SQLAlchemy session).
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

# Load backend/.env BEFORE importing database so DATABASE_URL is picked up
# regardless of the cwd the script is invoked from.
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy.orm import Session

from .database import SessionLocal, engine
from . import models

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TARGET_EMAIL = "ayush.kaushik711@gmail.com"
TARGET_USERNAME = "Ayush Kaushik"

# All goals have a 180-day target date from the sprint start date.
GOAL_HORIZON_DAYS = 180

# Sprint kicks off on Wed 29 April 2026. All habits use this as start_date,
# and all goals use this + GOAL_HORIZON_DAYS as target_date.
SPRINT_START_DATE = date(2026, 4, 29)

WATER_GOAL_ML = 3000

# Weekdays for repeat_days (0 = Sun, 1 = Mon, ..., 6 = Sat)
ALL_DAYS = "0,1,2,3,4,5,6"
MON_SAT  = "1,2,3,4,5,6"
MWFSS    = "1,3,5,6,0"     # Mon, Wed, Fri, Sat, Sun
MON      = "1"
TUE      = "2"
WED      = "3"
THU      = "4"
FRI      = "5"
SAT      = "6"
SUN      = "0"


# ---------------------------------------------------------------------------
# Goal & Habit definitions — aligned to the 90-Day Sprint routine.
# ---------------------------------------------------------------------------

GOAL_DEFS = [
    {
        "key": "career",
        "title": "Career: SDE-2 Sprint",
        "description": "Secure a 50+ LPA SDE-2 offer within 90 days via DSA, system design, and mock interviews.",
        "category": "Area",
        "priority": "High",
    },
    {
        "key": "wealth",
        "title": "Wealth & Startup",
        "description": "Launch MVP infrastructure and manage personal finance via daily deep work and portfolio review.",
        "category": "Project",
        "priority": "High",
    },
    {
        "key": "gym",
        "title": "Gym — 7-Day Hybrid Split",
        "description": "Execute the Push / Pull / Legs / Rest / Upper / Lower / Rest split consistently.",
        "category": "Area",
        "priority": "High",
    },
    {
        "key": "running",
        "title": "Half Marathon Mastery",
        "description": "Build endurance for a half marathon — daily short runs with a weekly long run.",
        "category": "Project",
        "priority": "High",
    },
    {
        "key": "morning",
        "title": "Morning Routine",
        "description": "Daily bodyweight conditioning outside the gym — activation and mobility.",
        "category": "Area",
        "priority": "High",
    },
    {
        "key": "mind",
        "title": "Mind, Body & Intellect",
        "description": "Recovery, movement floor, reading, grooming, journaling, and devotion — the foundation that holds everything else up.",
        "category": "Area",
        "priority": "High",
    },
]


# Habits — (goal_key, title, frequency_type, repeat_days, min_threshold_pct)
#
# frequency_type semantics used in this codebase:
#   "daily"   → occurs on the days listed in repeat_days
#   "weekly"  → recurs on specific weekday(s) each week
HABIT_DEFS = [
    # --- CAREER: SDE-2 SPRINT (all daily) ---
    ("career",   "DSA practice (45 min)",               "daily",  ALL_DAYS, 80),
    ("career",   "System Design concept (20 min)",       "daily",  ALL_DAYS, 80),
    ("career",   "Mock interview / HLD deep dive",       "daily",  ALL_DAYS, 90),

    # --- WEALTH & STARTUP ---
    ("wealth",   "Startup deep work (1 hour)",           "daily",  ALL_DAYS, 90),
    ("wealth",   "SOIC / F&O review — Mon/Wed/Fri/Sat/Sun","weekly", MWFSS,    70),

    # --- GYM: 7-DAY HYBRID SPLIT (weekly per split day) ---
    ("gym",      "Push day — Mon (hypertrophy)",         "weekly", MON,      90),
    ("gym",      "Pull day — Tue",                       "weekly", TUE,      90),
    ("gym",      "Legs day + prehab — Wed",              "weekly", WED,      90),
    ("gym",      "Rest day — Thu (active recovery)",     "weekly", THU,      80),
    ("gym",      "Upper volume day — Fri",               "weekly", FRI,      90),
    ("gym",      "Lower / shoulders & legs — Sat",       "weekly", SAT,      90),
    ("gym",      "Rest day — Sun (core + conditioning)", "weekly", SUN,      80),

    # --- HALF MARATHON MASTERY ---
    ("running",  "Daily 3–5 km run (Mon–Sat)",           "daily",  MON_SAT,  80),
    ("running",  "Long run 15 km — Sun",                 "weekly", SUN,      90),

    # --- MORNING ROUTINE (all daily) ---
    ("morning",  "Skipping",                             "daily",  ALL_DAYS, 80),
    ("morning",  "Squats",                               "daily",  ALL_DAYS, 80),
    ("morning",  "Pullups",                              "daily",  ALL_DAYS, 70),
    ("morning",  "Pushups",                              "daily",  ALL_DAYS, 80),
    ("morning",  "Plank",                                "daily",  ALL_DAYS, 80),
    ("morning",  "Jumping (box / broad)",                "daily",  ALL_DAYS, 75),

    # --- 10K STEPS (absorbed into Mind, Body & Intellect) ---
    ("mind",     "10K steps",                            "daily",  ALL_DAYS, 80),

    # --- RECOVERY (absorbed into Mind, Body & Intellect) ---
    ("mind",     "Sleep cycle (10:00 PM — 5:30 AM)",     "daily",  ALL_DAYS, 85),
    ("mind",     "Hydration (3000 ml)",                  "daily",  ALL_DAYS, 80),

    # --- MIND, BODY & INTELLECT (all daily) ---
    ("mind",     "Read 10 pages (pre-sleep)",            "daily",  ALL_DAYS, 80),
    ("mind",     "Meditation (5 min, morning)",          "daily",  ALL_DAYS, 70),
    ("mind",     "Topical hair-care regimen",            "daily",  ALL_DAYS, 90),
    ("mind",     "Journal entry & mood log",             "daily",  ALL_DAYS, 100),
    ("mind",     "No cheat meal & no sugar",             "daily",  ALL_DAYS, 95),

    # --- DEVOTION (absorbed into Mind, Body & Intellect) ---
    ("mind",     "Morning pooja",                        "daily",  ALL_DAYS, 85),
    ("mind",     "Mandir visit",                         "daily",  ALL_DAYS, 70),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_or_create_user(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.email == TARGET_EMAIL).first()
    if user:
        print(f"  ✓ Found existing user #{user.id} <{user.email}>")
        return user

    user = models.User(
        email=TARGET_EMAIL,
        username=TARGET_USERNAME,
        password_hash="",  # OAuth-only; real login will link google_id later
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  ✓ Created user #{user.id} <{user.email}>")
    return user


def wipe_user_routine(db: Session, user_id: int, keep_personal: bool = False) -> None:
    """Remove the user's data so re-seeds are idempotent.

    By default, EVERYTHING belonging to the user is wiped (goals, habits, tasks,
    water goal, journals, notes, water entries, tags, reflections, focus tasks,
    notifications, reminder config) except the user row itself.

    Pass keep_personal=True to preserve journal entries, notes, water entries,
    and tags across re-seeds.
    """
    # Order matters for FK constraints — children first.
    task_ids = [t.id for t in db.query(models.Task).filter(models.Task.user_id == user_id).all()]
    habit_ids = [h.id for h in db.query(models.Habit).filter(models.Habit.user_id == user_id).all()]
    goal_ids = [g.id for g in db.query(models.Goal).filter(models.Goal.user_id == user_id).all()]

    if task_ids:
        db.query(models.SubTask).filter(models.SubTask.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(models.FocusTask).filter(models.FocusTask.task_id.in_(task_ids)).delete(synchronize_session=False)
        # task_tags is an association table — delete via raw query
        from sqlalchemy import text
        db.execute(text("DELETE FROM task_tags WHERE task_id IN :ids").bindparams(ids=tuple(task_ids) or (0,)))

    if habit_ids:
        db.query(models.HabitLog).filter(models.HabitLog.habit_id.in_(habit_ids)).delete(synchronize_session=False)

    if goal_ids:
        db.query(models.ProgressSnapshot).filter(models.ProgressSnapshot.goal_id.in_(goal_ids)).delete(synchronize_session=False)
        db.query(models.GoalMilestone).filter(models.GoalMilestone.goal_id.in_(goal_ids)).delete(synchronize_session=False)

    # Core routine structures — always wiped
    db.query(models.Task).filter(models.Task.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Habit).filter(models.Habit.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Goal).filter(models.Goal.user_id == user_id).delete(synchronize_session=False)
    db.query(models.WaterGoal).filter(models.WaterGoal.user_id == user_id).delete(synchronize_session=False)
    db.query(models.WeeklyReflection).filter(models.WeeklyReflection.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)
    db.query(models.FocusTask).filter(models.FocusTask.user_id == user_id).delete(synchronize_session=False)
    db.query(models.ReminderConfig).filter(models.ReminderConfig.user_id == user_id).delete(synchronize_session=False)

    if not keep_personal:
        # Wipe personal data too (default behavior).
        # journal_tags have no user_id column — scope by the user's journal entries first.
        journal_ids = [j.id for j in db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user_id).all()]
        if journal_ids:
            db.query(models.JournalTag).filter(models.JournalTag.journal_entry_id.in_(journal_ids)).delete(synchronize_session=False)
        db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Note).filter(models.Note.user_id == user_id).delete(synchronize_session=False)
        db.query(models.WaterEntry).filter(models.WaterEntry.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Tag).filter(models.Tag.user_id == user_id).delete(synchronize_session=False)

    db.commit()
    scope = "routine only (personal data preserved)" if keep_personal else "everything"
    print(f"  ✓ Wiped {scope} for user #{user_id}")


def seed_goals(db: Session, user_id: int) -> dict[str, int]:
    """Create the goals and return a {key: goal_id} map. All goals target +180 days from sprint start."""
    target = SPRINT_START_DATE + timedelta(days=GOAL_HORIZON_DAYS)
    goal_ids: dict[str, int] = {}
    for g in GOAL_DEFS:
        goal = models.Goal(
            user_id=user_id,
            title=g["title"],
            description=g["description"],
            status="Active",
            category=g["category"],
            priority=g["priority"],
            target_date=target,
        )
        db.add(goal)
        db.flush()  # assign id without committing
        goal_ids[g["key"]] = goal.id
    db.commit()
    print(f"  ✓ Created {len(goal_ids)} goals (sprint start: {SPRINT_START_DATE.isoformat()}, target: {target.isoformat()})")
    for g in GOAL_DEFS:
        print(f"      • {g['title']}")
    return goal_ids


def seed_habits_and_tasks(db: Session, user_id: int, goal_ids: dict[str, int]) -> int:
    """Create habits. Habit-tasks are NOT pre-created — they're generated by
    sync_habit_tasks on each period start (daily / weekly / monthly) so the
    Tasks view stays uncluttered until the work is actually due."""
    start = SPRINT_START_DATE
    habit_count = 0

    for goal_key, title, freq, repeat_days, threshold in HABIT_DEFS:
        habit = models.Habit(
            user_id=user_id,
            goal_id=goal_ids[goal_key],
            title=title,
            # Legacy NOT NULL columns — keep 0 for scheduled habits (see crud.create_user_habit)
            target_x=0,
            target_y_days=0,
            current_streak=0,
            start_date=start,
            frequency_type=freq,
            repeat_interval=1,
            repeat_days=repeat_days,
            ends_type="never",
            ends_on_date=None,
            ends_after_occurrences=None,
            min_threshold_pct=threshold,
        )
        db.add(habit)
        db.flush()
        habit_count += 1

    db.commit()
    print(f"  ✓ Created {habit_count} habits (start_date: {start.isoformat()}, tasks will auto-generate daily via /sync/habits)")
    return habit_count


def seed_water_goal(db: Session, user_id: int) -> None:
    wg = models.WaterGoal(user_id=user_id, amount_ml=WATER_GOAL_ML)
    db.add(wg)
    db.commit()
    print(f"  ✓ Set water goal to {WATER_GOAL_ML} ml")


def seed_reminder_config(db: Session, user_id: int) -> None:
    """Sensible defaults so notifications work out of the box."""
    db.add(models.ReminderConfig(
        user_id=user_id,
        remind_days_before=1,
        remind_on_due_date=1,
        remind_when_overdue=1,
    ))
    db.commit()
    print("  ✓ Set reminder config (1 day before, on due date, when overdue)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Seed LifeOS with Ayush's personal routine.")
    parser.add_argument(
        "--keep-personal",
        action="store_true",
        help="Preserve journal entries, notes, water entries, and tags across re-seeds "
             "(default is to wipe everything belonging to the user).",
    )
    args = parser.parse_args()

    # Ensure schema exists (safe no-op if already created)
    models.Base.metadata.create_all(bind=engine)

    print(f"\nSeeding LifeOS personal routine for <{TARGET_EMAIL}>...\n")
    db: Session = SessionLocal()
    try:
        user = get_or_create_user(db)
        wipe_user_routine(db, user.id, keep_personal=args.keep_personal)
        goal_ids = seed_goals(db, user.id)
        seed_habits_and_tasks(db, user.id, goal_ids)
        seed_water_goal(db, user.id)
        seed_reminder_config(db, user.id)

        print("\n✓ Seeding complete.\n")
        print(f"  User:   #{user.id} <{user.email}>")
        print(f"  Goals:  {len(goal_ids)}")
        for g in GOAL_DEFS:
            print(f"            • {g['title']}")
        print(f"  Habits: {len(HABIT_DEFS)}")
        print(f"  Water goal: {WATER_GOAL_ML} ml/day\n")
        return 0
    except Exception as e:
        db.rollback()
        print(f"\n✗ Seeding failed: {e}\n", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
