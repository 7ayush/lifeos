from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """
    Computes and returns the 'Contest View' leaderboard.
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
                # Approximate success ratio: Done logs / Context Days Passed (simplified)
                # In a full app, this would query HabitLogs for completed count against x/y
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

        # 4. Growth Score Algorithm
        growth_score = (
            (goal_rate * 0.3) + 
            (habit_index_score * 0.4) + 
            (min(total_streaks * 2, 100) * 0.1) + # Cap streak contribution to 100 pts
            (task_efficiency * 0.2)
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
