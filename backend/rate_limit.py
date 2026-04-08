import os

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

# Configurable via env — use "redis://host:6379" in production
_storage_uri = os.environ.get("RATE_LIMIT_STORAGE_URI", "memory://")


def _get_rate_limit_key(request: Request) -> str:
    """Return user ID from JWT state if available, otherwise client IP."""
    # After auth middleware runs, current user may be on request.state
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    return get_remote_address(request)


# ---------------------------------------------------------------------------
# Limiter instance – importable across the project
# ---------------------------------------------------------------------------
limiter = Limiter(
    key_func=_get_rate_limit_key,
    default_limits=["30/minute"],           # default for normal use
    storage_uri=_storage_uri,
)


# ---------------------------------------------------------------------------
# Custom 429 handler – returns JSON instead of plain text
# ---------------------------------------------------------------------------
def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = exc.detail.split(" ")[-1] if exc.detail else "60"
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Please slow down.",
            "retry_after": retry_after,
        },
        headers={"Retry-After": retry_after},
    )
