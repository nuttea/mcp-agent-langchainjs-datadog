# Optimized Dockerfile for burger-mcp
# Build from repository root context: docker build -f packages/burger-mcp/Dockerfile -t burger-mcp .

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# ============================================
# Dependencies stage (best caching)
# ============================================
FROM base AS dependencies

COPY package*.json ./
COPY packages/burger-mcp/package*.json ./packages/burger-mcp/

# Install dependencies for this workspace only
RUN npm ci --workspace=burger-mcp --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/burger-mcp/node_modules ./packages/burger-mcp/node_modules

# Copy source code
COPY package*.json ./
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
COPY --from=builder /app/packages/burger-mcp/package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application (burger-mcp uses 'lib' directory)
COPY --from=builder /app/packages/burger-mcp/lib ./lib

# Create non-root user
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["node", "lib/server.js"]

LABEL org.opencontainers.image.title="Burger MCP" \
      org.opencontainers.image.description="Model Context Protocol server for burger operations"
