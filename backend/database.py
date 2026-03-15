import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Can be sqlite or postgresql
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./lifeos.db")

engine = create_engine(
    DATABASE_URL,
    # connect_args is needed for SQLite to avoid thread issues
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
