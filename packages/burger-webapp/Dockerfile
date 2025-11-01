# Optimized Dockerfile for burger-webapp
# Build from repository root context: docker build -f packages/burger-webapp/Dockerfile -t burger-webapp .

FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
WORKDIR /app

# ============================================
# Dependencies stage (best caching)
# ============================================
FROM base AS dependencies

COPY package*.json ./
COPY packages/burger-webapp/package*.json ./packages/burger-webapp/

# Install dependencies for this workspace only
RUN npm ci --workspace=burger-webapp --include-workspace-root

# ============================================
# Builder stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/burger-webapp/node_modules ./packages/burger-webapp/node_modules

# Copy source code
COPY package*.json ./
COPY packages/burger-webapp ./packages/burger-webapp

# Build the application (Vite build)
WORKDIR /app/packages/burger-webapp
RUN npm run build

# ============================================
# Production stage (nginx)
# ============================================
FROM nginx:alpine AS production

# Copy built static files
COPY --from=builder /app/packages/burger-webapp/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/burger-webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for nginx
RUN addgroup -g 101 nginx || true && \
    adduser -u 101 -G nginx -s /bin/sh -D nginx || true

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

LABEL org.opencontainers.image.title="Burger Webapp" \
      org.opencontainers.image.description="Burger restaurant frontend application"
