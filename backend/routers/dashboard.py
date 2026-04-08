import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from .. import crud, models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..progress_engine import batch_compute_progress

router = APIRouter(
    prefix="/users/{user_id}/dashboard",
    tags=["dashboard"],
)


def _verify_owner(current_user: models.User, user_id: int):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/stats")
def get_dashboard_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get all goals
    goals = db.query(models.Goal).filter(models.Goal.user_id == user_id).all()
    active_goals = [g for g in goals if g.status == "Active"]

    # Compute progress for active goals in batch
    active_goal_ids = [g.id for g in active_goals]
    progress_map = batch_compute_progress(db, active_goal_ids)

    # Average progress across active goals
    if active_goals:
        avg_progress = round(sum(progress_map.get(g.id, 0) for g in active_goals) / len(active_goals), 2)
    else:
        avg_progress = 0

    # Sort active goals by priority: High=0, Medium=1, Low=2
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    sorted_active = sorted(active_goals, key=lambda g: priority_order.get(g.priority, 3))
    top_active = sorted_active[:3]

    active_goals_list = [
        {
            "id": g.id,
            "title": g.title,
            "priority": g.priority,
            "progress": progress_map.get(g.id, 0),
            "category": g.category,
            "target_date": g.target_date,
        }
        for g in top_active
    ]

    # Active Snap Streaks
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    total_streaks = sum(h.current_streak for h in habits)

    # Task Efficiency Breakdowns (daily, monthly, annual)
    tasks = db.query(models.Task).filter(models.Task.user_id == user_id).all()
    today = datetime.date.today()

    def efficiency(filtered_tasks):
        total = len(filtered_tasks)
        done = len([t for t in filtered_tasks if t.status == "Done"])
        return round((done / total * 100), 2) if total > 0 else 0

    daily_tasks = [t for t in tasks if t.target_date and t.target_date == today]
    monthly_tasks = [t for t in tasks if t.target_date and t.target_date.year == today.year and t.target_date.month == today.month]
    annual_tasks = [t for t in tasks if t.target_date and t.target_date.year == today.year]

    # Upcoming Deadlines Count
    upcoming_tasks = len([t for t in tasks if t.status != "Done" and t.target_date and t.target_date >= today])

    return {
        "active_streaks": total_streaks,
        "goal_completion_percentage": avg_progress,
        "task_efficiency": {
            "daily": efficiency(daily_tasks),
            "monthly": efficiency(monthly_tasks),
            "annual": efficiency(annual_tasks),
        },
        "upcoming_deadlines": upcoming_tasks,
        "active_goals": active_goals_list,
    }

@router.get("/today")
def get_dashboard_today(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_owner(current_user, user_id)
    today = datetime.date.today()
    
    # Fetch Habits that have started
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    today_habits = [h for h in habits if h.start_date <= today]
    
    # Fetch Tasks (Daily view or due/overdue)
    tasks = db.query(models.Task).filter(
        models.Task.user_id == user_id, 
        models.Task.status != "Done"
    ).all()
    
    today_tasks = []
    for t in tasks:
        if t.target_date and t.target_date <= today:
            today_tasks.append(t)
            
    return {
        "habits": today_habits,
        "tasks": today_tasks
    }
