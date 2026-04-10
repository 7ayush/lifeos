# Requirements Document

## Introduction

Deploy the LifeOS application to production using Cloudflare infrastructure. The React frontend is deployed as a static site to Cloudflare Pages. The FastAPI backend runs in Docker containers on a local machine and is exposed to the internet through a Cloudflare Tunnel. All backend requests require valid JWT auth tokens. CORS is locked down to the production frontend domain only.

## Glossary

- **Frontend**: The React + Vite + TypeScript single-page application that compiles to static assets (HTML, CSS, JS)
- **Backend**: The FastAPI Python application serving the LifeOS REST API on port 8001
- **Cloudflare_Pages**: Cloudflare's static site hosting platform used to serve the Frontend
- **Cloudflare_Tunnel**: A secure outbound-only connection from the local machine to Cloudflare's edge network, exposing the Backend without opening inbound ports
- **Cloudflared**: The Cloudflare Tunnel daemon that runs as a Docker container alongside the Backend
- **JWT**: JSON Web Token used for authenticating API requests (HS256, 7-day expiry)
- **CORS**: Cross-Origin Resource Sharing headers that restrict which origins can call the Backend
- **Docker_Compose**: The container orchestration tool managing the Backend and Cloudflared services
- **Wrangler**: Cloudflare's CLI tool for managing Pages projects and deployments
- **Production_Domain**: The Cloudflare Pages URL (e.g., `lifeos.pages.dev`) or custom domain where the Frontend is served

## Requirements

### Requirement 1: Frontend Static Deployment to Cloudflare Pages

**User Story:** As a developer, I want to deploy the Frontend to Cloudflare_Pages, so that the application is served globally via Cloudflare's CDN with HTTPS enforced automatically.

#### Acceptance Criteria

1. WHEN the developer runs the Wrangler deploy command from the `frontend` directory, THE Cloudflare_Pages service SHALL upload the contents of the `frontend/dist` directory and serve them at the Production_Domain.
2. THE Cloudflare_Pages project SHALL define a build configuration specifying `npm run build` as the build command and `dist` as the output directory.
3. WHEN a user navigates to any Frontend route, THE Cloudflare_Pages service SHALL serve `index.html` as the fallback for SPA client-side routing.
4. THE Frontend build process SHALL embed the production Backend URL (the Cloudflare_Tunnel public hostname) into the `VITE_API_URL` environment variable at build time.
5. THE Frontend build process SHALL embed the production Google OAuth client ID into the `VITE_GOOGLE_CLIENT_ID` environment variable at build time.

### Requirement 2: Backend Exposure via Cloudflare Tunnel

**User Story:** As a developer, I want to expose the Backend to the internet through Cloudflare_Tunnel from my local machine, so that the Backend is reachable without opening inbound firewall ports.

#### Acceptance Criteria

1. WHEN Docker_Compose starts, THE Cloudflared container SHALL establish an outbound-only tunnel to Cloudflare's edge network using the configured tunnel token.
2. THE Cloudflared container SHALL route incoming requests from the tunnel's public hostname to `http://backend:8001` within the Docker network.
3. WHILE the tunnel is active, THE Cloudflare edge SHALL terminate TLS and forward requests to the Cloudflared container over the secure tunnel connection.
4. THE Cloudflared container SHALL depend on the Backend service health check passing before starting the tunnel.
5. IF the Cloudflared container loses its connection to Cloudflare's edge, THEN THE Cloudflared container SHALL automatically attempt to reconnect using the `restart: unless-stopped` policy.

### Requirement 3: Authentication Enforcement on Backend Requests

**User Story:** As a developer, I want all Backend API requests (except login and health check) to require valid JWT auth tokens, so that unauthorized clients cannot access protected data.

#### Acceptance Criteria

1. WHEN a request arrives at a protected Backend endpoint without a Bearer token in the Authorization header, THE Backend SHALL respond with HTTP 401 and a `WWW-Authenticate: Bearer` header.
2. WHEN a request arrives with an expired or malformed JWT, THE Backend SHALL respond with HTTP 401 and a descriptive error message.
3. THE Backend SHALL accept JWT tokens signed with the HS256 algorithm using the configured `JWT_SECRET_KEY`.
4. THE Frontend SHALL attach the stored JWT token as a `Bearer` token in the `Authorization` header for every API request to the Backend.
5. WHEN a user completes Google OAuth login on the Frontend, THE Backend `/auth/google` endpoint SHALL verify the Google ID token and return a signed JWT to the Frontend.

### Requirement 4: CORS Lockdown to Production Domain

**User Story:** As a developer, I want CORS to be restricted to the Production_Domain in the production environment, so that only the deployed Frontend can make cross-origin requests to the Backend.

#### Acceptance Criteria

1. WHILE running in production, THE Backend SHALL set the `CORS_ORIGINS` environment variable to include only the Production_Domain URL.
2. WHEN a cross-origin request arrives from an origin not in the `CORS_ORIGINS` list, THE Backend CORS middleware SHALL omit the `Access-Control-Allow-Origin` header from the response.
3. THE Docker_Compose configuration SHALL pass the `CORS_ORIGINS` value to the Backend container via the environment section.
4. WHEN a preflight OPTIONS request arrives from the Production_Domain, THE Backend SHALL respond with appropriate `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` headers.

### Requirement 5: Containerized Production Orchestration

**User Story:** As a developer, I want the Backend and Cloudflared services to run as Docker containers managed by Docker_Compose, so that the deployment is reproducible and isolated.

#### Acceptance Criteria

1. THE Docker_Compose configuration SHALL define two services: `backend` and `cloudflared`.
2. THE Backend container SHALL run the application as a non-root user (`appuser`).
3. THE Backend container SHALL expose port 8001 only within the Docker network (using `expose`, not `ports`).
4. THE Docker_Compose configuration SHALL use `restart: unless-stopped` for both the Backend and Cloudflared services.
5. THE Backend container SHALL include a health check that verifies the API root endpoint responds with HTTP 200.
6. IF the Backend container health check fails after 3 retries, THEN THE Docker_Compose orchestrator SHALL mark the Backend as unhealthy and prevent the Cloudflared container from starting.

### Requirement 6: Environment Variable and Secret Management

**User Story:** As a developer, I want all secrets and configuration values managed through environment variables with documented templates, so that sensitive data is not committed to version control.

#### Acceptance Criteria

1. THE repository SHALL include a `.env.example` file at the project root documenting `CLOUDFLARE_TUNNEL_TOKEN` and `CORS_ORIGINS` variables.
2. THE repository SHALL include a `backend/.env.example` file documenting `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, and `DATABASE_URL` variables.
3. THE `.gitignore` file SHALL exclude `.env` files and any file containing secrets from version control.
4. WHEN the Backend starts without `JWT_SECRET_KEY` set, THE Backend SHALL raise a `RuntimeError` and refuse to start.
5. THE Cloudflare_Pages deployment SHALL receive `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` as build-time environment variables configured in the Pages project settings or passed via the Wrangler CLI.

### Requirement 7: Security Headers and HTTPS Enforcement

**User Story:** As a developer, I want the production deployment to enforce HTTPS and include security headers, so that the application is protected against common web attacks.

#### Acceptance Criteria

1. THE Cloudflare_Pages service SHALL serve all Frontend assets over HTTPS with TLS termination at Cloudflare's edge.
2. THE Cloudflare_Tunnel SHALL ensure all traffic between the client and Cloudflare's edge is encrypted via TLS.
3. THE Frontend static assets with hashed filenames (under `/assets/`) SHALL be served with `Cache-Control: public, max-age=31536000, immutable` headers.
4. WHEN the Frontend is deployed to Cloudflare_Pages, THE deployment SHALL include a `_headers` file that adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin` headers to all responses.
5. WHEN the Frontend is deployed to Cloudflare_Pages, THE deployment SHALL include a `_redirects` file or equivalent configuration to handle SPA routing fallback to `index.html`.

### Requirement 8: Cloudflare Pages Build and Deploy Configuration

**User Story:** As a developer, I want a documented and repeatable process for deploying the Frontend to Cloudflare_Pages, so that deployments are consistent and automated.

#### Acceptance Criteria

1. THE repository SHALL include a Wrangler configuration file (`frontend/wrangler.toml`) specifying the Pages project name, build command, and output directory.
2. WHEN the developer runs `npx wrangler pages deploy` from the `frontend` directory, THE Wrangler CLI SHALL deploy the built assets to the configured Cloudflare_Pages project.
3. THE `frontend/wrangler.toml` file SHALL specify compatibility settings appropriate for the current date.
4. THE Frontend `package.json` SHALL include a `deploy` script that runs the build and Wrangler deploy commands in sequence.
