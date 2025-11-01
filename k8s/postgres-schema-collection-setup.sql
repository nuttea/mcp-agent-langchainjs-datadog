-- Datadog Database Monitoring - Schema Collection Setup
-- Based on: https://docs.datadoghq.com/database_monitoring/setup_postgres/selfhosted/

-- 1. Create function to collect table definitions (PostgreSQL 10+)
CREATE OR REPLACE FUNCTION datadog.get_table_definitions()
RETURNS TABLE (
    table_schema text,
    table_name text,
    table_type text,
    table_owner text
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.table_schema::text,
        c.table_name::text,
        c.table_type::text,
        t.tableowner::text
    FROM information_schema.tables c
    JOIN pg_tables t ON c.table_name = t.tablename AND c.table_schema = t.schemaname
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema');
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

-- 2. Grant execute permission to datadog user
GRANT EXECUTE ON FUNCTION datadog.get_table_definitions() TO datadog;

-- 3. Grant necessary permissions to read schema information
GRANT SELECT ON information_schema.tables TO datadog;
GRANT SELECT ON information_schema.columns TO datadog;
GRANT SELECT ON information_schema.table_constraints TO datadog;
GRANT SELECT ON information_schema.key_column_usage TO datadog;
GRANT SELECT ON information_schema.referential_constraints TO datadog;
GRANT SELECT ON information_schema.constraint_column_usage TO datadog;

-- Grant access to pg_catalog for reading table and column metadata
GRANT SELECT ON pg_catalog.pg_class TO datadog;
GRANT SELECT ON pg_catalog.pg_namespace TO datadog;
GRANT SELECT ON pg_catalog.pg_attribute TO datadog;
GRANT SELECT ON pg_catalog.pg_type TO datadog;
GRANT SELECT ON pg_catalog.pg_index TO datadog;
GRANT SELECT ON pg_catalog.pg_constraint TO datadog;
GRANT SELECT ON pg_catalog.pg_description TO datadog;

-- 4. Verify schema collection function
SELECT * FROM datadog.get_table_definitions() LIMIT 5;
