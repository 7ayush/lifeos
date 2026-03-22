from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from . import models
from .routers import users, goals, habits, tasks, journal, analytics, auth, dashboard, notes, sync, notifications, tags, weekly_review, export

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Life OS Core API", version="0.1.0")

# Register Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(goals.router)
app.include_router(habits.router)
app.include_router(tasks.router)
app.include_router(journal.router)
app.include_router(notes.router)
app.include_router(analytics.router)
app.include_router(sync.router)
app.include_router(notifications.router)
app.include_router(tags.router)
app.include_router(weekly_review.router)
app.include_router(export.router)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000", "http://localhost:5176"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Life OS API"}
