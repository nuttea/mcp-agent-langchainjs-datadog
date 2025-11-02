# Docker Compose - Local Development Setup

This guide explains how to run the entire MCP Agent application stack locally using Docker Compose.

## Prerequisites

- Docker Desktop (with Docker Compose)
- OpenAI API Key (for agent functionality)
- At least 4GB of available RAM

## Architecture

The local development stack includes:

| Service | Port | Description |
|---------|------|-------------|
| **postgres** | 5432 | PostgreSQL 16 database with sample data |
| **burger-api** | 8080 | Burger ordering REST API (Node.js/Express) |
| **burger-mcp** | 3000 | MCP server for burger operations |
| **agent-api** | 8081 | AI Agent API with LangChain & OpenAI |
| **burger-webapp** | 5173 | Burger ordering frontend (React/Vite) |
| **agent-webapp** | 4280 | AI Agent chat interface (React/Vite) |

## Quick Start

### 1. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local and add your OpenAI API key
# At minimum, set:
# OPENAI_API_KEY=sk-your-key-here
```

### 2. Start All Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

### 3. Access the Applications

Once all services are running:

- **Burger Webapp**: http://localhost:5173
- **Agent Webapp**: http://localhost:4280
- **Burger API**: http://localhost:8080/api
- **Agent API**: http://localhost:8081/api
- **Burger MCP**: http://localhost:3000/mcp
- **PostgreSQL**: localhost:5432

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for agent | `sk-...` |

### Optional - Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `burgerapp` | Database username |
| `POSTGRES_PASSWORD` | `changeme123` | Database password |
| `POSTGRES_DB` | `burgerdb` | Database name |

### Optional - Datadog APM

Enable Datadog APM tracing for local testing:

```bash
DD_TRACE_ENABLED=true
DD_API_KEY=your-datadog-api-key
DD_ENV=local
DD_VERSION=dev
```

### Optional - Performance Issue Flags

For testing Datadog APM anomaly detection:

```bash
PERF_ISSUE_DB_QUERY_LOOPS=true      # Enable N+1 query problem
PERF_ISSUE_DB_POOL_EXHAUST=true     # Reduce connection pool
PERF_ISSUE_CPU_BLOCKING=true        # Add CPU blocking operations
```

See [DATADOG_DEMO_FEATURE_FLAGS.md](DATADOG_DEMO_FEATURE_FLAGS.md) for details.

## Common Commands

### Start Services

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up postgres burger-api

# Start in background
docker-compose up -d
```

### Stop Services

```bash
# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove containers + volumes (deletes data)
docker-compose down -v
```

### View Logs

```bash
# View all logs
docker-compose logs

# Follow logs (live tail)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f burger-api

# View last 50 lines
docker-compose logs --tail=50
```

### Rebuild Services

```bash
# Rebuild all services
docker-compose build

# Rebuild specific service
docker-compose build burger-api

# Rebuild and restart
docker-compose up --build -d
```

### Execute Commands in Containers

```bash
# Open shell in burger-api container
docker-compose exec burger-api sh

# Run PostgreSQL command
docker-compose exec postgres psql -U burgerapp -d burgerdb

# Check database tables
docker-compose exec postgres psql -U burgerapp -d burgerdb -c "\dt"
```

## Development Workflow

### Making Code Changes

The docker-compose setup includes volume mounts for source code:

```yaml
volumes:
  - ./packages/burger-api/src:/app/packages/burger-api/src:ro
```

However, changes require rebuilding:

```bash
# Rebuild and restart after code changes
docker-compose up --build -d service-name
```

For active development with hot-reload, consider running services outside Docker:

```bash
# Stop docker services you're developing
docker-compose stop burger-api agent-api

# Run locally with npm (from project root)
npm run start
```

This gives you:
- Hot module replacement
- Faster feedback loop
- Better debugging experience

You can still use Docker for PostgreSQL, MCPserver, and webapps.

### Database Management

#### Reset Database

```bash
# Stop and remove database volume
docker-compose down -v

# Restart (will reinitialize)
docker-compose up -d postgres

# Wait for initialization
docker-compose logs -f postgres
```

#### Access Database

```bash
# Using psql in container
docker-compose exec postgres psql -U burgerapp -d burgerdb

# Or connect from your host
psql -h localhost -p 5432 -U burgerapp -d burgerdb

# View sample burgers
docker-compose exec postgres psql -U burgerapp -d burgerdb -c "SELECT * FROM burgers;"
```

#### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U burgerapp burgerdb > backup.sql

# Restore backup
cat backup.sql | docker-compose exec -T postgres psql -U burgerapp -d burgerdb
```

## Troubleshooting

### Ports Already in Use

If you see errors about ports already in use:

```bash
# Check what's using the port
lsof -i :8080
lsof -i :5432

# Kill the process or change ports in docker-compose.yaml:
ports:
  - "8081:8080"  # Map to different host port
```

### Services Won't Start

```bash
# Check service status
docker-compose ps

# Check service logs
docker-compose logs service-name

# Restart specific service
docker-compose restart service-name
```

### Database Connection Issues

```bash
# Check postgres is healthy
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Verify connection from api
docker-compose exec burger-api ping postgres
```

### Out of Memory

```bash
# Check Docker resource usage
docker stats

# Increase Docker Desktop memory in Preferences > Resources
# Recommended: At least 4GB for full stack
```

### Clean Start

```bash
# Nuclear option: remove everything and start fresh
docker-compose down -v
docker system prune -a
docker-compose up --build
```

## Testing with Datadog APM

To test Datadog APM locally:

1. Set environment variables in `.env.local`:
```bash
DD_TRACE_ENABLED=true
DD_API_KEY=your-dd-api-key
DD_ENV=local
DD_VERSION=dev
DD_PROFILING_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true
```

2. Restart services:
```bash
docker-compose up -d --build
```

3. Generate traffic:
```bash
# Test burger API
curl http://localhost:8080/api/burgers

# Test agent API
curl http://localhost:8081/api
```

4. View traces in Datadog APM:
   - Go to APM > Services
   - Filter by env:local
   - You should see `burger-api` and `agent-api` services

## Performance Testing

Enable performance issue flags to test Datadog anomaly detection:

```bash
# Edit .env.local
PERF_ISSUE_DB_QUERY_LOOPS=true
PERF_ISSUE_DB_POOL_EXHAUST=true
PERF_ISSUE_CPU_BLOCKING=true

# Restart
docker-compose up -d --build burger-api

# Generate load
for i in {1..100}; do curl -s http://localhost:8080/api/burgers > /dev/null; done

# Check Datadog APM for:
# - Increased query counts
# - Higher latencies
# - CPU usage spikes
```

## VS Code Integration

Add this to `.vscode/tasks.json` for quick commands:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Docker: Start All",
      "type": "shell",
      "command": "docker-compose up -d"
    },
    {
      "label": "Docker: Stop All",
      "type": "shell",
      "command": "docker-compose down"
    },
    {
      "label": "Docker: View Logs",
      "type": "shell",
      "command": "docker-compose logs -f"
    },
    {
      "label": "Docker: Rebuild",
      "type": "shell",
      "command": "docker-compose up --build -d"
    }
  ]
}
```

## Next Steps

- **Production Deployment**: See [GKE_DEPLOYMENT_SUMMARY.md](GKE_DEPLOYMENT_SUMMARY.md)
- **Feature Flags**: See [DATADOG_DEMO_FEATURE_FLAGS.md](DATADOG_DEMO_FEATURE_FLAGS.md)
- **API Documentation**: Access Swagger/OpenAPI docs at http://localhost:8080/api/docs

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- View container status: `docker-compose ps`
- Restart services: `docker-compose restart`
- Clean slate: `docker-compose down -v && docker-compose up --build`
