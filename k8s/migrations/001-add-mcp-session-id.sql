-- Migration: Add mcp_session_id column to chats table
-- Date: 2025-11-02
-- Description: Adds mcp_session_id column to support MCP session persistence across multiple replicas
--
-- This migration can be run safely on existing databases.
-- It will add the column if it doesn't exist (idempotent).

-- Add mcp_session_id column to chats table
ALTER TABLE chats ADD COLUMN IF NOT EXISTS mcp_session_id VARCHAR(255);

-- Add index on mcp_session_id for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_chats_mcp_session_id ON chats(mcp_session_id);

-- Verify the migration
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'chats' AND column_name = 'mcp_session_id';

-- Display summary
SELECT 'Migration completed successfully' as status;
