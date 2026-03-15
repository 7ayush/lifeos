# Life OS

A comprehensive personal management system with a Go/Python backend and a React/Vite frontend.

## Project Structure

- `frontend/`: React + Vite + TypeScript application for the user interface.
- `backend/`: FastAPI (Python) backend for API and business logic.
- `lifeos.db`: SQLite database for persistent storage.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (v3.10+)
- Go (optional, if migrating to Go backend)

### Installation

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Features

- **Dashboard**: Overview of daily metrics and activities.
- **Kanban Board**: Task management with drag-and-drop.
- **Habit Tracker**: Track and visualize daily habits.
- **Analytics**: Data-driven insights into your life metrics.
