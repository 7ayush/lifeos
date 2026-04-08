from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Computes and returns the 'Contest View' leaderboard.
    Requires authentication.
    """
    users = db.query(models.User).all()
    leaderboard = []

    for user in users:
        # 1. Global Goal Completion Rate
        goals = db.query(models.Goal).filter(models.Goal.user_id == user.id).all()
        total_goals = len(goals)
        completed_goals = len([g for g in goals if g.status == "Completed"])
        goal_rate = (completed_goals / total_goals * 100) if total_goals > 0 else 0

        # 2. Habit Success Index & Active Snap-Streaks
        habits = db.query(models.Habit).filter(models.Habit.user_id == user.id).all()
        total_streaks = sum(h.current_streak for h in habits)
        
        habit_index_score = 0
        if habits:
            ratios = []
            for h in habits:
                logs = db.query(models.HabitLog).filter(
                    models.HabitLog.habit_id == h.id, 
                    models.HabitLog.status == "Done"
                ).count()
                ratios.append(logs / h.target_x if h.target_x > 0 else 0)
            
            habit_index_score = (sum(ratios) / len(ratios)) * 100

        # 3. Task Efficiency Score
        tasks = db.query(models.Task).filter(models.Task.user_id == user.id).all()
        total_tasks = len(tasks)
        done_tasks = len([t for t in tasks if t.status == "Done"])
        task_efficiency = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0

        # 4. Journal Consistency
        entries = db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user.id).all()
        journal_count = len(entries)
        days_since_signup = max((date.today() - user.created_at.date()).days, 1)
        journal_consistency = min((journal_count / days_since_signup) * 100, 100)

        # 5. Enhanced Growth Score with journal factor
        growth_score = (
            (goal_rate * 0.25) + 
            (habit_index_score * 0.30) + 
            (min(total_streaks * 2, 100) * 0.10) +
            (task_efficiency * 0.20) +
            (journal_consistency * 0.15)
        )

        leaderboard.append({
            "user_id": user.id,
            "username": user.username,
            "goal_rate": round(goal_rate, 2),
            "habit_index": round(habit_index_score, 2),
            "snap_streaks": total_streaks,
            "task_efficiency": round(task_efficiency, 2),
            "growth_score": round(growth_score, 2)
        })

    # Sort by Growth Score descending
    leaderboard.sort(key=lambda x: x["growth_score"], reverse=True)
    
    return leaderboard


@router.get("/users/{user_id}/personal")
def get_personal_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Personal analytics with breakdown scores for radar chart."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Goals
    goals = db.query(models.Goal).filter(models.Goal.user_id == user_id).all()
    total_goals = len(goals)
    completed_goals = len([g for g in goals if g.status == "Completed"])
    goal_score = (completed_goals / total_goals * 100) if total_goals > 0 else 0

    # Habits
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    total_streaks = sum(h.current_streak for h in habits)
    habit_score = 0
    if habits:
        ratios = []
        for h in habits:
            logs = db.query(models.HabitLog).filter(
                models.HabitLog.habit_id == h.id,
                models.HabitLog.status == "Done"
            ).count()
            ratios.append(logs / h.target_x if h.target_x > 0 else 0)
        habit_score = min((sum(ratios) / len(ratios)) * 100, 100)

    # Tasks
    tasks = db.query(models.Task).filter(models.Task.user_id == user_id).all()
    total_tasks = len(tasks)
    done_tasks = len([t for t in tasks if t.status == "Done"])
    task_score = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Journal
    user_obj = db.query(models.User).filter(models.User.id == user_id).first()
    entries = db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user_id).all()
    journal_count = len(entries)
    days_active = max((date.today() - user_obj.created_at.date()).days, 1) if user_obj else 1
    journal_score = min((journal_count / days_active) * 100, 100)

    # Streak score (capped at 100)
    streak_score = min(total_streaks * 5, 100)

    # Overall growth score
    growth_score = (
        (goal_score * 0.25) +
        (habit_score * 0.30) +
        (streak_score * 0.10) +
        (task_score * 0.20) +
        (journal_score * 0.15)
    )

    return {
        "growth_score": round(growth_score, 1),
        "goal_score": round(goal_score, 1),
        "habit_score": round(habit_score, 1),
        "task_score": round(task_score, 1),
        "journal_score": round(journal_score, 1),
        "streak_score": round(streak_score, 1),
        "total_goals": total_goals,
        "completed_goals": completed_goals,
        "total_tasks": total_tasks,
        "done_tasks": done_tasks,
        "total_habits": len(habits),
        "active_streaks": total_streaks,
        "journal_entries": journal_count,
    }


@router.get("/users/{user_id}/year-in-pixels")
def get_year_in_pixels(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Returns 365-day data for mood and habit completion."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    today = date.today()
    start_date = today - timedelta(days=364)

    # Journal moods
    entries = db.query(models.JournalEntry).filter(
        models.JournalEntry.user_id == user_id,
        models.JournalEntry.entry_date >= start_date
    ).all()
    mood_map = {str(e.entry_date): e.mood for e in entries if e.mood is not None}

    # Habit logs
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    habit_ids = [h.id for h in habits]
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id.in_(habit_ids),
        models.HabitLog.log_date >= start_date
    ).all() if habit_ids else []

    # count done per date
    done_map = {}
    for log in logs:
        d = str(log.log_date)
        if log.status == "Done":
            done_map[d] = done_map.get(d, 0) + 1

    total_habits = len(habits) or 1

    pixels = []
    for i in range(365):
        d = start_date + timedelta(days=i)
        ds = str(d)
        mood = mood_map.get(ds)
        habit_ratio = done_map.get(ds, 0) / total_habits
        # intensity: blended from mood (0-5) and habit ratio (0-1)
        if mood is not None:
            intensity = (mood / 5) * 0.6 + habit_ratio * 0.4
        else:
            intensity = habit_ratio * 0.4  # no mood = partial intensity from habits only
        
        pixels.append({
            "date": ds,
            "mood": mood,
            "habit_ratio": round(habit_ratio, 2),
            "intensity": round(intensity, 2),
        })

    return {"pixels": pixels, "start_date": str(start_date), "end_date": str(today)}
