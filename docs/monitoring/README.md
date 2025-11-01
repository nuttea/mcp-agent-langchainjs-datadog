# Monitoring Documentation

Complete guides for monitoring the MCP Agent application with Datadog.

## Documentation

- **[DBM_VALIDATION_REPORT.md](DBM_VALIDATION_REPORT.md)** - Database Monitoring validation results
- **[DBM_APM_CORRELATION_SUMMARY.md](DBM_APM_CORRELATION_SUMMARY.md)** - APM and DBM correlation setup
- **[DBM_HOSTNAME_FIX.md](DBM_HOSTNAME_FIX.md)** - Fixing hostname issues in DBM
- **[SCHEMA_COLLECTION_SUMMARY.md](SCHEMA_COLLECTION_SUMMARY.md)** - Database schema collection setup

## Overview

The application is instrumented with Datadog for comprehensive observability:

### Application Performance Monitoring (APM)

- **Distributed Tracing:** End-to-end request tracking across services
- **Custom Instrumentation:** dd-trace integration in Node.js applications
- **Service Map:** Visual representation of service dependencies
- **Performance Metrics:** Response times, error rates, throughput

### Database Monitoring (DBM)

- **Query Metrics:** Execution time, frequency, and resource usage
- **Query Samples:** Actual query examples with execution plans
- **Blocking Queries:** Detection of locks and blocks
- **Schema Collection:** Database structure and table statistics
- **DBM-APM Correlation:** Link database queries to APM traces

## Setup

### 1. Install Datadog Agent

The Datadog Agent runs as a DaemonSet in Kubernetes:

```bash
# Create Datadog secret
kubectl create secret generic datadog-secret \
  --from-literal=DD_API_KEY=your-api-key \
  -n mcp-agent-dev

# Deploy Datadog Agent
kubectl apply -f k8s/base/datadog-agent.yaml
```

### 2. Configure APM

Applications automatically send traces when dd-trace is initialized:

```typescript
// dd-tracer.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'burger-api',
  env: 'dev',
  version: '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
});

export default tracer;
```

### 3. Configure DBM

PostgreSQL must be configured for DBM:

```sql
-- Create datadog user
CREATE USER datadog WITH PASSWORD 'your-password';

-- Grant permissions
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;

-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

ConfigMap for Datadog Agent:

```yaml
postgres_config:
  - host: postgres-0.postgres.mcp-agent-dev.svc.cluster.local
    port: 5432
    username: datadog
    password: your-password
    dbm: true
    query_metrics:
      enabled: true
    query_samples:
      enabled: true
```

## Features

### APM Traces

**What's Tracked:**
- HTTP requests (Express.js)
- Database queries (PostgreSQL via pg)
- External API calls (OpenAI)
- Custom spans

**Example Trace:**
```
GET /api/burgers
  ├─ PostgreSQL: SELECT * FROM burgers
  ├─ PostgreSQL: SELECT * FROM toppings
  └─ Express: Response serialization
```

### Database Queries

**Metrics Collected:**
- Execution time (avg, p50, p95, p99)
- Call count and frequency
- Rows returned
- Buffer usage
- CPU time

**Sample Queries:**
- Full SQL text
- Execution plan (EXPLAIN)
- Parameter values
- Calling service/endpoint

### DBM-APM Correlation

Link database queries to the application traces that generated them:

1. Trace ID injected into SQL comments
2. Datadog correlates query with trace
3. View query performance in context of request

**Example:**
```sql
SELECT * FROM burgers
/* ddtrace_parent_span_id='1234567890', ddtrace_trace_id='9876543210' */
```

## Viewing Metrics

### Datadog UI

1. **APM → Services:** View service-level metrics and traces
2. **APM → Traces:** Search and analyze individual traces
3. **DBM → Databases:** View database performance metrics
4. **DBM → Query Metrics:** Analyze query performance
5. **DBM → Query Samples:** View actual query examples

### Key Dashboards

- **Service Overview:** Request rate, latency, errors
- **Database Performance:** Query throughput, slow queries
- **DBM Overview:** Database health and key metrics
- **Infrastructure:** Host metrics, container resources

## Common Queries

### Find Slow Queries

```sql
-- In Datadog Query Metrics
Sort by: Avg Execution Time DESC
Filter: duration > 100ms
```

### Find Frequent Queries

```sql
-- In Datadog Query Metrics
Sort by: Call Count DESC
Time: Last 1 hour
```

### Trace a Specific Request

```
APM → Traces
Filter: service:burger-api AND resource_name:"/api/burgers"
Sort: Latest
```

## Troubleshooting

### APM Traces Not Appearing

**Check:**
1. DD_API_KEY is set correctly
2. dd-trace is initialized before other imports
3. Agent is running: `kubectl get pods -n mcp-agent-dev | grep datadog`
4. Check application logs for tracer errors

### DBM Queries Not Showing

**Check:**
1. pg_stat_statements extension is installed
2. datadog user has correct permissions
3. DBM is enabled in agent configuration
4. PostgreSQL hostname matches agent configuration

**Verify:**
```bash
# Check agent config
kubectl get configmap datadog-agent-config -n mcp-agent-dev -o yaml

# Check PostgreSQL extension
kubectl exec -it postgres-0 -n mcp-agent-dev -- \
  psql -U burgerapp -d burgerdb -c "SELECT * FROM pg_extension WHERE extname='pg_stat_statements';"
```

### DBM-APM Correlation Not Working

**Check:**
1. dd-trace version supports DBM correlation
2. SQL comments are enabled in tracer config
3. Both APM and DBM are working individually
4. Trace and query timestamps align

**Enable SQL Comments:**
```typescript
tracer.init({
  dbmPropagationMode: 'full', // or 'service'
});
```

### Missing Schema Information

**Check:**
1. Schema collection is enabled
2. datadog user has SELECT permissions
3. Agent can connect to database

**Enable Schema Collection:**
```yaml
postgres_config:
  - collect_schemas:
      enabled: true
```

## Best Practices

1. **Use appropriate log levels** to avoid excessive log volume
2. **Set resource limits** for Datadog Agent
3. **Tag services consistently** for easy filtering
4. **Monitor agent health** in Datadog
5. **Set up alerts** for critical metrics (error rates, slow queries)
6. **Use custom metrics** for business-specific KPIs
7. **Sample traces appropriately** to manage costs
8. **Correlate metrics** across APM, DBM, and logs

## Custom Metrics

Add custom metrics to track business KPIs:

```typescript
import { metrics } from 'dd-trace';

// Increment counter
metrics.increment('burger.order.created', 1, {
  tags: ['burger_type:classic'],
});

// Record gauge
metrics.gauge('burger.orders.pending', pendingCount);

// Record histogram
metrics.histogram('burger.preparation.time', prepTime, {
  tags: ['kitchen:main'],
});
```

## Alerts

Set up alerts for critical conditions:

### High Error Rate
```
avg(last_5m):sum:trace.express.request.errors{service:burger-api} > 10
```

### Slow Database Queries
```
avg(last_10m):avg:postgresql.query.duration{service:postgres} > 0.5
```

### Database Connections
```
avg(last_5m):max:postgresql.connections.active{} > 80
```

## Performance Optimization

### Identify Slow Queries

1. Go to DBM → Query Metrics
2. Sort by Avg Execution Time
3. Click on slow query
4. View execution plan
5. Identify missing indexes or inefficient patterns

### Optimize Application Code

1. Go to APM → Services → burger-api
2. View Top Endpoints
3. Click on slow endpoint
4. Analyze flame graph
5. Identify bottlenecks

### Monitor Resource Usage

1. Go to Infrastructure → Containers
2. Filter by namespace: mcp-agent-dev
3. Check CPU and memory usage
4. Adjust resource limits if needed

## Next Steps

- Deploy application: See [../deployment/](../deployment/)
- Run tests: See [../testing/](../testing/)
- Review architecture: See [../architecture/](../architecture/)

## Additional Resources

- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Datadog DBM Documentation](https://docs.datadoghq.com/database_monitoring/)
- [dd-trace-js Documentation](https://datadoghq.dev/dd-trace-js/)
- [PostgreSQL Monitoring Best Practices](https://docs.datadoghq.com/database_monitoring/setup_postgres/)
