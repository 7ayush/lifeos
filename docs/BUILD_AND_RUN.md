# LifeOS — Build & Run Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend build toolchain |
| npm | 9+ | Frontend package manager |
| Docker + Docker Compose | Latest | Local and production deployment |
| Wrangler CLI | Latest | Cloudflare Pages deployment (optional) |

---

## Local Development

### 1. Clone and set up environment files

```bash
# Backend env
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

```dotenv
# Required
JWT_SECRET_KEY=<any-strong-random-string>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>

# Optional — leave commented out to use SQLite locally
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Enables auto-login without Google during development
BYPASS_GOOGLE_AUTH=true
```

The frontend env file (`frontend/.env`) should have:

```dotenv
VITE_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
VITE_BYPASS_GOOGLE_AUTH=true
```

When `BYPASS_GOOGLE_AUTH=true`, the backend accepts any credential string and creates a dev user automatically. This only works when running inside pytest or when the env var is set — it's safe because the bypass is gated behind `"pytest" in sys.modules` in production builds.

### 2. Backend setup

```bash
# Create virtual environment (from project root)
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
# .venv\Scripts\activate     # Windows

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Start the backend

```bash
.venv/bin/uvicorn backend.main:app --reload --port 8001
```

The API is now available at `http://localhost:8001`. Verify with:

```bash
curl http://localhost:8001/
# → {"message": "Welcome to Life OS API"}
```

On first start, SQLAlchemy auto-creates all tables in `lifeos.db` (SQLite).

### 4. Seed sample data (optional)

```bash
.venv/bin/python -m backend.seed_data
```

This populates the database with sample goals, habits, tasks, journal entries, notes, tags, water entries, weekly reflections, and progress snapshots for user ID 1.

### 5. Frontend setup

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npx vite --port 5176
```

The app is now available at `http://localhost:5176`. It connects to the backend at `http://localhost:8001` by default (configured via `VITE_API_URL`).

To use a different backend URL:

```bash
VITE_API_URL=http://localhost:8001 npx vite --port 5176
```

### 7. Run tests

Backend:

```bash
# From project root, with venv activated
pytest backend/tests/
```

Frontend:

```bash
cd frontend
npx vitest --run
```

---

## Docker Compose Environments

LifeOS uses a base + override pattern for Docker Compose. A shared `docker-compose.yml` defines common services, and environment-specific override files layer on top.

### Architecture

**Local Development** (everything in Docker, no tunnel):

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

**Production** (Cloudflare Tunnel, no exposed ports):

```
┌──────────────┐     ┌──────────────────┐
│   Browser    │────►│ Cloudflare Pages  │  (static React SPA)
└──────┬───────┘     └──────────────────┘
       │ API calls (HTTPS)
       ▼
┌──────────────────┐
│ Cloudflare Tunnel│  (TLS termination, DDoS protection)
└──────┬───────────┘
       │ http://backend:8001 (internal Docker network)
       ▼
┌──────────────────┐     ┌─────────────┐
│ FastAPI Backend  │────►│ PostgreSQL  │  (Supabase)
│ (Docker)         │     └─────────────┘
└──────────────────┘
```

---

## Docker Local Development

Run the full stack (frontend + backend) in Docker containers without needing Cloudflare credentials.

### Step 1: Configure environment files

```bash
cp .env.local.example .env.local
```

No Cloudflare token is needed. Edit `backend/.env` as described in the [Local Development](#local-development) section above.

### Step 2: Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d --build
```

This starts two containers:
- `lifeos-frontend` — Nginx serving the React SPA on `http://localhost:3000`, proxying `/api` requests to the backend
- `lifeos-backend` — FastAPI app on `http://localhost:8001`

Google auth is bypassed automatically (`BYPASS_GOOGLE_AUTH=true`).

### Step 3: Verify

```bash
# Check containers are running
docker compose -f docker-compose.yml -f docker-compose.local.yml ps

# View logs
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f frontend
```

Open `http://localhost:3000` in your browser. API requests are proxied through Nginx so the browser only talks to port 3000.

### Stop

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
```

### Rebuild after code changes

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

---

## Production Deployment

Production uses two separate deployment targets:
- **Frontend** → Cloudflare Pages (static hosting)
- **Backend** → Docker Compose with Cloudflare Tunnel (zero open ports)

### Step 1: Set up Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a new tunnel
3. Copy the tunnel token
4. In the tunnel config, add a public hostname route:
   - Subdomain: `api` (or your choice)
   - Domain: your domain
   - Service: `http://backend:8001`

### Step 2: Configure environment files

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod`:

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=<your-tunnel-token>
CORS_ORIGINS=https://lifeos.pages.dev,https://yourdomain.com
```

`backend/.env` (for the FastAPI container):

```dotenv
JWT_SECRET_KEY=<strong-production-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Production overrides
# BYPASS_GOOGLE_AUTH must be false or absent
# RATE_LIMIT_STORAGE_URI=redis://redis:6379  # if using Redis
```

### Step 3: Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

This starts two containers:
- `lifeos-backend` — FastAPI app on port 8001 (internal only)
- `lifeos-tunnel` — Cloudflare Tunnel that proxies external HTTPS traffic to the backend

No ports are exposed to the internet. Cloudflare handles TLS termination and routes traffic through the tunnel to the backend container.

The tunnel container waits for the backend healthcheck (`GET /`) to pass before starting.

Verify:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f cloudflared
```

### Stop

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod down
```

### Rebuild after code changes

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build backend
```

### Step 4: Deploy the frontend to Cloudflare Pages

From the `frontend/` directory:

```bash
# Set the production API URL (your Cloudflare Tunnel domain)
VITE_API_URL=https://api.yourdomain.com npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

Or use the combined deploy script:

```bash
VITE_API_URL=https://api.yourdomain.com npm run deploy
```

The `wrangler.toml` is already configured:

```toml
name = "lifeos"
pages_build_output_dir = "./dist"

[build]
command = "npm run build"
```

Cloudflare Pages automatically serves the SPA with:
- `_redirects` — SPA fallback (`/* → /index.html 200`)
- `_headers` — Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) and aggressive caching for `/assets/*`

### Step 5: Configure Google OAuth for production

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add your production frontend URL to "Authorized JavaScript origins":
   - `https://lifeos.pages.dev` (or your custom domain)
4. Add your production backend URL to "Authorized redirect URIs" if needed

---

## Adding a New Environment

The project follows a naming convention for environments:

- **Override file**: `docker-compose.<env>.yml` — service overrides layered on top of the base `docker-compose.yml`
- **Env file template**: `.env.<env>.example` — committed template with placeholders
- **Env file**: `.env.<env>` — actual values, git-ignored

To create a new environment (e.g., `staging`):

### 1. Create the override file

Create `docker-compose.staging.yml` with any service overrides your environment needs:

```yaml
services:
  backend:
    ports:
      - "8001:8001"
    environment:
      BYPASS_GOOGLE_AUTH: "false"
      CORS_ORIGINS: "https://staging.yourdomain.com"

  frontend:
    build:
      args:
        VITE_API_URL: "https://staging.yourdomain.com"
    ports:
      - "3000:80"
    volumes:
      - ./frontend/nginx.local.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      backend:
        condition: service_healthy
```

### 2. Create the env file

Create `.env.staging.example` (committed) with placeholders and comments:

```dotenv
# LifeOS — Staging Environment
# Copy to .env.staging:  cp .env.staging.example .env.staging

CORS_ORIGINS=https://staging.yourdomain.com
```

Then copy it and fill in actual values:

```bash
cp .env.staging.example .env.staging
```

### 3. Run it

```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

Stop, logs, and rebuild follow the same pattern:

```bash
# Stop
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging down

# Logs
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging logs -f backend

# Rebuild
docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

---

## Docker Commands Reference

### Local Development

```bash
# Build and start
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d --build

# View logs
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f frontend

# Restart backend only
docker compose -f docker-compose.yml -f docker-compose.local.yml restart backend

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# Rebuild after code changes
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build

# Check container status
docker compose -f docker-compose.yml -f docker-compose.local.yml ps
```

### Production

```bash
# Build and start
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build

# View logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f cloudflared

# Restart backend only
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod restart backend

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod down

# Rebuild backend after code changes
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build backend

# Check container status
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod ps
```

---

## Environment Variable Reference

### `.env.local` (Local Docker Compose)

No variables are required for local development. Copy from the template:

```bash
cp .env.local.example .env.local
```

### `.env.prod` (Production Docker Compose)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Yes | Token from Cloudflare Zero Trust tunnel |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins for CORS |

Copy from the template:

```bash
cp .env.prod.example .env.prod
```

### `backend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET_KEY` | Yes | — | Secret for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `DATABASE_URL` | No | `sqlite:///./lifeos.db` | Database connection string |
| `CORS_ORIGINS` | No | `localhost:5173,...` | Allowed CORS origins |
| `RATE_LIMIT_STORAGE_URI` | No | `memory://` | Rate limit backend (`redis://` for prod) |
| `MAX_REQUEST_BODY_BYTES` | No | `1048576` | Max request body size (1 MB) |
| `BYPASS_GOOGLE_AUTH` | No | `false` | Auth bypass (only works in pytest) |

### `frontend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8001` | Backend API base URL |
| `VITE_GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `VITE_BYPASS_GOOGLE_AUTH` | No | `false` | Show dev login bypass button |

---

## Troubleshooting

**Backend won't start — `JWT_SECRET_KEY environment variable is required`**
Set `JWT_SECRET_KEY` in `backend/.env`. Any random string works for local dev.

**Frontend can't reach backend — CORS errors**
Make sure the frontend URL is in `CORS_ORIGINS`. For local dev, the defaults cover `localhost:5173` through `5176` and `3000`.

**Google login fails locally**
Set `BYPASS_GOOGLE_AUTH=true` in `backend/.env` and `VITE_BYPASS_GOOGLE_AUTH=true` in `frontend/.env` to skip Google OAuth during development.

**Docker healthcheck failing**
The backend healthcheck hits `GET /`. Check `docker compose logs backend` for startup errors. Common cause: missing or invalid `JWT_SECRET_KEY`.

**Cloudflare Tunnel not connecting**
Verify `CLOUDFLARE_TUNNEL_TOKEN` in `.env.prod`. Check `docker compose logs cloudflared` for connection errors. The tunnel waits for the backend healthcheck to pass first.

**Database migrations**
Migration scripts are in `backend/migrations/`. Run them manually if you're upgrading from an older schema:

```bash
.venv/bin/python -m backend.migrations.migrate_<name>
```
