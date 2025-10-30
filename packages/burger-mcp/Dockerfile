# Build from repository root context
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
WORKDIR /app/packages/burger-mcp
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/packages/burger-mcp/package*.json ./
COPY --from=builder /app/package-lock.json /app/package-lock.json
RUN npm ci --only=production --ignore-scripts
COPY --from=builder /app/packages/burger-mcp/lib ./lib
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "lib/server.js"]
