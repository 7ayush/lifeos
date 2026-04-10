# Implementation Plan: Cloudflare Deployment

## Overview

Configure the LifeOS frontend for Cloudflare Pages deployment and verify the existing backend Docker Compose + Cloudflare Tunnel setup. No backend code changes are needed — the work is creating new frontend deployment config files, adding a deploy script, and verifying existing infrastructure configuration.

## Tasks

- [x] 1. Create Cloudflare Pages configuration files
  - [x] 1.1 Create `frontend/wrangler.toml` with Pages project config
    - Set project name to `lifeos`
    - Set `pages_build_output_dir` to `./dist`
    - Set `compatibility_date` to `2025-06-01`
    - Add `[build]` section with `command = "npm run build"`
    - _Requirements: 8.1, 8.3_

  - [x] 1.2 Create `frontend/public/_headers` with security headers
    - Add `X-Content-Type-Options: nosniff` for all paths (`/*`)
    - Add `X-Frame-Options: DENY` for all paths
    - Add `Referrer-Policy: strict-origin-when-cross-origin` for all paths
    - Add `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`
    - _Requirements: 7.3, 7.4_

  - [x] 1.3 Create `frontend/public/_redirects` with SPA fallback
    - Add `/*  /index.html  200` rule for client-side routing
    - _Requirements: 1.3, 7.5_

  - [x] 1.4 Add `deploy` script to `frontend/package.json`
    - Add `"deploy": "npm run build && npx wrangler pages deploy dist"` to scripts
    - _Requirements: 8.2, 8.4_

- [x] 2. Verify and update environment variable documentation
  - [x] 2.1 Verify `.env.example` at project root documents required variables
    - Confirm `CLOUDFLARE_TUNNEL_TOKEN` is documented
    - Confirm `CORS_ORIGINS` is documented with production example
    - _Requirements: 6.1_

  - [x] 2.2 Verify `backend/.env.example` documents required backend variables
    - Confirm `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `DATABASE_URL` are documented
    - _Requirements: 6.2_

  - [x] 2.3 Verify `.gitignore` excludes `.env` files
    - Confirm `.env`, `frontend/.env`, and related env files are in `.gitignore`
    - _Requirements: 6.3_

- [x] 3. Checkpoint - Verify configuration files
  - Ensure all new files are created and existing configs are verified, ask the user if questions arise.

- [x] 4. Verify existing Docker Compose and backend infrastructure
  - [x] 4.1 Verify `docker-compose.yml` service definitions
    - Confirm `backend` and `cloudflared` services are defined
    - Confirm backend uses `expose` (not `ports`) for port 8001
    - Confirm both services have `restart: unless-stopped`
    - Confirm `cloudflared` depends on backend health check (`condition: service_healthy`)
    - Confirm `CORS_ORIGINS` is passed via environment with configurable default
    - _Requirements: 5.1, 5.3, 5.4, 5.6, 4.3_

  - [x] 4.2 Verify `backend/Dockerfile` runs as non-root user
    - Confirm `appuser` is created and `USER appuser` is set
    - Confirm health check support (curl installed)
    - _Requirements: 5.2, 5.5_

  - [x] 4.3 Verify backend auth enforcement in `backend/auth.py`
    - Confirm `JWT_SECRET_KEY` is required at startup (raises `RuntimeError` if missing)
    - Confirm JWT validation uses HS256 algorithm
    - Confirm 401 response with `WWW-Authenticate: Bearer` header on auth failure
    - _Requirements: 3.1, 3.2, 3.3, 6.4_

  - [x] 4.4 Verify CORS middleware in `backend/main.py`
    - Confirm `CORS_ORIGINS` env var is read and split by comma
    - Confirm `CORSMiddleware` is configured with `allow_credentials=True`
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 4.5 Verify frontend auth token attachment in `frontend/src/contexts/AuthContext.tsx`
    - Confirm axios interceptor attaches `Authorization: Bearer <token>` header
    - Confirm token is stored/retrieved from `localStorage`
    - _Requirements: 3.4_

  - [x] 4.6 Verify frontend API base URL configuration in `frontend/src/api/config.ts`
    - Confirm `VITE_API_URL` environment variable is used for `baseURL`
    - _Requirements: 1.4, 6.5_

- [x] 5. Final checkpoint - Review all configuration
  - Ensure all new files are created, all existing infrastructure is verified correct, and ask the user if questions arise.

## Notes

- No backend code changes are required — all backend components (auth, CORS, Docker, health check) are already correctly implemented
- No property-based tests apply — this feature is purely infrastructure configuration
- `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` are build-time env vars set in Cloudflare Pages project settings or passed via Wrangler CLI
- The operator must set `CORS_ORIGINS=https://lifeos.pages.dev` in the root `.env` for production
- Tasks in section 4 are verification-only — they confirm existing code meets requirements without modifications
