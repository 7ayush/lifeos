"""
Seed script to populate LifeOS with sample data for UI testing.

Usage (from project root):
    .venv/bin/python -m backend.seed_data
"""

import sqlite3
import os
from datetime import datetime, date, timedelta

DB_PATH = "./lifeos.db"
USER_ID = 1  # Dev User

def get_conn():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        raise SystemExit(1)
    return sqlite3.connect(DB_PATH)


def seed_goals(conn):
    c = conn.cursor()
    goals = [
        (USER_ID, "Launch Personal Blog", "Build and deploy a personal blog with Next.js", "Active", "Project", "High", date.today() + timedelta(days=30)),
        (USER_ID, "Learn Spanish", "Reach B1 level in Spanish", "Active", "Area", "Medium", date.today() + timedelta(days=180)),
        (USER_ID, "Run a Half Marathon", "Train for and complete a half marathon", "Active", "Project", "High", date.today() + timedelta(days=90)),
        (USER_ID, "Read 24 Books This Year", "Read 2 books per month", "Active", "Area", "Low", date(date.today().year, 12, 31)),
        (USER_ID, "Build Emergency Fund", "Save 6 months of expenses", "Active", "Resource", "Medium", date.today() + timedelta(days=365)),
    ]
    c.executemany(
        "INSERT INTO goals (user_id, title, description, status, category, priority, target_date) VALUES (?,?,?,?,?,?,?)",
        goals,
    )
    print(f"  ✓ Inserted {len(goals)} goals")


def seed_habits(conn):
    c = conn.cursor()
    # Get goal IDs
    c.execute("SELECT id FROM goals WHERE user_id=? ORDER BY id", (USER_ID,))
    goal_ids = [r[0] for r in c.fetchall()]

    today = date.today()
    habits = [
        (goal_ids[2] if len(goal_ids) > 2 else None, USER_ID, "Morning Run", 5, 7, 12, today - timedelta(days=30), "weekly", 1, "1,2,3,4,5", "never", None, None, 80),
        (goal_ids[1] if len(goal_ids) > 1 else None, USER_ID, "Spanish Practice", 6, 7, 8, today - timedelta(days=20), "daily", 1, None, "never", None, None, 85),
        (None, USER_ID, "Meditate 10 min", 7, 7, 21, today - timedelta(days=45), "daily", 1, None, "never", None, None, 90),
        (goal_ids[3] if len(goal_ids) > 3 else None, USER_ID, "Read 30 Pages", 5, 7, 5, today - timedelta(days=15), "daily", 1, None, "never", None, None, 70),
        (None, USER_ID, "Drink 2L Water", 7, 7, 14, today - timedelta(days=25), "daily", 1, None, "never", None, None, 80),
    ]
    c.executemany(
        """INSERT INTO habits (goal_id, user_id, title, target_x, target_y_days, current_streak,
           start_date, frequency_type, repeat_interval, repeat_days, ends_type, ends_on_date,
           ends_after_occurrences, min_threshold_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        habits,
    )
    print(f"  ✓ Inserted {len(habits)} habits")


def seed_habit_logs(conn):
    c = conn.cursor()
    c.execute("SELECT id FROM habits WHERE user_id=? ORDER BY id", (USER_ID,))
    habit_ids = [r[0] for r in c.fetchall()]

    today = date.today()
    logs = []
    for habit_id in habit_ids:
        for days_ago in range(14):
            d = today - timedelta(days=days_ago)
            status = "Done" if days_ago % 3 != 0 else "Missed"
            logs.append((habit_id, d.isoformat(), status))

    c.executemany("INSERT INTO habit_logs (habit_id, log_date, status) VALUES (?,?,?)", logs)
    print(f"  ✓ Inserted {len(logs)} habit logs")


def seed_tasks(conn):
    c = conn.cursor()
    c.execute("SELECT id FROM goals WHERE user_id=? ORDER BY id", (USER_ID,))
    goal_ids = [r[0] for r in c.fetchall()]

    today = date.today()
    tasks = [
        (USER_ID, goal_ids[0] if goal_ids else None, "Set up Next.js project", "Initialize repo with TypeScript and Tailwind", "Done", "manual", "Medium", 60, 45, today - timedelta(days=5), "High", 1),
        (USER_ID, goal_ids[0] if goal_ids else None, "Design blog layout", "Create wireframes and component hierarchy", "InProgress", "manual", "High", 120, None, today + timedelta(days=2), "High", 2),
        (USER_ID, goal_ids[0] if goal_ids else None, "Write first blog post", "Draft intro post about the blog journey", "Todo", "manual", "Low", 90, None, today + timedelta(days=7), "Medium", 3),
        (USER_ID, goal_ids[0] if goal_ids else None, "Deploy to Vercel", "Configure CI/CD and deploy", "Todo", "manual", "Medium", 30, None, today + timedelta(days=10), "Medium", 4),
        (USER_ID, goal_ids[2] if len(goal_ids) > 2 else None, "Register for half marathon", "Sign up for the spring race", "Done", "manual", "Low", 15, 10, today - timedelta(days=20), "High", 5),
        (USER_ID, goal_ids[2] if len(goal_ids) > 2 else None, "Buy running shoes", "Get fitted at running store", "Done", "manual", "Low", 60, 50, today - timedelta(days=15), "Medium", 6),
        (USER_ID, goal_ids[2] if len(goal_ids) > 2 else None, "Complete 10K training plan", "Follow the 8-week plan", "InProgress", "manual", "High", 480, None, today + timedelta(days=14), "High", 7),
        (USER_ID, None, "Fix kitchen faucet", "Leaking faucet needs new washer", "Todo", "manual", "Low", 30, None, today + timedelta(days=3), "Low", 8),
        (USER_ID, None, "Grocery shopping", "Weekly groceries and meal prep ingredients", "Todo", "manual", "Low", 45, None, today, "None", 9),
        (USER_ID, None, "Review insurance policy", "Annual review of health and auto insurance", "Todo", "manual", "Medium", 60, None, today - timedelta(days=2), "Medium", 10),
        (USER_ID, goal_ids[3] if len(goal_ids) > 3 else None, "Finish Atomic Habits", "Complete remaining 80 pages", "InProgress", "manual", "Low", 120, None, today + timedelta(days=5), "Low", 11),
        (USER_ID, goal_ids[4] if len(goal_ids) > 4 else None, "Set up auto-transfer", "Configure monthly savings auto-transfer", "Todo", "manual", "Low", 15, None, today + timedelta(days=1), "High", 12),
    ]
    c.executemany(
        """INSERT INTO tasks (user_id, goal_id, title, description, status, task_type, energy_level,
           estimated_minutes, actual_minutes, target_date, priority, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        tasks,
    )
    print(f"  ✓ Inserted {len(tasks)} tasks")


def seed_subtasks(conn):
    c = conn.cursor()
    c.execute("SELECT id, title FROM tasks WHERE user_id=? ORDER BY id", (USER_ID,))
    task_rows = c.fetchall()

    subtasks = []
    for tid, title in task_rows:
        if "Next.js" in title:
            subtasks += [(tid, "Run create-next-app", 1), (tid, "Add Tailwind CSS", 1), (tid, "Configure ESLint", 0)]
        elif "blog layout" in title.lower():
            subtasks += [(tid, "Header component", 1), (tid, "Post card component", 0), (tid, "Footer component", 0)]
        elif "Deploy" in title:
            subtasks += [(tid, "Connect GitHub repo", 0), (tid, "Set environment variables", 0), (tid, "Test preview deployment", 0)]

    if subtasks:
        c.executemany("INSERT INTO subtasks (task_id, title, is_complete) VALUES (?,?,?)", subtasks)
    print(f"  ✓ Inserted {len(subtasks)} subtasks")


def seed_tags(conn):
    c = conn.cursor()
    tags = [
        (USER_ID, "work", "#3B82F6"),
        (USER_ID, "personal", "#10B981"),
        (USER_ID, "health", "#EF4444"),
        (USER_ID, "finance", "#F59E0B"),
        (USER_ID, "learning", "#8B5CF6"),
        (USER_ID, "urgent", "#DC2626"),
    ]
    c.executemany("INSERT INTO tags (user_id, name, color) VALUES (?,?,?)", tags)
    print(f"  ✓ Inserted {len(tags)} tags")

    # Link some tasks to tags
    c.execute("SELECT id FROM tags WHERE user_id=? ORDER BY id", (USER_ID,))
    tag_ids = [r[0] for r in c.fetchall()]
    c.execute("SELECT id FROM tasks WHERE user_id=? ORDER BY id", (USER_ID,))
    task_ids = [r[0] for r in c.fetchall()]

    task_tag_links = []
    if task_ids and tag_ids:
        # work tag on blog tasks
        for i in range(min(4, len(task_ids))):
            task_tag_links.append((task_ids[i], tag_ids[0]))
        # health tag on running tasks
        for i in range(4, min(7, len(task_ids))):
            task_tag_links.append((task_ids[i], tag_ids[2]))
        # personal tag
        if len(task_ids) > 7:
            task_tag_links.append((task_ids[7], tag_ids[1]))
        # finance tag
        if len(task_ids) > 11:
            task_tag_links.append((task_ids[11], tag_ids[3]))
        # urgent tag on overdue
        if len(task_ids) > 9:
            task_tag_links.append((task_ids[9], tag_ids[5]))

    if task_tag_links:
        c.executemany("INSERT INTO task_tags (task_id, tag_id) VALUES (?,?)", task_tag_links)
    print(f"  ✓ Linked {len(task_tag_links)} task-tag associations")


def seed_journal_entries(conn):
    c = conn.cursor()
    today = date.today()
    entries = [
        (USER_ID, (today - timedelta(days=0)).isoformat(), "Great productive day. Finished the blog layout wireframes and went for a solid 5K run. Feeling energized.", 5),
        (USER_ID, (today - timedelta(days=1)).isoformat(), "Struggled with focus today. Spanish practice was good though — learned 20 new words. Need to sleep earlier.", 3),
        (USER_ID, (today - timedelta(days=2)).isoformat(), "Rainy day. Spent most of it reading Atomic Habits. The chapter on habit stacking was eye-opening.", 4),
        (USER_ID, (today - timedelta(days=3)).isoformat(), "Missed my morning run but made up for it with an evening walk. Meditation session was really calming.", 3),
        (USER_ID, (today - timedelta(days=5)).isoformat(), "Set up the Next.js project successfully. Tailwind is working great. Excited about the blog.", 5),
        (USER_ID, (today - timedelta(days=7)).isoformat(), "Weekly review: on track with most goals. Need to pick up the pace on Spanish. Running is going well.", 4),
    ]
    c.executemany("INSERT INTO journal_entries (user_id, entry_date, content, mood) VALUES (?,?,?,?)", entries)
    print(f"  ✓ Inserted {len(entries)} journal entries")


def seed_notes(conn):
    c = conn.cursor()
    notes = [
        (USER_ID, "Blog Post Ideas", "- Why I started a blog\n- Lessons from building with Next.js\n- My running journey\n- Book reviews: Atomic Habits", "Project"),
        (USER_ID, "Spanish Vocabulary", "## Week 1\n- hola, adiós, por favor, gracias\n## Week 2\n- buenos días, buenas noches\n- ¿Cómo estás?", "Resource"),
        (USER_ID, "Half Marathon Training Plan", "## Week 1-4: Base Building\n- 3x 5K runs\n- 1x long run (8K)\n## Week 5-8: Speed Work\n- Intervals\n- Tempo runs", "Project"),
        (USER_ID, "Book Notes: Atomic Habits", "## Key Takeaways\n1. Habits are compound interest of self-improvement\n2. Focus on systems, not goals\n3. The 4 laws: Make it obvious, attractive, easy, satisfying", "Resource"),
        (USER_ID, "Financial Goals Tracker", "## Emergency Fund\n- Target: $15,000\n- Current: $8,500\n- Monthly contribution: $500\n\n## Investment Plan\n- Max out Roth IRA\n- Index fund contributions", "Area"),
    ]
    c.executemany("INSERT INTO notes (user_id, title, content, folder) VALUES (?,?,?,?)", notes)
    print(f"  ✓ Inserted {len(notes)} notes")


def seed_water_entries(conn):
    c = conn.cursor()
    today = date.today()
    entries = []
    for days_ago in range(7):
        d = today - timedelta(days=days_ago)
        # Varying amounts per day
        if days_ago == 0:  # today
            times = [(8, 250), (10, 500), (12, 250), (14, 750)]
        elif days_ago == 1:
            times = [(7, 500), (11, 250), (13, 500), (16, 250), (19, 500)]
        elif days_ago == 2:
            times = [(9, 250), (12, 500)]
        elif days_ago == 3:
            times = [(8, 500), (10, 250), (12, 750), (15, 500), (18, 250)]
        elif days_ago == 4:
            times = [(7, 250), (9, 500), (14, 250)]
        elif days_ago == 5:
            times = [(8, 500), (11, 500), (14, 500), (17, 500)]
        else:
            times = [(9, 250), (12, 500), (15, 250), (18, 500)]

        for hour, amount in times:
            ts = datetime(d.year, d.month, d.day, hour, 0, 0).isoformat()
            entries.append((USER_ID, amount, ts))

    c.executemany("INSERT INTO water_entries (user_id, amount_ml, timestamp) VALUES (?,?,?)", entries)
    print(f"  ✓ Inserted {len(entries)} water entries")


def seed_water_goal(conn):
    c = conn.cursor()
    c.execute("INSERT INTO water_goals (user_id, amount_ml) VALUES (?,?)", (USER_ID, 2000))
    print("  ✓ Inserted water goal (2000 ml)")


def seed_weekly_reflections(conn):
    c = conn.cursor()
    today = date.today()
    # Current week identifier
    week_id = today.strftime("%Y-W%W")
    prev_week = (today - timedelta(days=7)).strftime("%Y-W%W")

    reflections = [
        (USER_ID, prev_week, "## Wins\n- Completed Next.js setup\n- Ran 5K three times\n- Started Atomic Habits\n\n## Challenges\n- Missed Spanish practice twice\n- Didn't sleep enough\n\n## Next Week\n- Focus on blog design\n- Increase running distance"),
    ]
    c.executemany("INSERT INTO weekly_reflections (user_id, week_identifier, content) VALUES (?,?,?)", reflections)
    print(f"  ✓ Inserted {len(reflections)} weekly reflections")


def seed_progress_snapshots(conn):
    c = conn.cursor()
    c.execute("SELECT id FROM goals WHERE user_id=? ORDER BY id", (USER_ID,))
    goal_ids = [r[0] for r in c.fetchall()]

    today = date.today()
    snapshots = []
    for i, gid in enumerate(goal_ids):
        base_progress = [10, 15, 20, 25, 30, 35, 40]
        for days_ago in range(7):
            d = today - timedelta(days=6 - days_ago)
            progress = min(100, base_progress[days_ago] + i * 8)
            snapshots.append((gid, d.isoformat(), progress))

    c.executemany("INSERT INTO progress_snapshots (goal_id, date, progress) VALUES (?,?,?)", snapshots)
    print(f"  ✓ Inserted {len(snapshots)} progress snapshots")


def clear_existing_data(conn):
    """Clear all non-user data to avoid duplicates on re-run."""
    c = conn.cursor()
    tables_to_clear = [
        "focus_tasks", "task_tags", "subtasks", "notifications", "journal_tags",
        "journal_entries", "habit_logs", "progress_snapshots", "goal_milestones",
        "water_entries", "water_goals", "weekly_reflections", "tags", "notes",
        "tasks", "habits", "goals", "reminder_configs",
    ]
    for t in tables_to_clear:
        c.execute(f"DELETE FROM {t}")
    print("  ✓ Cleared existing data")


def seed_reminder_config(conn):
    c = conn.cursor()
    c.execute("INSERT INTO reminder_configs (user_id, remind_days_before, remind_on_due_date, remind_when_overdue) VALUES (?,?,?,?)",
              (USER_ID, 1, 1, 1))
    print("  ✓ Inserted reminder config")


def main():
    print(f"\nSeeding LifeOS database at {DB_PATH}...\n")
    conn = get_conn()

    clear_existing_data(conn)
    seed_goals(conn)
    seed_habits(conn)
    seed_habit_logs(conn)
    seed_tasks