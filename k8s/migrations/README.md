# Database Migrations

This directory contains SQL migration scripts for the PostgreSQL database.

## How to Run Migrations

### Option 1: Using kubectl (Recommended for Production)

Run migrations against a specific environment:

```bash
# For dev environment
kubectl exec -n mcp-agent-dev statefulset/postgres -it -- \
  psql -U burgerapp -d burgerdb -f /path/to/migration.sql

# For prod environment
kubectl exec -n mcp-agent-prod statefulset/postgres -it -- \
  psql -U burgerapp -d burgerdb -f /path/to/migration.sql
```

### Option 2: Using Port-Forward

```bash
# 1. Setup port-forward to PostgreSQL
kubectl port-forward -n mcp-agent-prod statefulset/postgres 5432:5432 &

# 2. Get database credentials
POSTGRES_USER=$(kubectl get secret postgres-secret -n mcp-agent-prod -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)
POSTGRES_PASSWORD=$(kubectl get secret postgres-secret -n mcp-agent-prod -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
POSTGRES_DB=$(kubectl get secret postgres-secret -n mcp-agent-prod -o jsonpath='{.data.POSTGRES_DB}' | base64 -d)

# 3. Run migration
PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -f k8s/migrations/001-add-mcp-session-id.sql

# 4. Kill port-forward when done
pkill -f "port-forward.*postgres"
```

### Option 3: Copy File into Pod

```bash
# Copy migration file to pod
kubectl cp k8s/migrations/001-add-mcp-session-id.sql \
  mcp-agent-prod/postgres-0:/tmp/migration.sql

# Execute migration
kubectl exec -n mcp-agent-prod statefulset/postgres -it -- \
  psql -U burgerapp -d burgerdb -f /tmp/migration.sql

# Clean up
kubectl exec -n mcp-agent-prod statefulset/postgres -it -- rm /tmp/migration.sql
```

## Migration List

| ID | Name | Description | Date |
|----|------|-------------|------|
| 001 | add-mcp-session-id | Adds `mcp_session_id` column to `chats` table for MCP session persistence across replicas | 2025-11-02 |

## Migration 001: Add MCP Session ID

**Purpose:** Fixes the "No valid session ID provided" error in multi-replica deployments by storing MCP session IDs in the database.

**Changes:**
- Adds `mcp_session_id VARCHAR(255)` column to `chats` table
- Adds index on `mcp_session_id` for performance
- Idempotent (safe to run multiple times)

**Required:** This migration must be applied before deploying the agent-api code changes that use MCP session persistence.

## Rollback

If you need to rollback migration 001:

```sql
-- Remove column
ALTER TABLE chats DROP COLUMN IF EXISTS mcp_session_id;

-- Remove index
DROP INDEX IF EXISTS idx_chats_mcp_session_id;
```

## Best Practices

1. **Always test migrations in dev first**
2. **Backup database before production migrations**
3. **Run migrations during low-traffic periods**
4. **Verify migration success before deploying new code**
5. **Keep migration scripts idempotent when possible**

## Verification

After running a migration, verify it succeeded:

```bash
# Check column exists
kubectl exec -n mcp-agent-prod statefulset/postgres -it -- \
  psql -U burgerapp -d burgerdb -c "\d chats"

# Check index exists
kubectl exec -n mcp-agent-prod statefulset/postgres -it -- \
  psql -U burgerapp -d burgerdb -c "\di idx_chats_mcp_session_id"
```
