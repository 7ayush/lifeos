import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/users/{user_id}/dashboard",
    tags=["dashboard"],
)

@router.get("/stats")
def get_dashboard_stats(user_id: int, db: Session = Depends(get_db)):
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Goal Completion Rate
    goals = db.query(models.Goal).filter(models.Goal.user_id == user_id).all()
    total_goals = len(goals)
    completed_goals = len([g for g in goals if g.status == "Completed"])
    goal_rate = (completed_goals / total_goals * 100) if total_goals > 0 else 0

    # Active Snap Streaks
    habits = db.query(models.Habit).filter(models.Habit.user_id == user_id).all()
    total_streaks = sum(h.current_streak for h in habits)

    # Task Efficiency Score
    tasks = db.query(models.Task).filter(models.Task.user_id == user_id).all()
    total_tasks = len(tasks)
    done_tasks = len([t for t in tasks if t.status == "Done"])
    task_efficiency = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Upcoming Deadlines Count
    upcoming_tasks = len([t for t in tasks if t.status != "Done" and t.target_date and t.target_date >= datetime.date.today()])

    return {
        "active_streaks": total_streaks,
        "goal_completion_percentage": round(goal_rate, 2),
        "task_efficiency_percentage": round(task_efficiency, 2),
        "upcoming_deadlines": upcoming_tasks
    }

@router.get("/today")
def get_dashboard_today(user_id: int, db: Session = Depends(get_db)):
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
