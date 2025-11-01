# Optimized Dockerfile for agent-webapp
# Build from repository root context: docker build -f packages/agent-webapp/Dockerfile -t agent-webapp .

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# ============================================
# Dependencies stage (best caching)
# ============================================
FROM base AS dependencies

COPY package*.json ./
COPY packages/agent-webapp/package*.json ./packages/agent-webapp/

# Install dependencies for this workspace only
RUN npm ci --workspace=agent-webapp --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages

# Copy source code
COPY package*.json ./
COPY packages/agent-webapp ./packages/agent-webapp

# Build the application (Vite build)
WORKDIR /app/packages/agent-webapp
RUN npm run build

# ============================================
# Production stage (nginx)
# ============================================
FROM nginx:alpine AS production

# Copy built static files
COPY --from=builder /app/packages/agent-webapp/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/agent-webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for nginx
RUN addgroup -g 101 nginx || true && \
    adduser -u 101 -G nginx -s /bin/sh -D nginx || true

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

LABEL org.opencontainers.image.title="Agent Webapp" \
      org.opencontainers.image.description="AI agent frontend application"
