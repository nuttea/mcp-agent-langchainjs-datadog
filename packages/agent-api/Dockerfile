# Simplified Dockerfile for agent-api
# Build from repository root context: docker build -f packages/agent-api/Dockerfile -t agent-api .

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy all package files
COPY package*.json ./
COPY packages/agent-api/package*.json ./packages/agent-api/

# Install all dependencies (including workspace)
RUN npm ci --workspace=agent-api --include-workspace-root

# Install missing runtime dependencies that aren't being installed by workspace
RUN npm install express@^4.18.2 cors@^2.8.5

# Copy source code
COPY packages/agent-api ./packages/agent-api

# Build the application
WORKDIR /app/packages/agent-api
RUN npm run build

# ============================================
# Production stage
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/agent-api/package*.json ./

# Copy built application
COPY --from=builder /app/packages/agent-api/dist ./dist

# Copy all node_modules from builder (workspace installs at root level)
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user for security (required by K8s security policies)
# Use node user that already exists in node:22-alpine
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080

# Health check for Kubernetes liveness/readiness probes
# Adjust the /health endpoint to match your actual health check route
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the Express server with source map support for TypeScript
CMD ["node", "--enable-source-maps", "dist/src/express-server.js"]

# Build metadata labels
LABEL org.opencontainers.image.title="MCP Agent API" \
      org.opencontainers.image.description="AI agent API using LangChain.js and Model Context Protocol" \
      org.opencontainers.image.vendor="MCP Agent Team"
