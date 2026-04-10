# Implementation Plan: Docker Environment Separation

## Overview

Restructure the LifeOS Docker Compose setup from a single monolithic file into a base + override pattern with environment-specific configurations for local development and production. Each task builds incrementally, starting with the base file refactor, then adding overrides, Nginx config, env templates, and finally updating documentation.

## Tasks

- [x] 1. Refactor `docker-compose.yml` into a shared base
  - Remove the `cloudflared` service entirely
  - Remove `ports` mapping from backend (only `expose` internally)
  - Remove environment-specific `environment` keys (`BYPASS_GOOGLE_AUTH`, `CORS_ORIGINS`) from backend
  - Add the `frontend` service with build context `./frontend`, container name `lifeos-frontend`, and `restart: unless-stopped`
  - Keep backend `build`, `container_name`, `env_file`, `healthcheck`, and `restart` as-is
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create environment override files
  - [x] 2.1 Create `docker-compose.local.yml`
    - Add backend `ports: "8001:8001"` and `environment` with `BYPASS_GOOGLE_AUTH: "true"` and local `CORS_ORIGINS`
    - Add frontend `build.args.VITE_API_URL: "http://localhost:3000"`, `ports: "3000:80"`, volume mount for `./frontend/nginx.local.conf:/etc/nginx/conf.d/default.conf:ro`, and `depends_on` backend `service_healthy`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.2 Create `docker-compose.prod.yml`
    - Add backend `environment` with `BYPASS_GOOGLE_AUTH: "false"` and `CORS_ORIGINS: ${CORS_ORIGINS}`
    - Add `cloudflared` service with image, command, `TUNNEL_TOKEN` from env, `depends_on` backend `service_healthy`, and `restart: unless-stopped`
    - Do NOT expose any host ports for backend or frontend
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 3. Create `frontend/nginx.local.conf` with API proxy
  - Copy the existing `frontend/nginx.conf` as a starting point
  - Add `location /api/` block that proxies to `http://backend:8001/api/` with appropriate headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`)
  - Keep all existing directives (gzip, assets caching, SPA fallback)
  - _Requirements: 2.4, 5.3_

- [x] 4. Create environment file templates
  - [x] 4.1 Create `.env.local.example`
    - Include a header comment explaining this is for local development
    - Include copy instructions (`cp .env.local.example .env.local`)
    - Do NOT include `CLOUDFLARE_TUNNEL_TOKEN`
    - _Requirements: 7.1, 7.3_

  - [x] 4.2 Create `.env.prod.example`
    - Include `CLOUDFLARE_TUNNEL_TOKEN=` with empty placeholder
    - Include `CORS_ORIGINS=` with example value in comment
    - _Requirements: 7.2, 7.4_

- [x] 5. Checkpoint — Validate compose configs
  - Ensure `docker compose -f docker-compose.yml -f docker-compose.local.yml config` produces valid merged output
  - Ensure `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` produces valid merged output
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update `.gitignore` and clean up old env files
  - Add `.env.local` and `.env.prod` to `.gitignore` (actual env files with secrets should not be committed)
  - Remove the old root `.env.example` if it is fully superseded by the new per-environment templates, or update it to point to the new pattern
  - _Requirements: 2.7, 3.5_

- [x] 7. Update project documentation
  - [x] 7.1 Update `docs/BUILD_AND_RUN.md`
    - Replace the single `docker compose up` production section with environment-specific commands
    - Add a "Docker Local Development" section with the local compose command: `docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d --build`
    - Update the "Production Deployment" section with: `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build`
    - Add stop, rebuild, and log commands for each environment
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 7.2 Add environment extensibility guide to documentation
    - Document the naming convention: `docker-compose.<env>.yml` + `.env.<env>`
    - Describe the steps to create a new environment (create override file, create env file, run with `-f` flags)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Final checkpoint — Full validation
  - Ensure all compose files are syntactically valid
  - Ensure documentation is consistent with the actual file names and commands
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No property-based tests — this feature is purely infrastructure/configuration
- Each task references specific requirements for traceability
- The frontend already has a multi-stage Dockerfile that builds the SPA and serves via Nginx, so no Dockerfile changes are needed (Requirement 5.1)
- The `VITE_API_URL` build arg is already supported by the frontend Dockerfile (Requirement 5.2)
