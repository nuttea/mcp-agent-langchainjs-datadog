# Docker Build Optimization for GitHub Actions

## Current Build Time Issues

Your current Dockerfile has several inefficiencies:

1. **Installs ALL monorepo dependencies** for every package (slow)
2. **No layer caching optimization** for package.json changes
3. **Multiple npm install calls** in production stage
4. **No build-time optimizations** enabled

## 🚀 Optimization Strategy

### 1. Layer Caching Optimization (Biggest Impact)

**Problem**: Lines 9-12 copy ALL files before installing dependencies
```dockerfile
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
```

**Solution**: Copy only dependency files first, then install, then copy source
```dockerfile
# Copy dependency files first (better caching)
COPY package*.json ./
COPY packages/*/package*.json ./packages/

# Install dependencies (this layer caches well)
RUN npm ci

# Copy source code after (changes more frequently)
COPY packages/ ./packages/

# Build
RUN npm run build
```

**Impact**: 70-80% faster builds when only code changes (not dependencies)

### 2. Use npm ci with --workspace flag (Monorepo Optimization)

**Problem**: Installing ALL workspace dependencies
```dockerfile
RUN npm ci  # Installs everything!
```

**Solution**: Install only what's needed
```dockerfile
# Install only the specific workspace dependencies
RUN npm ci --workspace=agent-api --include-workspace-root
```

**Impact**: 40-50% faster dependency installation

### 3. Enable BuildKit Features

**Problem**: Not using modern Docker BuildKit features

**Solution**: Add to workflow
```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: packages/${{ matrix.package }}/Dockerfile
    push: true
    # Enable BuildKit features
    build-args: |
      BUILDKIT_INLINE_CACHE=1
    cache-from: type=gha
    cache-to: type=gha,mode=max
    # Use BuildKit for better caching
    provenance: false
    sbom: false
```

**Impact**: 10-15% faster builds

### 4. Optimize Production Dependencies

**Problem**: Lines 30-33 run multiple npm install commands
```dockerfile
RUN npm install --production --no-package-lock
RUN npm install express cors --no-save
```

**Solution**: Single install with proper lockfile
```dockerfile
# Copy production package files
COPY --from=builder /app/packages/agent-api/package*.json ./

# Install production dependencies in one go
RUN npm ci --omit=dev
```

**Impact**: 20-30% faster production stage

### 5. Add .dockerignore

**Problem**: Copying unnecessary files slows down context transfer

**Solution**: Create `.dockerignore` in repo root
```
node_modules
.git
.github
dist
build
*.log
.env*
!.env.example
.DS_Store
*.md
!README.md
coverage
.vscode
.idea
```

**Impact**: 30-50% faster context upload to Docker

### 6. Parallel Builds with Concurrency

**Problem**: Building 5 packages sequentially in matrix

**Solution**: Already using matrix strategy ✅, but can add concurrency
```yaml
build-images:
  strategy:
    matrix:
      package: [agent-api, agent-webapp, burger-api, burger-mcp, burger-webapp]
    max-parallel: 5  # Build all at once
```

**Impact**: 5x faster total workflow time (all build in parallel)

## 📝 Optimized Dockerfile Template

Here's a fully optimized Dockerfile for your packages:

```dockerfile
# Build from repository root context
# docker build -f packages/agent-api/Dockerfile -t agent-api .

# Use specific Node version with Alpine for smaller image
FROM node:22-alpine AS base

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ============================================
# Dependencies stage (cached separately)
# ============================================
FROM base AS dependencies

# Copy only dependency manifests first (best caching)
COPY package*.json ./
COPY packages/agent-api/package*.json ./packages/agent-api/

# Install dependencies for this workspace only
RUN npm ci --workspace=agent-api --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/agent-api/node_modules ./packages/agent-api/node_modules

# Copy source code
COPY package*.json ./
COPY packages/agent-api ./packages/agent-api

# Build the application
WORKDIR /app/packages/agent-api
RUN npm run build

# ============================================
# Production stage (minimal)
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY --from=builder /app/packages/agent-api/package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Copy built application
COPY --from=builder /app/packages/agent-api/dist ./dist

# Create non-root user for security
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the Express server
CMD ["node", "dist/src/express-server.js"]
```

## 🔧 Workflow Optimizations

Update your workflow with these improvements:

```yaml
build-images:
  name: Build Docker Images
  runs-on: ubuntu-latest
  needs: detect-changes
  strategy:
    matrix:
      package: [agent-api, agent-webapp, burger-api, burger-mcp, burger-webapp]
    max-parallel: 5  # Build all packages in parallel
  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      with:
        driver-opts: |
          image=moby/buildkit:latest
          network=host

    - name: Authenticate to Google Cloud
      uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ vars.WIF_PROVIDER }}
        service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}

    - name: Configure Docker for GAR
      run: |
        gcloud auth configure-docker ${{ env.GAR_LOCATION }}-docker.pkg.dev

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: packages/${{ matrix.package }}/Dockerfile
        push: true
        tags: |
          ${{ env.GAR_LOCATION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GAR_REPOSITORY }}/${{ matrix.package }}:latest
        # Cache configuration
        cache-from: |
          type=gha,scope=${{ matrix.package }}
          type=registry,ref=${{ env.GAR_LOCATION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.GAR_REPOSITORY }}/${{ matrix.package }}:latest
        cache-to: type=gha,mode=max,scope=${{ matrix.package }}
        # BuildKit optimizations
        provenance: false
        sbom: false
        build-args: |
          BUILDKIT_INLINE_CACHE=1
```

## 📈 Expected Results

| Optimization | Build Time Reduction | Cumulative |
|--------------|---------------------|------------|
| Baseline | 10 minutes | 10 min |
| Layer caching | -7 min (70%) | 3 min |
| Workspace-specific install | -1.2 min (40%) | 1.8 min |
| .dockerignore | -0.5 min | 1.3 min |
| Production optimization | -0.3 min | 1.0 min |
| Parallel builds | N/A (already parallel) | 1.0 min |

**Total: ~90% reduction** (10 min → 1 min per package on cache hit)

## 🧪 Testing Locally

Test the optimized build locally:

```bash
# Test with cache
docker build -f packages/agent-api/Dockerfile -t agent-api:test .

# Test without cache (worst case)
docker build --no-cache -f packages/agent-api/Dockerfile -t agent-api:test .

# Time the build
time docker build -f packages/agent-api/Dockerfile -t agent-api:test .
```

## 📊 Monitoring Build Times

Add build time tracking to your workflow:

```yaml
- name: Build and push Docker image
  id: build
  uses: docker/build-push-action@v5
  with:
    # ... your config

- name: Report build time
  if: always()
  run: |
    echo "Build completed in ${{ steps.build.outputs.build-time }}"
```

## 🎯 Priority Implementation Order

1. **High Impact** (Do first):
   - Add .dockerignore
   - Optimize layer caching (copy package.json first)
   - Use workspace-specific npm ci

2. **Medium Impact**:
   - Enable BuildKit features
   - Optimize production dependencies

3. **Low Impact** (Nice to have):
   - Add health checks
   - Non-root user
   - Build time reporting

## 🔍 Cache Hit Rate

Monitor your cache hit rate in GitHub Actions:
- Good: >80% cache hits
- Needs improvement: <50% cache hits

Check in workflow logs for:
```
#8 CACHED
```

## Additional Resources

- [Docker BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [GitHub Actions Cache](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
