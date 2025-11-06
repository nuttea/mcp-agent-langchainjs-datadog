# Simplified Dockerfile for burger-mcp
# Build from repository root context: docker build -f packages/burger-mcp/Dockerfile -t burger-mcp .

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy all package files
COPY package*.json ./
COPY packages/burger-mcp/package*.json ./packages/burger-mcp/

# Install all dependencies (including workspace)
RUN npm ci --workspace=burger-mcp --include-workspace-root --ignore-scripts

# Copy source code
COPY packages/burger-mcp ./packages/burger-mcp

# Build the application
WORKDIR /app/packages/burger-mcp
RUN npm run build

# ============================================
# Production stage
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/burger-mcp/package*.json ./

# Copy built application
COPY --from=builder /app/packages/burger-mcp/lib ./lib

# Copy all node_modules from builder (workspace installs at root level)
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user for security (required by K8s security policies)
# Use node user that already exists in node:22-alpine
RUN chown -R node:node /app

USER node

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["node", "--enable-source-maps", "lib/server.js"]

LABEL org.opencontainers.image.title="Burger MCP" \
      org.opencontainers.image.description="Model Context Protocol server for burger operations"
