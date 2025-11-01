# Build from repository root context
# docker build -f packages/burger-api/Dockerfile -t burger-api .

FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files (monorepo)
COPY package*.json ./

# Copy all workspace packages (needed for monorepo)
COPY packages/ ./packages/

# Install all dependencies
RUN npm ci

# Build burger-api
WORKDIR /app/packages/burger-api
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy only burger-api package files
COPY --from=builder /app/packages/burger-api/package*.json ./

# Install production dependencies (use npm install instead of npm ci since we don't have full workspace)
RUN npm install --production --no-package-lock

# Install additional runtime dependencies
RUN npm install express cors --no-save

# Copy built application
COPY --from=builder /app/packages/burger-api/dist ./dist

# Copy data directory with images and JSON files
COPY --from=builder /app/packages/burger-api/data ./data

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the Express server
CMD ["node", "dist/src/express-server.js"]
