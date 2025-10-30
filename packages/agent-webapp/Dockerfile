# Build from repository root context
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ ./packages/
RUN npm ci
WORKDIR /app/packages/agent-webapp
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/packages/agent-webapp/dist /usr/share/nginx/html
COPY packages/agent-webapp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
