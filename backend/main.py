from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .database import engine
from . import models
from .rate_limit import limiter, rate_limit_exceeded_handler
from .routers import users, goals, habits, tasks, journal, analytics, auth, dashboard, notes, sync, notifications, tags, weekly_review, export, water

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Life OS Core API", version="0.1.0")

# ---------------------------------------------------------------------------
# Rate Limiting  (slowapi)
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
app.include_router(water.router)

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
