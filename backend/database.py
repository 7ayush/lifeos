import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Can be sqlite or postgresql
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifeos.db")
_is_sqlite = DATABASE_URL.startswith("sqlite")

_engine_kwargs = {}
if _is_sqlite:
    # SQLite needs this to avoid thread issues
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL (Supabase) — handle connection pooler idle disconnects
    _engine_kwargs.update(
        pool_pre_ping=True,       # test connections before reuse
        pool_recycle=300,          # recycle connections every 5 min
        pool_size=5,              # keep 5 connections in the pool
        max_overflow=10,          # allow up to 10 extra under load
    )

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
