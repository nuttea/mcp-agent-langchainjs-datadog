# Datadog APM Demo - Performance Issue Feature Flags

This document describes the performance issue injection feature flags designed for demonstrating Datadog APM and Watchdog anomaly detection capabilities.

## Overview

The burger-api service includes three feature flags that intentionally inject performance issues. These flags are **disabled by default** and should only be enabled for demo purposes.

## Feature Flags

### 1. N+1 Query Problem

**Environment Variable:** `PERF_ISSUE_DB_QUERY_LOOPS=true`

**What it does:**
- Injects redundant database queries in the `GET /api/burgers` endpoint
- For each burger retrieved, executes 5 additional unnecessary queries
- Creates a classic N+1 query performance anti-pattern

**Expected Datadog APM signals:**
- Increased database query count
- Higher database latency
- Slower endpoint response times
- APM trace showing multiple sequential database calls

**Example scenario:**
```bash
# Enable N+1 query problem
kubectl set env deployment/burger-api PERF_ISSUE_DB_QUERY_LOOPS=true -n mcp-agent-dev

# Generate load
for i in {1..100}; do curl http://your-service/api/burgers; done
```

### 2. Connection Pool Exhaustion

**Environment Variable:** `PERF_ISSUE_DB_POOL_EXHAUST=true`

**What it does:**
- Reduces PostgreSQL connection pool size from 10 to 2 connections
- Causes connection contention under concurrent load
- Results in requests waiting for available database connections

**Expected Datadog APM signals:**
- Increased connection wait times
- Higher P95/P99 latencies
- Potential connection timeout errors under heavy load
- APM showing time spent waiting for database connections

**Example scenario:**
```bash
# Enable connection pool exhaustion
kubectl set env deployment/burger-api PERF_ISSUE_DB_POOL_EXHAUST=true -n mcp-agent-dev

# Generate concurrent load
ab -n 1000 -c 20 http://your-service/api/burgers
```

### 3. CPU Blocking

**Environment Variable:** `PERF_ISSUE_CPU_BLOCKING=true`

**What it does:**
- Adds 100ms of synchronous CPU-intensive operations to `GET /api/burgers`
- Blocks the Node.js event loop with useless computation
- Prevents other requests from being processed during blocking

**Expected Datadog APM signals:**
- Increased CPU utilization
- Higher response times
- Degraded throughput
- Runtime metrics showing event loop delays
- APM showing time spent in CPU-bound operations

**Example scenario:**
```bash
# Enable CPU blocking
kubectl set env deployment/burger-api PERF_ISSUE_CPU_BLOCKING=true -n mcp-agent-dev

# Generate load to observe throughput degradation
ab -n 500 -c 10 http://your-service/api/burgers
```

## Enabling Flags in Kubernetes

Feature flags are managed via the `burger-api-perf-flags` ConfigMap, which is automatically deployed with the application.

### Method 1: Edit ConfigMap (Recommended)

This is the cleanest approach as flags are managed centrally in the ConfigMap:

```bash
# Edit the ConfigMap directly
kubectl edit configmap burger-api-perf-flags -n mcp-agent-dev
```

Change the values from `"false"` to `"true"` to enable:
```yaml
data:
  PERF_ISSUE_DB_QUERY_LOOPS: "true"      # Enable N+1 query problem
  PERF_ISSUE_DB_POOL_EXHAUST: "true"     # Enable connection pool exhaustion
  PERF_ISSUE_CPU_BLOCKING: "true"        # Enable CPU blocking
```

After editing, restart the deployment to apply changes:
```bash
kubectl rollout restart deployment/burger-api -n mcp-agent-dev
```

### Method 2: Patch ConfigMap with kubectl

Enable individual flags using kubectl patch:
```bash
# Enable N+1 query problem
kubectl patch configmap burger-api-perf-flags -n mcp-agent-dev \
  -p '{"data":{"PERF_ISSUE_DB_QUERY_LOOPS":"true"}}'

# Enable connection pool exhaustion
kubectl patch configmap burger-api-perf-flags -n mcp-agent-dev \
  -p '{"data":{"PERF_ISSUE_DB_POOL_EXHAUST":"true"}}'

# Enable CPU blocking
kubectl patch configmap burger-api-perf-flags -n mcp-agent-dev \
  -p '{"data":{"PERF_ISSUE_CPU_BLOCKING":"true"}}'

# Restart deployment to apply
kubectl rollout restart deployment/burger-api -n mcp-agent-dev
```

Disable flags by setting back to `"false"`:
```bash
kubectl patch configmap burger-api-perf-flags -n mcp-agent-dev \
  -p '{"data":{"PERF_ISSUE_DB_QUERY_LOOPS":"false","PERF_ISSUE_DB_POOL_EXHAUST":"false","PERF_ISSUE_CPU_BLOCKING":"false"}}'

kubectl rollout restart deployment/burger-api -n mcp-agent-dev
```

### Method 3: Using kubectl set env (Alternative)

You can also override ConfigMap values using environment variables on the deployment:

```bash
# Enable individual flags
kubectl set env deployment/burger-api PERF_ISSUE_DB_QUERY_LOOPS=true -n mcp-agent-dev
kubectl set env deployment/burger-api PERF_ISSUE_DB_POOL_EXHAUST=true -n mcp-agent-dev
kubectl set env deployment/burger-api PERF_ISSUE_CPU_BLOCKING=true -n mcp-agent-dev

# Enable all flags at once
kubectl set env deployment/burger-api \
  PERF_ISSUE_DB_QUERY_LOOPS=true \
  PERF_ISSUE_DB_POOL_EXHAUST=true \
  PERF_ISSUE_CPU_BLOCKING=true \
  -n mcp-agent-dev

# Disable flags (remove env overrides)
kubectl set env deployment/burger-api \
  PERF_ISSUE_DB_QUERY_LOOPS- \
  PERF_ISSUE_DB_POOL_EXHAUST- \
  PERF_ISSUE_CPU_BLOCKING- \
  -n mcp-agent-dev
```

**Note:** Method 3 overrides the ConfigMap values. For cleaner management, use Method 1 or 2.

### Method 4: Using Kustomize (For Persistent Changes)

If you want to make persistent changes via Kustomize, edit the ConfigMap file directly:

```bash
# Edit the ConfigMap source file
vi k8s/overlays/dev/configmap-perf-flags.yaml
```

Change the values in the `data` section:
```yaml
data:
  PERF_ISSUE_DB_QUERY_LOOPS: "true"
  PERF_ISSUE_DB_POOL_EXHAUST: "true"
  PERF_ISSUE_CPU_BLOCKING: "true"
```

Then apply with kustomize:
```bash
kubectl apply -k k8s/overlays/dev
```

## Demo Scenarios

### Scenario 1: Database Performance Issues

**Goal:** Demonstrate Datadog APM detecting database query problems

**Steps:**
1. Deploy application with normal configuration
2. Generate baseline traffic and observe normal APM traces
3. Enable `PERF_ISSUE_DB_QUERY_LOOPS=true`
4. Generate traffic to `/api/burgers`
5. Show in Datadog APM:
   - Increased number of database queries per request
   - Higher database latency
   - APM trace waterfall showing N+1 pattern

### Scenario 2: Resource Exhaustion

**Goal:** Demonstrate Datadog Watchdog detecting resource exhaustion

**Steps:**
1. Enable `PERF_ISSUE_DB_POOL_EXHAUST=true`
2. Generate high concurrent load
3. Show in Datadog:
   - Connection pool metrics
   - Increased P99 latency
   - Watchdog alert on latency anomaly

### Scenario 3: CPU Performance Degradation

**Goal:** Demonstrate runtime performance monitoring

**Steps:**
1. Enable `PERF_ISSUE_CPU_BLOCKING=true`
2. Generate steady traffic
3. Show in Datadog:
   - Increased CPU usage
   - Event loop delays
   - Degraded throughput
   - APM showing time spent in blocking operations

### Scenario 4: Combined Issues

**Goal:** Demonstrate complex performance problem diagnosis

**Steps:**
1. Enable all three flags
2. Generate varied traffic patterns
3. Show in Datadog:
   - Multiple performance signals
   - Correlation between different metrics
   - APM helping identify root causes

## Verification

When flags are enabled, you'll see warning messages in the application logs:

```
⚠️  Performance Issue Flags Enabled: dbQueryLoops, dbPoolExhaust, cpuBlocking
   These flags intentionally degrade performance for demo purposes.
⚠️  DB Pool size reduced to 2 (PERF_ISSUE_DB_POOL_EXHAUST=true)
⚠️  Injecting N+1 query problem: Running 5 redundant queries per burger
⚠️  Injecting CPU blocking: 100ms synchronous operation
```

Check logs:
```bash
kubectl logs -n mcp-agent-dev deployment/burger-api --tail=50
```

## Load Testing

Generate load to make issues visible in Datadog:

Using curl:
```bash
# Simple sequential load
for i in {1..100}; do
  curl -s http://your-service/api/burgers > /dev/null
  echo "Request $i completed"
done
```

Using Apache Bench:
```bash
# Concurrent load
ab -n 1000 -c 20 http://your-service/api/burgers
```

Using hey:
```bash
# Modern load testing tool
hey -n 1000 -c 20 http://your-service/api/burgers
```

## Important Notes

- **These flags intentionally degrade performance** - only use in demo/test environments
- Flags are disabled by default for safety
- Each flag is independent - you can enable them individually or in combination
- Monitor Datadog APM and logs to verify flags are working as expected
- Remember to disable flags after demos to restore normal performance

## Troubleshooting

**Flag not taking effect:**
- Verify environment variable is set: `kubectl describe deployment burger-api -n mcp-agent-dev`
- Check pod logs for warning messages
- Ensure pods restarted after setting environment variables

**Not seeing performance impact:**
- Generate sufficient load to make issues visible
- Check Datadog APM for the time period when load was generated
- Verify Datadog agent is properly configured and collecting metrics

**Too much performance impact:**
- Adjust flag parameters in [feature-flags.ts](packages/burger-api/src/feature-flags.ts):
  - `getQueryLoopCount()` - default is 5 loops
  - `getDbPoolSize()` - default is 2 connections
  - `getCpuBlockingDuration()` - default is 100ms

## References

- Implementation: [packages/burger-api/src/feature-flags.ts](packages/burger-api/src/feature-flags.ts)
- Database integration: [packages/burger-api/src/db-service.ts](packages/burger-api/src/db-service.ts)
- API integration: [packages/burger-api/src/express-server.ts](packages/burger-api/src/express-server.ts)
