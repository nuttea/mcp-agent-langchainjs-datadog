# Datadog Unified Service Tagging Guide for Kubernetes

This guide shows the recommended Datadog tags, labels, and annotations for your Kubernetes manifests.

## Unified Service Tagging Standard

Datadog recommends using three standard tags for unified service tagging:
- `env`: Environment (dev, staging, prod)
- `service`: Service name
- `version`: Application version (use image tag)

## Configuration Levels

### 1. Deployment-Level Labels

Add to `metadata.labels` on the Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
  namespace: mcp-agent-dev
  labels:
    tags.datadoghq.com/env: "dev"
    tags.datadoghq.com/service: "agent-api"
    tags.datadoghq.com/version: "1.0.0"
    app: mcp-agent
    component: backend-api
```

### 2. Pod Template Labels

Add to `spec.template.metadata.labels`:

```yaml
spec:
  template:
    metadata:
      labels:
        tags.datadoghq.com/env: "dev"
        tags.datadoghq.com/service: "agent-api"
        tags.datadoghq.com/version: "1.0.0"
        app: mcp-agent
        service: agent-api
        component: backend-api
```

### 3. Pod Annotations for Log Collection

Add to `spec.template.metadata.annotations`:

```yaml
spec:
  template:
    metadata:
      annotations:
        ad.datadoghq.com/agent-api.logs: '[{"source": "nodejs", "service": "agent-api", "tags": ["env:dev", "team:platform"]}]'
```

### 4. Container Environment Variables

Add to `spec.template.spec.containers[].env`:

```yaml
env:
  - name: DD_ENV
    valueFrom:
      fieldRef:
        fieldPath: metadata.labels['tags.datadoghq.com/env']
  - name: DD_SERVICE
    valueFrom:
      fieldRef:
        fieldPath: metadata.labels['tags.datadoghq.com/service']
  - name: DD_VERSION
    valueFrom:
      fieldRef:
        fieldPath: metadata.labels['tags.datadoghq.com/version']
  - name: DD_LOGS_INJECTION
    value: "true"
  - name: DD_TRACE_SAMPLE_RATE
    value: "1"
  - name: DD_PROFILING_ENABLED
    value: "true"
```

## Complete Example: agent-api

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
  namespace: mcp-agent-dev
  labels:
    tags.datadoghq.com/env: "dev"
    tags.datadoghq.com/service: "agent-api"
    tags.datadoghq.com/version: "1.0.0"
    app: mcp-agent
    component: backend-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-agent
      service: agent-api
  template:
    metadata:
      labels:
        tags.datadoghq.com/env: "dev"
        tags.datadoghq.com/service: "agent-api"
        tags.datadoghq.com/version: "1.0.0"
        app: mcp-agent
        service: agent-api
        component: backend-api
      annotations:
        ad.datadoghq.com/agent-api.logs: '[{"source": "nodejs", "service": "agent-api"}]'
    spec:
      containers:
      - name: agent-api
        image: gcr.io/datadog-ese-sandbox/agent-api:latest
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: DD_ENV
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/env']
        - name: DD_SERVICE
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/service']
        - name: DD_VERSION
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/version']
        - name: DD_LOGS_INJECTION
          value: "true"
        - name: DD_TRACE_SAMPLE_RATE
          value: "1"
        - name: DD_PROFILING_ENABLED
          value: "true"
        - name: PORT
          value: "8080"
        - name: NODE_ENV
          value: "production"
```

## Log Source by Language

Use the appropriate `source` value in annotations based on your application language:

| Language | Source Value | Notes |
|----------|--------------|-------|
| Node.js | `nodejs` | For all JavaScript/TypeScript apps |
| Python | `python` | Python applications |
| Java | `java` | Java/JVM applications |
| Go | `go` | Go applications |
| .NET | `csharp` | C#/.NET applications |
| Ruby | `ruby` | Ruby applications |
| PHP | `php` | PHP applications |
| nginx | `nginx` | For frontend apps using nginx |

## Service-Specific Configurations

### Node.js API Services (agent-api, burger-api)

```yaml
metadata:
  annotations:
    # With multiline log support for stack traces
    ad.datadoghq.com/<container-name>.logs: '[{"source": "nodejs", "service": "<service-name>", "log_processing_rules": [{"type": "multi_line", "name": "log_start_with_date", "pattern": "\\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])"}]}]'
env:
  - name: DD_LOGS_INJECTION
    value: "true"
  - name: DD_TRACE_SAMPLE_RATE
    value: "1"
  - name: DD_PROFILING_ENABLED
    value: "true"
```

**Note**: The multiline pattern matches logs starting with a date (YYYY-MM-DD format), which groups stack traces and error messages with their initial log entry.

### MCP Server (burger-mcp)

```yaml
metadata:
  annotations:
    ad.datadoghq.com/burger-mcp.logs: '[{"source": "nodejs", "service": "burger-mcp"}]'
env:
  - name: DD_LOGS_INJECTION
    value: "true"
  - name: DD_TRACE_SAMPLE_RATE
    value: "1"
```

### Frontend Apps (agent-webapp, burger-webapp)

```yaml
metadata:
  annotations:
    ad.datadoghq.com/<container-name>.logs: '[{"source": "nginx", "service": "<service-name>"}]'
```

## Additional Custom Tags

Add custom tags via annotations for business-specific metadata:

```yaml
metadata:
  annotations:
    ad.datadoghq.com/tags: '{"team": "platform", "cost-center": "engineering", "criticality": "high"}'
```

## Environment-Specific Values

### Development (dev)

```yaml
tags.datadoghq.com/env: "dev"
DD_TRACE_SAMPLE_RATE: "1"  # Sample 100% of traces
```

### Production (prod)

```yaml
tags.datadoghq.com/env: "prod"
DD_TRACE_SAMPLE_RATE: "0.5"  # Sample 50% to reduce costs
```

## Benefits of Proper Tagging

1. **Unified Telemetry**: Correlate logs, metrics, and traces across services
2. **Service Map**: Automatic service dependency mapping in APM
3. **Log Filtering**: Easy log filtering by `service`, `env`, `version`
4. **Alert Scoping**: Target alerts to specific services/environments
5. **Cost Attribution**: Track usage by service and environment
6. **Deployment Tracking**: Track deployments by version tag

## Verification

After applying manifests, verify tags in Datadog:

```bash
# Check pod labels
kubectl get pods -n mcp-agent-dev --show-labels

# Describe pod to see annotations
kubectl describe pod -n mcp-agent-dev <pod-name>

# Check environment variables
kubectl exec -n mcp-agent-dev <pod-name> -- env | grep DD_
```

In Datadog UI:
- Infrastructure List: Filter by `service:agent-api` and `env:dev`
- APM Services: Should show service name with env tags
- Logs: Filter by `service:agent-api env:dev`

## References

- [Unified Service Tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/)
- [Kubernetes Tag Extraction](https://docs.datadoghq.com/containers/kubernetes/tag/)
- [Kubernetes Log Collection](https://docs.datadoghq.com/containers/kubernetes/log/)
- [Node.js APM](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
