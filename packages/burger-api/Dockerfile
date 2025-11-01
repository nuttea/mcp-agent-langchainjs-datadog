# Optimized Dockerfile for burger-api
# Build from repository root context: docker build -f packages/burger-api/Dockerfile -t burger-api .

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# ============================================
# Dependencies stage (best caching)
# ============================================
FROM base AS dependencies

COPY package*.json ./
COPY packages/burger-api/package*.json ./packages/burger-api/

# Install dependencies for this workspace only
RUN npm ci --workspace=burger-api --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/burger-api/node_modules ./packages/burger-api/node_modules

# Copy source code
COPY package*.json ./
COPY packages/burger-api ./packages/burger-api

# Build the application
WORKDIR /app/packages/burger-api
RUN npm run build

# ============================================
# Production stage
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY --from=builder /app/packages/burger-api/package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/packages/burger-api/dist ./dist

# Create non-root user
RUN addgroup -g 1000 nodejs && \
    adduser -u 1000 -G nodejs -s /bin/sh -D nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

ENV NODE_ENV=production \
    PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

CMD ["node", "dist/src/express-server.js"]

LABEL org.opencontainers.image.title="Burger API" \
      org.opencontainers.image.description="Burger restaurant API service"
