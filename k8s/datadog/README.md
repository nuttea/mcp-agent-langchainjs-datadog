# Datadog Observability for GKE

Complete Datadog monitoring setup for the MCP Agent LangChain.js application on GKE.

## Quick Start

### 1. Add Required Environment Variables to `.env`

```bash
# Datadog API Key
DD_API_KEY=your_datadog_api_key

# GKE Cluster Name
CLUSTER_NAME=mcp-agent-gke
```

Get your API key from: https://app.datadoghq.com/organization-settings/api-keys

### 2. Deploy Datadog Agent

```bash
make datadog-deploy
```

This will:
- Create Kubernetes secret with API keys
- Install Datadog Agent via Helm
- Enable container logs, metrics, APM, ASM, NPM, SBOM
- Configure Single Step Instrumentation (SSI) for application namespaces

### 3. Restart Application Pods

```bash
kubectl rollout restart deployment -n mcp-agent-dev
kubectl rollout restart deployment -n mcp-agent-prod
```

This triggers SSI to inject APM libraries into your Node.js applications.

### 4. Verify Deployment

```bash
make datadog-status
```

Check that all Datadog Agent pods are running.

### 5. View Data in Datadog

- **Infrastructure**: https://app.datadoghq.com/infrastructure/map
- **APM Services**: https://app.datadoghq.com/apm/services
- **Service Map**: https://app.datadoghq.com/apm/map
- **Logs**: https://app.datadoghq.com/logs
- **Security**: https://app.datadoghq.com/security

## Features Enabled

### Container Logs
All container logs automatically collected and sent to Datadog Logs.

### Metrics
- Kubernetes cluster metrics
- Node metrics (CPU, memory, disk, network)
- Pod and container metrics
- Deployment and service metrics

### APM with Single Step Instrumentation (SSI)
Automatic APM instrumentation for:
- Node.js (dd-trace-js v5)
- Java, Python, PHP, .NET, Ruby

No code changes required - APM libraries are injected at runtime.

### Application Security Management (ASM)
- Threat detection
- Software Composition Analysis (SCA)
- Interactive Application Security Testing (IAST)

### Network Performance Monitoring
Monitor network traffic between services, pods, and external endpoints.

### Process Monitoring
Process-level metrics for all containers.

### SBOM Collection
Software Bill of Materials for containers and hosts.

### Universal Service Monitoring
Automatic service discovery and monitoring.

## Configuration Files

### [datadog-values.yaml](./datadog-values.yaml)
Helm values for Datadog Agent deployment. Key settings:

- **Cluster Name**: Set via `--set datadog.clusterName` or `CLUSTER_NAME` env var
- **API Keys**: Stored in Kubernetes secret `datadog-secret`
- **SSI Namespaces**: `mcp-agent-dev`, `mcp-agent-prod`
- **Registry**: `gcr.io/datadoghq` (GCR mirror)

### [deploy-datadog.sh](../scripts/deploy-datadog.sh)
Deployment script that:
- Loads credentials from `.env`
- Creates Kubernetes secret
- Installs/upgrades Datadog Agent via Helm
- Provides deployment status and next steps

## Makefile Commands

```bash
make datadog-deploy   # Deploy Datadog Agent
make datadog-status   # Show Agent status
make datadog-logs     # Tail Agent logs
```

## Manual Deployment

If you prefer manual deployment:

```bash
# 1. Add Datadog Helm repo
helm repo add datadog https://helm.datadoghq.com
helm repo update

# 2. Create namespace
kubectl create namespace datadog

# 3. Create secret
kubectl create secret generic datadog-secret \
    --from-literal=api-key=$DD_API_KEY \
    --namespace datadog

# 4. Install Datadog Agent
helm install datadog-agent \
    -f k8s/datadog/datadog-values.yaml \
    --set datadog.clusterName=mcp-agent-gke \
    --namespace datadog \
    datadog/datadog

# Note: API keys are read from the Kubernetes secret created in step 3

# 5. Restart application pods
kubectl rollout restart deployment -n mcp-agent-dev
```

## Unified Service Tagging

All telemetry is tagged with:
- `service`: Service name (agent-api, burger-mcp, etc.)
- `env`: Environment (dev, prod)
- `version`: Container image tag
- `kube_cluster_name`: Cluster name
- `kube_namespace`: Namespace
- `pod_name`: Pod name

## Troubleshooting

### Datadog Agent Not Starting

```bash
# Check pod status
kubectl get pods -n datadog

# View logs
make datadog-logs

# Check events
kubectl get events -n datadog --sort-by='.lastTimestamp'
```

### APM Traces Not Appearing

```bash
# 1. Check pod for SSI injection
kubectl describe pod -n mcp-agent-dev <pod-name>

# Look for:
# - DD_ENV, DD_SERVICE, DD_VERSION environment variables
# - Mounted volume: datadog-lib-js

# 2. Check application logs
kubectl logs -n mcp-agent-dev <pod-name> | grep -i datadog

# 3. Verify trace agent is receiving traces
kubectl port-forward -n datadog svc/datadog-agent 8126:8126
curl http://localhost:8126/info
```

### Logs Not Appearing

```bash
# Check log collection in Datadog Agent
kubectl logs -l app=datadog-agent -n datadog | grep -i "log collection"
```

## Upgrading

```bash
# Update Helm repo
helm repo update

# Upgrade Datadog Agent
make datadog-deploy
```

Or manually:

```bash
helm upgrade datadog-agent \
    -f k8s/datadog/datadog-values.yaml \
    --set datadog.clusterName=mcp-agent-gke \
    --namespace datadog \
    datadog/datadog
```

## Uninstalling

```bash
# Uninstall Helm release
helm uninstall datadog-agent -n datadog

# Delete namespace
kubectl delete namespace datadog
```

## Documentation

- Datadog Kubernetes: https://docs.datadoghq.com/containers/kubernetes/
- Datadog Helm Chart: https://github.com/DataDog/helm-charts/tree/main/charts/datadog
- Single Step Instrumentation: https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/
- Node.js APM: https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/
