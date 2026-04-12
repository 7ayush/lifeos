import logging
import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .database import engine
from . import models
from .rate_limit import limiter, rate_limit_exceeded_handler
from .routers import users, goals, habits, tasks, journal, analytics, auth, dashboard, notes, sync, notifications, tags, weekly_review, export, water

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("lifeos")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Life OS Core API", version="0.1.0")

# ---------------------------------------------------------------------------
# Rate Limiting  (slowapi)
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# Request body size limit  (1 MB default, configurable via env)
# ---------------------------------------------------------------------------
MAX_BODY_BYTES = int(os.environ.get("MAX_REQUEST_BODY_BYTES", 1_048_576))  # 1 MB


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    """Reject requests with bodies exceeding MAX_BODY_BYTES."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return Response(
            status_code=413,
            content='{"detail": "Request body too large"}',
            media_type="application/json",
        )
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# Audit logging — log every request method + path + user agent
# ---------------------------------------------------------------------------
@app.middleware("http")
async def audit_log(request: Request, call_next):
    logger.info(
        "%s %s  client=%s",
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
    )
    response = await call_next(request)
    return response


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

# ---------------------------------------------------------------------------
# CORS — configurable via CORS_ORIGINS env var (comma-separated)
# ---------------------------------------------------------------------------
_default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://localhost:5176"
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Life OS API"}

@app.get("/health")
def health_check():
    """Verify the server is up and the database is reachable."""
    try:
        from sqlalchemy import text
        # Perform a simple query to check DB connectivity
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "environment": os.environ.get("ENV", "production")
        }
    except Exception as e:
        logger.error("Health check failed: %s", str(e))
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "detail": str(e)
        }, 500
