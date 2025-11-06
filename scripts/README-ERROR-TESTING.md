# Error Simulation and Load Testing Scripts

This directory contains two complementary scripts for testing error handling and monitoring in the agent-api service with Datadog APM.

## Overview

| Script | Purpose | Best For | Requirements |
|--------|---------|----------|--------------|
| `simulate-agent-errors.sh` | Sequential error simulation | Manual testing, verification | `curl` |
| `load-test-agent-errors.sh` | High-volume load testing | Performance testing, stress testing | `hey` |

---

## 1. Sequential Error Simulation

**Script**: `simulate-agent-errors.sh`

### Purpose

Generate errors sequentially to verify:
- Datadog APM error tracking works correctly
- Monitors trigger as expected
- Individual error scenarios behave correctly

### Installation

No additional installation required. Uses `curl` (pre-installed on most systems).

### Quick Start

```bash
# View all options
./scripts/simulate-agent-errors.sh --help

# Basic test - 5 errors in dev
./scripts/simulate-agent-errors.sh

# Test specific error type
./scripts/simulate-agent-errors.sh --type latency --count 10

# Test in production
./scripts/simulate-agent-errors.sh --env prod --type error --count 5
```

### Error Types

1. **`error`** - 500 Internal Server Errors
   - Endpoint: `GET /api/simulate/error`
   - Tests: Error tracking, error rate monitors

2. **`latency`** - High Latency Responses (2-8s)
   - Endpoint: `GET /api/simulate/latency?delay=<ms>`
   - Tests: Latency monitors, performance tracking

3. **`slow-error`** - Slow Response + Error (1.5-5s + error)
   - Endpoint: `GET /api/simulate/slow-error?delay=<ms>`
   - Tests: Complex failure scenarios, timeout handling

4. **`validation`** - Validation Errors (400 Bad Request)
   - Endpoint: `POST /api/chats/stream` with invalid data
   - Tests: Application-level error handling

5. **`all`** - Run all error types sequentially

### Command-Line Options

```bash
-e, --env ENV           # Environment: dev or prod (default: dev)
-t, --type TYPE         # Error type (default: all)
-c, --count COUNT       # Number of requests (default: 5)
-d, --delay DELAY       # Delay between requests in seconds (default: 1)
-h, --help              # Show help
```

### Example Scenarios

```bash
# Quick verification test
./scripts/simulate-agent-errors.sh -e dev -t error -c 3

# Test latency monitor threshold (20s)
./scripts/simulate-agent-errors.sh -e dev -t latency -c 5 -d 2

# Comprehensive test with all error types
./scripts/simulate-agent-errors.sh -e dev -t all -c 10 -d 1

# Production smoke test
./scripts/simulate-agent-errors.sh -e prod -t validation -c 3
```

### Output

Colored, progress-tracked output showing:
- ✓ Successfully triggered errors (green)
- ✗ Failed attempts (yellow/red)
- Summary statistics
- Links to Datadog dashboards

---

## 2. Load Testing with `hey`

**Script**: `load-test-agent-errors.sh`

### Purpose

Generate high-volume error traffic to test:
- System behavior under load
- APM performance with many errors
- Infrastructure scaling (HPA, resource limits)
- Database performance under stress

### Installation

#### macOS
```bash
brew install hey
```

#### Linux/Windows (requires Go)
```bash
go install github.com/rakyll/hey@latest
```

#### Verify Installation
```bash
hey -version
```

### Quick Start

```bash
# View all options
./scripts/load-test-agent-errors.sh --help

# Medium load test (500 requests, 20 workers)
./scripts/load-test-agent-errors.sh -n 500 -c 20

# High load test (2000 requests, 50 workers)
./scripts/load-test-agent-errors.sh -n 2000 -c 50

# Rate-limited test (100 req/s for 60 seconds)
./scripts/load-test-agent-errors.sh -q 100 -d 60 -c 50
```

### Error Types

Same as sequential script, but with high concurrency:

1. **`error`** - 500 errors
2. **`latency`** - High latency (5s delay)
3. **`slow-error`** - Slow errors (3s delay + error)
4. **`validation`** - 400 validation errors
5. **`all`** - All types sequentially

### Command-Line Options

```bash
-e, --env ENV           # Environment: dev or prod (default: dev)
-t, --type TYPE         # Error type (default: error)
-n, --requests N        # Total requests (default: 100)
-c, --concurrency N     # Concurrent workers (default: 10)
-q, --qps N             # Rate limit in req/s (default: 0 = unlimited)
-d, --duration N        # Duration in seconds (overrides -n, default: 0)
-h, --help              # Show help
```

### Load Patterns

Pre-defined load patterns for different testing scenarios:

| Pattern | Requests | Concurrency | Use Case |
|---------|----------|-------------|----------|
| **Low Load** | 100 | 5 | Initial testing, verification |
| **Medium Load** | 500 | 20 | Realistic production simulation |
| **High Load** | 2000 | 50 | Stress testing |
| **Extreme Load** | 5000 | 100 | Breaking point testing |

### Example Scenarios

#### 1. Quick Smoke Test
```bash
# Low load, verify everything works
./scripts/load-test-agent-errors.sh -n 100 -c 5 -t error
```

#### 2. Realistic Production Simulation
```bash
# Medium load across all error types
./scripts/load-test-agent-errors.sh -n 500 -c 20 -t all
```

#### 3. Stress Test
```bash
# High load, push the system
./scripts/load-test-agent-errors.sh -n 2000 -c 50 -t error
```

#### 4. Sustained Load Test
```bash
# 100 req/s for 5 minutes
./scripts/load-test-agent-errors.sh -q 100 -d 300 -c 50 -t error
```

#### 5. Latency Monitor Trigger
```bash
# Generate high latency to trigger the "Burgers Agent Latency" monitor
./scripts/load-test-agent-errors.sh -n 1000 -c 30 -t latency
```

#### 6. Breaking Point Test
```bash
# Find the system limits
./scripts/load-test-agent-errors.sh -n 5000 -c 100 -t all
```

### Understanding `hey` Output

`hey` provides comprehensive statistics:

```
Summary:
  Total:        10.2385 secs
  Slowest:      0.5234 secs
  Fastest:      0.0123 secs
  Average:      0.1023 secs
  Requests/sec: 97.6701

Status code distribution:
  [500] 1000 responses
```

**Key Metrics**:
- **Total**: Total test duration
- **Requests/sec**: Achieved throughput
- **Average/Slowest/Fastest**: Latency distribution
- **Status code distribution**: Response code breakdown

---

## When to Use Each Script

### Use `simulate-agent-errors.sh` When:
- ✓ Verifying individual error scenarios
- ✓ Testing monitor configurations
- ✓ Demonstrating error tracking to stakeholders
- ✓ Manual testing during development
- ✓ CI/CD integration for basic smoke tests

### Use `load-test-agent-errors.sh` When:
- ✓ Performance testing
- ✓ Stress testing infrastructure
- ✓ Validating HPA (Horizontal Pod Autoscaler) behavior
- ✓ Testing database performance under load
- ✓ Measuring system breaking points
- ✓ Reproducing production-scale issues

---

## Datadog Monitoring Guide

### What to Check After Running Tests

#### 1. APM Service Page
**URL**: https://app.datadoghq.com/apm/service/agent-api

**Metrics to Monitor**:
- Error rate spike
- Latency percentiles (p50, p95, p99)
- Request throughput
- Service health score

#### 2. Error Tracking
**URL**: https://app.datadoghq.com/apm/error-tracking

**What to Look For**:
- New error issues created
- Error count and distribution
- Stack traces and error details
- Error patterns and trends

#### 3. Service Map
**URL**: https://app.datadoghq.com/apm/map

**What to Check**:
- Service dependency visualization
- Error propagation across services
- Request flow and bottlenecks

#### 4. Monitors
**URL**: https://app.datadoghq.com/monitors/manage?q=agent-api

**Key Monitors**:
- "Burgers Agent Latency above 20s" (ID: 233651892)
- Custom error rate monitors
- Resource utilization monitors

#### 5. Infrastructure
**URL**: https://app.datadoghq.com/infrastructure

**Resources to Monitor**:
- Pod CPU/Memory utilization
- HPA scaling events
- Node-level metrics
- Network throughput

#### 6. Database Monitoring
**URL**: https://app.datadoghq.com/databases

**What to Watch**:
- Query execution time
- Connection pool utilization
- Slow query detection
- Database CPU/Memory

---

## Environment Configuration

### Development Environment
- **Namespace**: `mcp-agent-dev`
- **URL**: `https://dev.platform-engineering-demo.dev`
- **Replicas**: 1 per service
- **Resources**: Lower limits

### Production Environment
- **Namespace**: `mcp-agent-prod`
- **URL**: `https://platform-engineering-demo.dev`
- **Replicas**: 2-3 per service (with HPA)
- **Resources**: Higher limits

---

## Troubleshooting

### Script Won't Run

**Error**: `Permission denied`
```bash
# Make scripts executable
chmod +x scripts/simulate-agent-errors.sh
chmod +x scripts/load-test-agent-errors.sh
```

### Service Not Reachable

**Error**: `Service is not reachable`

**Solutions**:
1. Verify service is deployed: `kubectl get pods -n mcp-agent-{dev|prod}`
2. Check service endpoints: `kubectl get svc -n mcp-agent-{dev|prod}`
3. Test connectivity: `curl https://dev.platform-engineering-demo.dev/api`
4. Check Gateway/HTTPRoute: `kubectl get httproute -n mcp-agent-{dev|prod}`

### `hey` Not Found

**Error**: `hey: command not found`

**Solutions**:
```bash
# macOS
brew install hey

# Linux/Windows (requires Go)
go install github.com/rakyll/hey@latest

# Add to PATH if needed
export PATH=$PATH:$(go env GOPATH)/bin
```

### Unexpected HTTP Status Codes

**Issue**: Getting 200 instead of 500

**Possible Causes**:
1. Wrong endpoint URL
2. Service not configured with error simulation endpoints
3. Environment variable misconfiguration

**Verification**:
```bash
# Test error endpoint directly
curl -v https://dev.platform-engineering-demo.dev/api/simulate/error
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Error Simulation Tests

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  test-errors:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Error Simulation
        run: |
          ./scripts/simulate-agent-errors.sh \
            --env dev \
            --type all \
            --count 10 \
            --delay 1
```

### Makefile Integration

```makefile
.PHONY: test-errors test-load

test-errors:
	@echo "Running error simulation tests..."
	./scripts/simulate-agent-errors.sh -e dev -t all -c 5

test-load:
	@echo "Running load tests..."
	./scripts/load-test-agent-errors.sh -n 500 -c 20 -t error
```

---

## Best Practices

### 1. Start Small
- Begin with low load patterns
- Verify monitoring works correctly
- Gradually increase load

### 2. Monitor During Tests
- Keep Datadog dashboards open
- Watch for infrastructure scaling
- Monitor database performance

### 3. Test in Dev First
- Always test in dev before prod
- Verify error handling works correctly
- Ensure monitors trigger appropriately

### 4. Document Findings
- Record baseline metrics
- Note breaking points
- Document unexpected behavior

### 5. Schedule Regular Tests
- Run smoke tests daily
- Perform load tests weekly
- Conduct stress tests before releases

---

## Advanced Usage

### Custom Error Scenarios

Modify the scripts to add custom error types:

```bash
# In simulate-agent-errors.sh
simulate_custom_error() {
    echo "Simulating custom error..."
    curl -X POST "$BASE_URL/api/custom-endpoint" \
         -H "Content-Type: application/json" \
         -d '{"custom": "data"}'
}
```

### Combining Both Scripts

```bash
# Sequential test followed by load test
./scripts/simulate-agent-errors.sh -e dev -t all -c 3 && \
./scripts/load-test-agent-errors.sh -e dev -t error -n 1000 -c 50
```

### Rate Limiting Patterns

```bash
# Gradual ramp-up
for qps in 10 50 100 200; do
    echo "Testing with $qps req/s..."
    ./scripts/load-test-agent-errors.sh -q $qps -d 30 -c 50
    sleep 10
done
```

---

## Support and Feedback

For issues or feature requests:
1. Check existing documentation
2. Review Datadog APM traces for errors
3. Check service logs: `kubectl logs -n mcp-agent-dev deployment/agent-api`
4. Open an issue in the repository

---

## References

- [hey Documentation](https://github.com/rakyll/hey)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Datadog Error Tracking](https://docs.datadoghq.com/tracing/error_tracking/)
- [Project Documentation](../docs/)
