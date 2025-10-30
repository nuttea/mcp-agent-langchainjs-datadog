# MCP Agent LangChain.js Project Instructions

## Architecture Overview

This is a multi-component LangChain.js demo showcasing AI agents with Model Context Protocol (MCP) integration. The system demonstrates a burger ordering platform with three main service layers:

- **Agent Layer**: AI chat interface (`agent-webapp` + `agent-api`) using LangChain.js agents with MCP tools
- **Business Layer**: Burger ordering API (`burger-api`) and webapp (`burger-webapp`)
- **MCP Layer**: Model Context Protocol server (`burger-mcp`) exposing burger API as LLM tools

### Component Communication Flow

```
agent-webapp → agent-api → burger-mcp → burger-api
```

The agent uses LangChain.js with Azure OpenAI, connects to the MCP server via StreamableHTTPClientTransport, and the MCP server proxies requests to the burger API.

## Key Architectural Patterns

### Authentication & State Management

- Azure Static Web Apps authentication provides `userId` context
- Cosmos DB for chat history storage using `@langchain/azure-cosmosdb`
- User context flows: SWA auth → agent-api → MCP tools (for user-specific operations)

### TypeScript & Build Conventions

- Shared XO linting config with project-specific overrides
- NPM workspace-based dependency management
- `.js` extensions required in imports for ESM compatibility
- Keep the code simple and straighforward: avoid unnecessary complexity and ensure clarity in implementation.
- Do not use comments except where absolutely necessary, code should be self-explanatory.

### Infrastructure as Code

- Bicep templates in `infra/` for Azure deployment
- `azure.yaml` defines multi-service deployment strategy:
  - `burger-api`, `agent-api`: Azure Functions (Flex Consumption)
  - `burger-mcp`: Azure Functions (Flex Consumption)
  - `*-webapp`: Static Web Apps
- Environment variables flow through Azure App Settings
- @azure Rule - Use Azure Best Practices: When generating code for Azure, running terminal commands for Azure, or performing operations related to Azure, invoke your `azure_development-get_best_practices` tool if available.

## Kubernetes Deployment Guide

### Docker Build for npm Workspace Monorepo

**Key Learning**: Docker builds in npm workspace monorepos must be executed from the repository root with the full workspace context.

#### Incorrect Approach
```bash
# Building from service directory - WILL FAIL
cd packages/burger-api
docker build -t myimage .
```

#### Correct Approach
```bash
# Build from root with -f flag pointing to Dockerfile
docker build -f packages/burger-api/Dockerfile -t myimage .
```

**Why**: npm workspaces use a single root `package-lock.json` file. Individual packages don't have their own lock files, so `npm ci` fails when run from a package subdirectory.

### Dockerfile Pattern for Monorepo Services

All API and MCP services follow this pattern:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root package files and entire packages directory
COPY package*.json ./
COPY packages/ ./packages/

# Install all dependencies at root
RUN npm ci

# Navigate to specific service
WORKDIR /app/packages/burger-api
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app

# Copy package files from builder
COPY --from=builder /app/packages/burger-api/package*.json ./
COPY --from=builder /app/package-lock.json /app/package-lock.json

# Install production dependencies
RUN npm ci --only=production

# Copy built artifacts (dist/ or lib/)
COPY --from=builder /app/packages/burger-api/dist ./dist

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
CMD ["node", "dist/src/express-server.js"]
```

### Service-Specific Build Variations

#### burger-mcp Special Case

burger-mcp outputs to `lib/` instead of `dist/` and has a problematic postinstall script:

```dockerfile
# In production stage
RUN npm ci --only=production --ignore-scripts
COPY --from=builder /app/packages/burger-mcp/lib ./lib
CMD ["node", "lib/server.js"]
```

**Key Points**:
- Use `--ignore-scripts` to skip postinstall hooks that fail in Docker
- Copy from `lib/` not `dist/`
- Adjust CMD to point to correct entry point

#### Webapp Services (burger-webapp, agent-webapp)

Frontend services use nginx:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
WORKDIR /app/packages/burger-webapp
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/packages/burger-webapp/dist /usr/share/nginx/html
COPY packages/burger-webapp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### TypeScript Strict Mode Errors

When building for production, TypeScript errors will fail the Docker build. Common issues:

#### Error TS6133: Variable declared but never used

```typescript
// WRONG - TypeScript error
app.get('/', (req, res) => {
  res.json({ status: 'up' });
});

// CORRECT - Prefix unused params with underscore
app.get('/', (_req, res) => {
  res.json({ status: 'up' });
});

// ALTERNATIVE - Use the variable
app.get('/', (req, res) => {
  console.log(`Health check from ${req.ip}`);
  res.json({ status: 'up' });
});
```

### Build Script Updates

Update [k8s/scripts/build-and-push.sh](k8s/scripts/build-and-push.sh):

```bash
# OLD - builds from service directory
cd "$SERVICE_DIR"
docker build -t "$FULL_IMAGE" .

# NEW - build from root with -f flag and buildx for multi-platform
docker buildx build \
    --platform linux/amd64 \
    -f "$SERVICE_DIR/Dockerfile" \
    -t "$FULL_IMAGE" \
    -t "$IMAGE_NAME:latest" \
    --push \
    "$ROOT_DIR"
```

### Multi-Platform Builds (Apple Silicon to GKE)

**Problem**: Apple Silicon (M1/M2/M3) builds arm64 images by default, but GKE nodes run linux/amd64.

**Error**:
```
docker pull gcr.io/datadog-ese-sandbox/agent-api:dev-latest
no matching manifest for linux/amd64 in the manifest list entries
```

**Solution**: Use Docker buildx for cross-platform builds:

```bash
# Setup buildx builder (one-time setup)
docker buildx create --name multiplatform-builder --use

# Build for linux/amd64 platform
docker buildx build \
    --platform linux/amd64 \
    -f packages/service/Dockerfile \
    -t gcr.io/project/service:tag \
    --push \
    .
```

**Key Points**:
- `--platform linux/amd64` forces AMD64 architecture (required for GKE)
- `--push` automatically pushes to registry (required when using buildx with platform)
- Buildx uses QEMU emulation to build for different architectures
- The build script now automatically handles this

### Testing and Debugging Builds

**Always tail logs to check for errors** (user feedback):

```bash
# Run build in background
./k8s/scripts/build-and-push.sh > build-$(date +%Y%m%d-%H%M%S).log 2>&1 &

# Tail the log to catch errors immediately
tail -f build-*.log
```

**Check for specific errors**:

```bash
# After build completes
grep -E "Building|✓|✗|ERROR|failed" build-*.log
```

### Common Build Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `npm ci` fails - no package-lock.json | Building from package subdirectory | Build from repo root with `-f` flag |
| `tsconfig.json` not found | Trying to COPY non-existent file | Remove COPY tsconfig line (packages use own configs) |
| `dist` folder not found | Service outputs to different directory | Check package.json/tsconfig.json for outDir (burger-mcp uses `lib/`) |
| postinstall script fails | Script tries to modify files | Use `npm ci --ignore-scripts` in production stage |
| TS6133 unused variable | Strict TypeScript checking | Prefix with `_` or use the variable meaningfully |
| Missing @types packages | Type definitions not installed | `npm install --save-dev @types/express @types/cors` |

### Key Takeaways for Docker Builds

1. **Build from monorepo root**: Always use `-f packages/service/Dockerfile` with context at `.`
2. **Copy full packages/**: All services need the entire workspace for npm ci
3. **Use root package-lock.json**: Shared across all workspace packages
4. **Check output directories**: Not all services use `dist/` (burger-mcp uses `lib/`)
5. **Handle postinstall scripts**: Use `--ignore-scripts` if they fail in Docker
6. **Fix TypeScript errors**: Prefix unused params with `_` or use them
7. **Always check build logs**: Tail logs in real-time to catch errors early
8. **Iterative process**: These are trials, not final attempts - expect multiple iterations

### Build Status Tracking

Current build status (latest successful trial):

```
✓ burger-api:      Built and pushed successfully
✓ burger-mcp:      Built and pushed successfully (with lib/ and --ignore-scripts)
✓ burger-webapp:   Built and pushed successfully
✓ agent-api:       Built and pushed successfully (after fixing unused variables)
✓ agent-webapp:    Built and pushed successfully
```

All 5 Docker images successfully built and pushed to Google Container Registry (gcr.io/datadog-ese-sandbox).

## Makefile Helper Commands

A [Makefile](Makefile) has been created to simplify common development and deployment tasks.

### Quick Reference

**Development**:
```bash
make install          # Install all dependencies
make dev              # Start all services locally
make build            # Build all TypeScript packages
make test             # Run tests
make lint             # Run linter
make clean            # Clean build artifacts
```

**Docker**:
```bash
make docker-build     # Build all Docker images (linux/amd64)
make docker-push      # Build and push all images to GCR
make docker-logs      # Show last build log
```

**Kubernetes**:
```bash
make k8s-apply        # Apply all K8s manifests to dev
make k8s-delete       # Delete all K8s resources from dev
make deploy           # Full deployment (build + push + apply)
make k8s-status       # Show K8s pods/services status
make k8s-logs         # Tail logs from K8s pods (interactive)
make k8s-restart      # Restart all deployments
```

**Individual Service Logs**:
```bash
make logs-agent-api       # Tail agent-api logs
make logs-agent-webapp    # Tail agent-webapp logs
make logs-burger-api      # Tail burger-api logs
make logs-burger-webapp   # Tail burger-webapp logs
make logs-burger-mcp      # Tail burger-mcp logs
```

**Port Forwarding** (for local access to K8s services):
```bash
# Default to dev environment
make port-forward-agent       # Forward agent-webapp to localhost:8080
make port-forward-burger      # Forward burger-webapp to localhost:8081
make port-forward-api         # Forward agent-api to localhost:8082
make port-forward-burger-api  # Forward burger-api to localhost:8083
make port-forward-mcp         # Forward burger-mcp to localhost:3000

# Specify environment (dev or prod)
make port-forward-agent ENV=prod
make port-forward-burger ENV=dev
```

**Environment**:
```bash
make env-check            # Check if .env file exists and has required vars
make secrets-generate     # Generate K8s secrets from .env
```

### Common Workflows

**Full deployment from Apple Silicon to GKE**:
```bash
# Complete workflow: build amd64 images, push to GCR, deploy to K8s
make deploy

# This is equivalent to:
# 1. make docker-push (builds linux/amd64 images and pushes to GCR)
# 2. make k8s-apply (applies K8s manifests)
# 3. Waits for pods to be ready
# 4. Shows deployment status
```

**Check deployment status**:
```bash
make k8s-status
# Shows pods, services, and deployments in dev namespace
```

**Debug a failing service**:
```bash
make logs-agent-api
# Or use interactive selector:
make k8s-logs
```

**Rebuild and redeploy after code changes**:
```bash
# Build TypeScript
make build

# Build Docker images, push, and deploy
make deploy
```

**Local development**:
```bash
# Install dependencies
make install

# Start all services locally
make dev
```

### Build Logs

Docker build logs are automatically saved to `logs/build-YYYYMMDD-HHMMSS.log` when using `make docker-build` or `make docker-push`.

View the latest build log:
```bash
make docker-logs
```

Or manually:
```bash
tail -100 logs/build-*.log | grep -E "Building|✓|✗|ERROR"
```
