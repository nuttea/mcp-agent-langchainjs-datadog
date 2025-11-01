# Optimized Dockerfile for agent-api
# Build from repository root context: docker build -f packages/agent-api/Dockerfile.optimized -t agent-api .
#
# Key optimizations:
# 1. Separate dependencies layer for better caching
# 2. Workspace-specific npm ci for faster installs
# 3. Multi-stage build for smaller final image
# 4. Security: non-root user
# 5. Health check for Kubernetes readiness

# ============================================
# Base stage with common dependencies
# ============================================
FROM node:22-alpine AS base

# Install build dependencies (only if native modules needed)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# ============================================
# Dependencies stage (best caching)
# ============================================
FROM base AS dependencies

# Copy only package manifests (these change less frequently)
COPY package*.json ./
COPY packages/agent-api/package*.json ./packages/agent-api/

# Install dependencies for this workspace only (much faster than all workspaces)
# This layer will be cached unless package.json changes
RUN npm ci --workspace=agent-api --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy installed dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/agent-api/node_modules ./packages/agent-api/node_modules

# Copy source code (these change frequently, so copy after deps)
COPY package*.json ./
COPY packages/agent-api ./packages/agent-api

# Build the application
WORKDIR /app/packages/agent-api
RUN npm run build

# ============================================
# Production stage (minimal final image)
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files for production install
COPY --from=builder /app/packages/agent-api/package*.json ./

# Install ONLY production dependencies (no dev dependencies)
# Use --ignore-scripts to skip post-install scripts (faster)
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/packages/agent-api/dist ./dist

# Create non-root user for security (required by K8s security policies)
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080

# Health check for Kubernetes liveness/readiness probes
# Adjust the /health endpoint to match your actual health check route
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the Express server
CMD ["node", "dist/src/express-server.js"]

# Build metadata labels
LABEL org.opencontainers.image.title="MCP Agent API" \
      org.opencontainers.image.description="AI agent API using LangChain.js and Model Context Protocol" \
      org.opencontainers.image.vendor="MCP Agent Team"
