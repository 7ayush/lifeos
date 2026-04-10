# LifeOS — Local Build & Run Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker + Docker Compose | Latest | Container runtime |

For non-Docker local development, you'll also need Python 3.10+, Node.js 18+, and npm 9+.

---

## Option A: Docker Local Development

Run the full stack (frontend + backend) in Docker containers. No Cloudflare credentials needed.

### Architecture

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │ http://localhost:3000
       ▼
┌──────────────────┐
│ Nginx (Frontend) │  (serves SPA, proxies /api)
│ :3000 → :80      │
└──────┬───────────┘
       │ http://backend:8001 (internal Docker network)
       ▼
┌──────────────────┐     ┌─────────────┐
│ FastAPI Backend  │────►│   SQLite    │
│ :8001            │     └─────────────┘
└──────────────────┘
```

### 1. Configure environment files

```bash
cp .env.local.example .env.local
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```dotenv
JWT_SECRET_KEY=<any-random-string>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
BYPASS_GOOGLE_AUTH=true
```

### 2. Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d --build
```

This starts:
- `lifeos-frontend` — Nginx serving the React SPA on `http://localhost:3000`, proxying `/api` to the backend
- `lifeos-backend` — FastAPI on `http://localhost:8001`

### 3. Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
```

Open `http://localhost:3000`. API calls are proxied through Nginx so the browser only talks to port 3000.

### Commands

```bash
# View logs
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f frontend

# Restart backend only
docker compose -f docker-compose.yml -f docker-compose.local.yml restart backend

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# Rebuild after code changes
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

---

## Option B: Native Local Development (no Docker)

Run backend and frontend directly on your machine.

### 1. Set up environment files

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```dotenv
JWT_SECRET_KEY=<any-random-string>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
BYPASS_GOOGLE_AUTH=true
```

`frontend/.env`:

```dotenv
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
VITE_BYPASS_GOOGLE_AUTH=true
```

### 2. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Start the backend

```bash
.venv/bin/uvicorn backend.main:app --reload --port 8001
```

API available at `http://localhost:8001`.

### 4. Seed sample data (optional)

```bash
.venv/bin/python -m backend.seed_data
```

### 5. Frontend setup

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npx vite --port 5176
```

App available at `http://localhost:5176`.

### 7. Run tests

```bash
# Backend (from project root, venv activated)
pytest backend/tests/

# Frontend
cd frontend
npx vitest --run
```

---

## Environment Variables

### `backend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET_KEY` | Yes | — | Secret for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `DATABASE_URL` | No | `sqlite:///./lifeos.db` | Database connection string |
| `CORS_ORIGINS` | No | `localhost:5173,...` | Allowed CORS origins |
| `RATE_LIMIT_STORAGE_URI` | No | `memory://` | Rate limit backend |
| `MAX_REQUEST_BODY_BYTES` | No | `1048576` | Max request body size (1 MB) |
| `BYPASS_GOOGLE_AUTH` | No | `false` | Auth bypass for development |

### `frontend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8001` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `VITE_BYPASS_GOOGLE_AUTH` | No | `false` | Show dev login bypass button |

---

## Troubleshooting

**Backend won't start — `JWT_SECRET_KEY environment variable is required`**
Set `JWT_SECRET_KEY` in `backend/.env`. Any random string works.

**Frontend can't reach backend — CORS errors**
Make sure the frontend URL is in `CORS_ORIGINS`. The local override covers `localhost:3000`, `5173`, and `5176`.

**Google login fails locally**
Set `BYPASS_GOOGLE_AUTH=true` in `backend/.env` and `VITE_BYPASS_GOOGLE_AUTH=true` in `frontend/.env`.

**Docker healthcheck failing**
Check `docker compose logs backend` for startup errors. Common cause: missing `JWT_SECRET_KEY`.

**Database migrations**
Run manually if upgrading from an older schema:

```bash
.venv/bin/python -m backend.migrations.migrate_<name>
```
