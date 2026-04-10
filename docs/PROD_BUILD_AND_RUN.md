# LifeOS — Production Build & Run Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker + Docker Compose | Latest | Container runtime |
| Wrangler CLI | Latest | Cloudflare Pages deployment |
| Cloudflare account | — | Tunnel + Pages hosting |

---

## Architecture

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

No ports are exposed to the internet. Cloudflare handles TLS termination and routes traffic through the tunnel.

---

## Step 1: Set up Cloudflare Tunnel

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
2. Create a new tunnel
3. Copy the tunnel token
4. In the tunnel config, add a public hostname route:
   - Subdomain: `api` (or your choice)
   - Domain: your domain
   - Service: `http://backend:8001`

## Step 2: Configure environment files

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod`:

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=<your-tunnel-token>
CORS_ORIGINS=https://lifeos.pages.dev,https://yourdomain.com
```

Edit `backend/.env`:

```dotenv
JWT_SECRET_KEY=<strong-production-secret>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# BYPASS_GOOGLE_AUTH must be false or absent in production
# RATE_LIMIT_STORAGE_URI=redis://redis:6379  # recommended for multi-worker
```

## Step 3: Build and start the backend

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

This starts:
- `lifeos-backend` — FastAPI on port 8001 (internal only)
- `lifeos-tunnel` — Cloudflare Tunnel proxying external HTTPS traffic to the backend

The tunnel waits for the backend healthcheck (`GET /`) to pass before starting.

Verify:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f cloudflared
```

## Step 4: Deploy the frontend to Cloudflare Pages

From the `frontend/` directory:

```bash
# Build with production API URL
VITE_API_URL=https://api.yourdomain.com npm run build

# Deploy
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

Cloudflare Pages serves the SPA with:
- `_redirects` — SPA fallback (`/* → /index.html 200`)
- `_headers` — Security headers and aggressive caching for `/assets/*`

## Step 5: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add your production frontend URL to "Authorized JavaScript origins":
   - `https://lifeos.pages.dev` (or your custom domain)
4. Add your production backend URL to "Authorized redirect URIs" if needed

---

## Commands Reference

```bash
# Build and start
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build

# View backend logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# View tunnel logs
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

## Environment Variables

### `.env.prod` (Docker Compose)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_TUNNEL_TOKEN` | Yes | Token from Cloudflare Zero Trust tunnel |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins for CORS |

### `backend/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET_KEY` | Yes | — | Secret for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `DATABASE_URL` | Yes (prod) | `sqlite:///./lifeos.db` | PostgreSQL connection string |
| `CORS_ORIGINS` | No | `localhost:5173,...` | Allowed CORS origins |
| `RATE_LIMIT_STORAGE_URI` | No | `memory://` | Use `redis://host:6379` for production |
| `MAX_REQUEST_BODY_BYTES` | No | `1048576` | Max request body size (1 MB) |
| `BYPASS_GOOGLE_AUTH` | No | `false` | Must be `false` in production |

---

## Troubleshooting

**Cloudflare Tunnel not connecting**
Verify `CLOUDFLARE_TUNNEL_TOKEN` in `.env.prod`. Check `docker compose logs cloudflared` for errors. The tunnel waits for the backend healthcheck first.

**Docker healthcheck failing**
Check `docker compose logs backend` for startup errors. Common cause: missing or invalid `JWT_SECRET_KEY` or `DATABASE_URL`.

**CORS errors in browser**
Ensure `CORS_ORIGINS` in `.env.prod` includes your Cloudflare Pages URL (e.g., `https://lifeos.pages.dev`).

**Database migrations**
Run manually if upgrading from an older schema:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod exec backend python -m backend.migrations.migrate_<name>
```
