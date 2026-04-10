# Requirements Document

## Introduction

The LifeOS project currently uses a single `docker-compose.yml` that bundles the backend service with a Cloudflare Tunnel (`cloudflared`) service. This makes local Docker-based development awkward because the tunnel requires a `CLOUDFLARE_TUNNEL_TOKEN` that developers don't need locally. This feature separates Docker Compose configurations into environment-specific profiles so that developers can run the full stack (frontend + backend) locally using Docker alone, while preserving the existing production tunnel setup and enabling easy creation of new environments (staging, testing) in the future.

## Glossary

- **Compose_Base**: The shared Docker Compose file (`docker-compose.yml`) containing service definitions common to all environments.
- **Compose_Override**: An environment-specific Docker Compose override file (e.g., `docker-compose.local.yml`, `docker-compose.prod.yml`) that layers additional or modified service configuration on top of Compose_Base.
- **Local_Environment**: The Docker Compose environment used for local development, running both frontend and backend containers without external tunnel dependencies.
- **Production_Environment**: The Docker Compose environment used for production deployment, including the Cloudflare Tunnel service for secure external access.
- **Frontend_Service**: The Docker container serving the built React SPA via Nginx on port 80.
- **Backend_Service**: The Docker container running the FastAPI application on port 8001.
- **Tunnel_Service**: The Docker container running `cloudflare/cloudflared` that proxies external HTTPS traffic to the Backend_Service.
- **Env_File**: An environment-specific `.env` file (e.g., `.env.local`, `.env.prod`) providing variable values for a given Compose_Override.

## Requirements

### Requirement 1: Shared Base Compose Configuration

**User Story:** As a developer, I want a base Docker Compose file that defines services common to all environments, so that service definitions are not duplicated across environment files.

#### Acceptance Criteria

1. THE Compose_Base SHALL define the Backend_Service with its build context, healthcheck, and restart policy.
2. THE Compose_Base SHALL define the Frontend_Service with its build context and restart policy.
3. THE Compose_Base SHALL NOT include any environment-specific services such as the Tunnel_Service.
4. THE Compose_Base SHALL NOT hard-code environment variable values that differ between environments.

### Requirement 2: Local Development Environment

**User Story:** As a developer, I want a local Docker Compose environment that runs the full stack (frontend + backend) without requiring Cloudflare Tunnel credentials, so that I can develop and test locally using Docker.

#### Acceptance Criteria

1. THE Compose_Override for Local_Environment SHALL include the Frontend_Service and Backend_Service without the Tunnel_Service.
2. WHEN the Local_Environment is started, THE Backend_Service SHALL expose port 8001 on the host machine.
3. WHEN the Local_Environment is started, THE Frontend_Service SHALL expose port 3000 on the host machine.
4. WHEN the Local_Environment is started, THE Frontend_Service SHALL proxy API requests to the Backend_Service using the internal Docker network hostname.
5. THE Compose_Override for Local_Environment SHALL set `BYPASS_GOOGLE_AUTH` to `true` on the Backend_Service.
6. THE Compose_Override for Local_Environment SHALL NOT require `CLOUDFLARE_TUNNEL_TOKEN` to be set.
7. THE Local_Environment SHALL load environment variables from an Env_File named `.env.local`.

### Requirement 3: Production Environment Preservation

**User Story:** As a DevOps engineer, I want the existing production Docker Compose setup preserved as a named environment, so that the current Cloudflare Tunnel deployment continues to work without changes.

#### Acceptance Criteria

1. THE Compose_Override for Production_Environment SHALL include the Tunnel_Service with the `cloudflare/cloudflared` image.
2. THE Compose_Override for Production_Environment SHALL configure the Tunnel_Service to depend on the Backend_Service healthcheck.
3. THE Compose_Override for Production_Environment SHALL set `BYPASS_GOOGLE_AUTH` to `false` on the Backend_Service.
4. THE Compose_Override for Production_Environment SHALL require `CLOUDFLARE_TUNNEL_TOKEN` from the Env_File.
5. THE Production_Environment SHALL load environment variables from an Env_File named `.env.prod`.
6. THE Compose_Override for Production_Environment SHALL NOT expose backend or frontend ports to the host, relying on the Tunnel_Service for external access.

### Requirement 4: Environment Extensibility

**User Story:** As a developer, I want a clear, documented pattern for adding new environments (e.g., staging, testing), so that creating a new environment requires only adding a new override file and env file.

#### Acceptance Criteria

1. WHEN a new environment is needed, THE developer SHALL create a new Compose_Override file following the naming convention `docker-compose.<environment>.yml`.
2. WHEN a new environment is needed, THE developer SHALL create a corresponding Env_File following the naming convention `.env.<environment>`.
3. THE project documentation SHALL describe the steps to create a new environment, including the override file, env file, and the Docker Compose command to start the environment.

### Requirement 5: Frontend Docker Build for Local Environment

**User Story:** As a developer, I want the frontend to be built and served inside a Docker container for local development, so that the local Docker environment mirrors production behavior.

#### Acceptance Criteria

1. THE Frontend_Service SHALL use the existing multi-stage Dockerfile (`frontend/Dockerfile`) to build the React SPA and serve it via Nginx.
2. WHEN the Local_Environment is started, THE Frontend_Service SHALL receive the Backend_Service URL as a build argument (`VITE_API_URL`).
3. THE Frontend_Service Nginx configuration SHALL proxy `/api` requests to the Backend_Service container on the Docker network.

### Requirement 6: Convenience Launch Commands

**User Story:** As a developer, I want simple, documented commands to start each environment, so that I do not need to remember complex Docker Compose flag combinations.

#### Acceptance Criteria

1. THE project documentation SHALL include the exact Docker Compose command to start the Local_Environment using the base and local override files with the local Env_File.
2. THE project documentation SHALL include the exact Docker Compose command to start the Production_Environment using the base and production override files with the production Env_File.
3. THE project documentation SHALL include commands to stop, rebuild, and view logs for each environment.

### Requirement 7: Environment File Templates

**User Story:** As a developer, I want example environment files for each environment, so that I can quickly set up any environment by copying and filling in the template.

#### Acceptance Criteria

1. THE project SHALL include an `.env.local.example` file containing all variables needed for the Local_Environment with placeholder values and comments.
2. THE project SHALL include an `.env.prod.example` file containing all variables needed for the Production_Environment with placeholder values and comments.
3. THE `.env.local.example` file SHALL NOT contain `CLOUDFLARE_TUNNEL_TOKEN`.
4. THE `.env.prod.example` file SHALL contain `CLOUDFLARE_TUNNEL_TOKEN` with an empty placeholder.
