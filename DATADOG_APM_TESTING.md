# Datadog APM Testing Guide

This guide explains how to test and verify Datadog APM integration using the simulation endpoints added to the agent-api service.

## Overview

The agent-api service includes three simulation endpoints designed to help you verify that Datadog APM is correctly tracking errors and latency in your application:

1. **Error Simulation** - Tests error tracking and alerting
2. **Latency Simulation** - Tests performance monitoring and latency alerts
3. **Slow Error Simulation** - Tests combined error + latency scenarios

## Simulation Endpoints

### 1. Error Endpoint

**Purpose**: Generates a 500 Internal Server Error to test Datadog APM error tracking.

**Endpoint**: `GET /api/simulate/error`

**What it does**:
- Logs an error message that Datadog can correlate with the trace
- Throws an error with code `SIMULATED_ERROR`
- Returns HTTP 500 status
- Shows up in Datadog APM as an error on the `express.request` operation

**Example Request**:
```bash
# Local (Docker Compose)
curl http://localhost:8081/api/simulate/error

# Development environment
curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error

# Production environment
curl https://agent-api-prod.platform-engineering-demo.dev/api/simulate/error
```

**Expected Response**:
```json
{
  "error": "Simulated error for Datadog APM testing"
}
```

### 2. Latency Endpoint

**Purpose**: Simulates high latency to test Datadog APM latency monitoring and alerts.

**Endpoint**: `GET /api/simulate/latency?delay=<milliseconds>`

**Parameters**:
- `delay` (optional): Latency in milliseconds (default: 2000ms, max: 10000ms)

**What it does**:
- Introduces configurable artificial delay
- Returns successful response after delay
- Allows testing of latency thresholds and alerts

**Example Requests**:
```bash
# Default 2 second latency
curl http://localhost:8081/api/simulate/latency

# Custom 3.5 second latency
curl http://localhost:8081/api/simulate/latency?delay=3500

# Maximum 10 second latency
curl http://localhost:8081/api/simulate/latency?delay=15000  # Capped at 10s

# Development environment
curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=5000

# Production environment
curl https://agent-api-prod.platform-engineering-demo.dev/api/simulate/latency?delay=3000
```

**Expected Response**:
```json
{
  "status": "success",
  "message": "Simulated 3500ms latency",
  "timestamp": "2025-11-02T10:30:45.123Z"
}
```

### 3. Slow Error Endpoint

**Purpose**: Combines latency and error to test complex failure scenarios.

**Endpoint**: `GET /api/simulate/slow-error?delay=<milliseconds>`

**Parameters**:
- `delay` (optional): Latency before error in milliseconds (default: 1500ms, max: 10000ms)

**What it does**:
- Introduces artificial delay
- Logs a warning message
- Throws an error with code `SIMULATED_SLOW_ERROR`
- Tests scenarios where slow requests also fail

**Example Requests**:
```bash
# Default 1.5 second delay before error
curl http://localhost:8081/api/simulate/slow-error

# Custom 2.5 second delay before error
curl http://localhost:8081/api/simulate/slow-error?delay=2500

# Development environment
curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/slow-error?delay=2000

# Production environment
curl https://agent-api-prod.platform-engineering-demo.dev/api/simulate/slow-error?delay=1800
```

**Expected Response**:
```json
{
  "error": "Simulated slow error for Datadog APM testing"
}
```

## Testing Scenarios

### Scenario 1: Verify Error Tracking

**Objective**: Confirm that errors are captured in Datadog APM with correct tags and traces.

**Steps**:
1. Call the error endpoint multiple times:
   ```bash
   for i in {1..10}; do curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error; sleep 1; done
   ```

2. In Datadog APM, navigate to **APM → Services → agent-api**

3. Check the **Errors** tab and verify:
   - Error rate increases
   - Error type shows "Error: Simulated error for Datadog APM testing"
   - Error code is `SIMULATED_ERROR`
   - Stack traces are captured
   - Logs are correlated with traces

4. Check **APM → Traces** and filter by `error:true` and `service:agent-api`

5. Verify trace details show:
   - Resource name: `GET /api/simulate/error`
   - Operation name: `express.request`
   - HTTP status: 500
   - Error message in trace

### Scenario 2: Verify Latency Monitoring

**Objective**: Confirm that high latency is tracked and displayed in Datadog APM.

**Steps**:
1. Generate requests with varying latency:
   ```bash
   # 2 second latency
   curl "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=2000"

   # 5 second latency
   curl "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=5000"

   # 8 second latency
   curl "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=8000"
   ```

2. In Datadog APM, navigate to **APM → Services → agent-api**

3. Check the **Latency** tab and verify:
   - P50, P75, P95, P99 percentiles increase
   - Latency distribution shows requests in the 2-8 second range
   - Latency heatmap shows the delayed requests

4. Check the **Traces** tab and filter by high duration

5. Verify that slow traces show:
   - Resource name: `GET /api/simulate/latency`
   - Duration matches the requested delay
   - No errors (status 200)

### Scenario 3: Test Alert Configuration

**Objective**: Use simulation endpoints to trigger and test Datadog monitors.

**Steps**:
1. Create a Datadog monitor for error rate:
   - Go to **Monitors → New Monitor → APM**
   - Select metric: `trace.express.request.errors`
   - Set threshold: > 5 errors in 5 minutes
   - Set service: `agent-api`

2. Trigger the alert:
   ```bash
   # Generate 10 errors in quick succession
   for i in {1..10}; do
     curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error
     sleep 2
   done
   ```

3. Create a Datadog monitor for high latency:
   - Go to **Monitors → New Monitor → APM**
   - Select metric: `trace.express.request.duration` P95
   - Set threshold: > 1.5 seconds
   - Set service: `agent-api`

4. Trigger the alert:
   ```bash
   # Generate high latency requests
   for i in {1..5}; do
     curl "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=3000"
     sleep 5
   done
   ```

5. Verify that:
   - Alerts are triggered in Datadog
   - Alert notifications are sent (email, Slack, etc.)
   - Alert contains correct trace context

### Scenario 4: Load Testing

**Objective**: Generate sustained load to test APM under realistic conditions.

**Steps**:
1. Install a load testing tool (e.g., `ab`, `wrk`, or `hey`):
   ```bash
   # Using hey (https://github.com/rakyll/hey)
   brew install hey  # macOS
   ```

2. Generate mixed traffic pattern:
   ```bash
   # Terminal 1: Generate successful requests
   hey -n 1000 -c 10 -q 5 "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/latency?delay=100"

   # Terminal 2: Generate errors
   hey -n 100 -c 5 -q 2 "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error"

   # Terminal 3: Generate slow requests
   hey -n 50 -c 2 -q 1 "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/slow-error?delay=2000"
   ```

3. Monitor in Datadog:
   - Watch real-time metrics in APM service overview
   - Check if error rate percentage is calculated correctly
   - Verify throughput (requests per second)
   - Check resource consumption (CPU, memory)

### Scenario 5: Test Distributed Tracing

**Objective**: Verify that traces flow through the entire application stack.

**Steps**:
1. Generate requests that exercise the full stack:
   ```bash
   # Make actual chat requests that will:
   # - Hit agent-api
   # - Connect to burger-mcp
   # - Query PostgreSQL
   # - Call LLM APIs
   curl -X POST https://agent-api-dev.platform-engineering-demo.dev/api/chats/stream \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [{"role": "user", "content": "Show me all burgers"}],
       "sessionId": "test-session-123",
       "stream": false
     }'
   ```

2. In Datadog APM, find the trace and verify:
   - agent-api span is the parent
   - PostgreSQL query spans are children
   - HTTP calls to burger-mcp are tracked
   - LLM API calls are captured
   - All spans are correctly connected

3. Compare with simulation endpoint traces:
   ```bash
   curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error
   ```

4. Verify simulation traces are simpler (fewer spans) but still tracked correctly

## What to Look for in Datadog

### Service Map
Navigate to **APM → Service Map** and verify:
- `agent-api` service appears
- Connections to `postgres`, `burger-mcp` are shown
- Error rate and latency are visible on service nodes

### Service Overview
Navigate to **APM → Services → agent-api** and check:
- **Requests**: Total request count increases
- **Errors**: Error count and error rate increase after calling error endpoints
- **Latency**: P50/P95/P99 percentiles increase after calling latency endpoints
- **Apdex Score**: May decrease due to errors and slow requests

### Traces List
Navigate to **APM → Traces** and filter:
- `service:agent-api`
- `resource_name:GET /api/simulate/*`
- `status:error` (for error endpoints)
- `@http.status_code:500` (for errors)

### Logs Integration
Navigate to **Logs** and verify:
- Logs from agent-api are being collected
- Trace IDs are present in log entries
- Clicking "View in APM" links logs to traces
- Log patterns for simulated errors are detected

### Error Tracking
Navigate to **APM → Error Tracking** and verify:
- Simulated errors are grouped correctly
- Stack traces are captured
- Error trend shows increase after calling error endpoints

## Cleanup / Reset

After testing, you may want to reset or stop generating test data:

```bash
# No cleanup needed - just stop calling the simulation endpoints
# Datadog will naturally age out old data based on your retention settings
```

## Environment URLs

### Local Development (Docker Compose)
- agent-api: `http://localhost:8081`
- Full error endpoint: `http://localhost:8081/api/simulate/error`

### Development (GKE)
- agent-api: `https://agent-api-dev.platform-engineering-demo.dev`
- Full error endpoint: `https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error`

### Production (GKE)
- agent-api: `https://agent-api-prod.platform-engineering-demo.dev`
- Full error endpoint: `https://agent-api-prod.platform-engineering-demo.dev/api/simulate/error`

## Troubleshooting

### Issue: No data showing in Datadog

**Possible causes**:
1. Datadog agent not installed or running in the environment
2. `DD_SERVICE`, `DD_ENV`, `DD_VERSION` environment variables not set
3. `dd-trace` library not initialized in application

**Check**:
```bash
# Verify Datadog agent is running in Kubernetes
kubectl get pods -n mcp-agent-dev | grep datadog

# Check agent-api logs for dd-trace initialization
kubectl logs -n mcp-agent-dev deployment/agent-api | grep -i datadog

# Verify environment variables
kubectl get deployment agent-api -n mcp-agent-dev -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="DD_SERVICE")].value}'
```

### Issue: Errors not showing in Datadog APM

**Possible causes**:
1. Error traces are being sampled out
2. Error handler middleware is not configured correctly

**Check**:
```bash
# Look for error log entries
kubectl logs -n mcp-agent-dev deployment/agent-api | grep "Simulated error"

# Check Datadog trace ingestion rate
# Navigate to APM → Setup & Configuration → Ingestion Control
```

### Issue: Latency not reflected in metrics

**Possible causes**:
1. Datadog aggregates metrics over time windows
2. May need to wait 1-2 minutes for metrics to appear

**Solution**:
- Wait 2-3 minutes after making requests
- Refresh the Datadog APM dashboard
- Check the time range selector in Datadog UI

## Best Practices

1. **Label your tests**: Add comments when running tests so you can identify them in Datadog
   ```bash
   # Add a unique identifier in your test script
   TEST_ID="manual-test-$(date +%s)"
   echo "Running test: $TEST_ID"
   curl "https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error"
   ```

2. **Use development environment for testing**: Avoid polluting production metrics
   ```bash
   # Prefer dev environment
   curl https://agent-api-dev.platform-engineering-demo.dev/api/simulate/error
   ```

3. **Document monitor thresholds**: When creating monitors based on these tests, document the expected values

4. **Test during off-peak hours**: If testing in production, do it during low-traffic periods

5. **Combine with real usage**: Use simulation endpoints alongside actual application usage for comprehensive testing

## Additional Resources

- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Node.js Tracer Configuration](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
- [Creating APM Monitors](https://docs.datadoghq.com/monitors/create/types/apm/)
- [Trace Search and Analytics](https://docs.datadoghq.com/tracing/trace_explorer/search/)

## Questions or Issues?

If you encounter any issues with the simulation endpoints or Datadog integration:

1. Check the agent-api logs for errors
2. Verify Datadog agent status in your cluster
3. Review this guide for troubleshooting steps
4. Check the main README.md for deployment and configuration details
