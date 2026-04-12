import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv(Path(__file__).parent / ".env")
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .database import get_db
from . import models

# JWT Configuration — secret MUST be set via environment variable
_secret = os.environ.get("JWT_SECRET_KEY", "")
if not _secret:
    # Allow a dev fallback ONLY when running tests
    if "pytest" in sys.modules:
        _secret = "test-only-secret-do-not-use-in-prod"
    else:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is required. "
            "Set it in your .env file or environment before starting the server."
        )
SECRET_KEY: str = _secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7  # reduced from 30 for tighter security

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


_bypass_env = os.environ.get("BYPASS_GOOGLE_AUTH", "false").lower() == "true"
# Only allow auth bypass when running inside the test suite
BYPASS_GOOGLE_AUTH = _bypass_env and "pytest" in sys.modules


def verify_google_token(token: str) -> dict:
    """Verify a Google OAuth ID token and return user info.
    When BYPASS_GOOGLE_AUTH is true, returns a dev user without contacting Google."""
    import logging
    logger = logging.getLogger("lifeos")

    if BYPASS_GOOGLE_AUTH:
        return {
            "sub": "dev-user-001",
            "email": "dev@localhost",
            "name": "Dev User",
            "picture": "",
            "iss": "accounts.google.com",
        }
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
        if idinfo["iss"] not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Wrong issuer.")
        return idinfo
    except ValueError as e:
        logger.error("Google token verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )



def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    """FastAPI dependency to extract and validate the current user from JWT."""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        try:
            user_id: int = int(user_id_str)
        except (ValueError, TypeError):
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
