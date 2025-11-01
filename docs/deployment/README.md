# Deployment Documentation

Complete guides for deploying the MCP Agent application to Google Kubernetes Engine (GKE).

## Quick Start Guides

Start here for fast deployment:

- **[QUICKSTART_GKE_UPDATED.md](QUICKSTART_GKE_UPDATED.md)** - Latest GKE quick start (recommended)
- **[DEPLOY_TO_PROD_QUICKSTART.md](DEPLOY_TO_PROD_QUICKSTART.md)** - Production deployment quick start

## Comprehensive Guides

### Initial Setup

- **[GKE_COMPLETE_SETUP.md](GKE_COMPLETE_SETUP.md)** - Complete GKE setup from scratch
- **[DEPLOY_GKE.md](DEPLOY_GKE.md)** - Detailed GKE deployment instructions
- **[SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md)** - Managing Kubernetes secrets
- **[SECRETS_SETUP_COMPLETE.md](SECRETS_SETUP_COMPLETE.md)** - Complete secrets setup guide

### Production Deployment

- **[DEPLOY_TO_PROD.md](DEPLOY_TO_PROD.md)** - Detailed production deployment
- **[DEPLOY_TO_PROD_QUICKSTART.md](DEPLOY_TO_PROD_QUICKSTART.md)** - Quick production setup

### Environment-Specific

- **[DEV_DEPLOYMENT_TEST.md](DEV_DEPLOYMENT_TEST.md)** - Development environment testing
- **[BRANCH_DEPLOYMENT_SUMMARY.md](BRANCH_DEPLOYMENT_SUMMARY.md)** - Branch-specific deployments

### Summaries & Reports

- **[GKE_DEPLOYMENT_SUMMARY.md](GKE_DEPLOYMENT_SUMMARY.md)** - GKE deployment summary
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - General deployment summary
- **[QUICKSTART_GKE.md](QUICKSTART_GKE.md)** - Original quick start (legacy)

## Deployment Process Overview

### 1. Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and configured
- `kubectl` installed
- Docker installed (for building images)
- Datadog account (optional, for monitoring)

### 2. Infrastructure Setup

```bash
# Create GKE cluster
gcloud container clusters create mcp-agent-cluster \
  --zone=us-central1-a \
  --num-nodes=3 \
  --machine-type=e2-medium

# Get credentials
gcloud container clusters get-credentials mcp-agent-cluster \
  --zone=us-central1-a
```

### 3. Secrets Configuration

```bash
# Create namespace
kubectl create namespace mcp-agent-dev

# Create secrets (see SECRETS_MANAGEMENT.md for details)
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=burgerapp \
  --from-literal=POSTGRES_PASSWORD=your-password \
  --from-literal=POSTGRES_DB=burgerdb \
  -n mcp-agent-dev

kubectl create secret generic openai-secret \
  --from-literal=OPENAI_API_KEY=your-api-key \
  -n mcp-agent-dev

kubectl create secret generic datadog-secret \
  --from-literal=DD_API_KEY=your-dd-api-key \
  -n mcp-agent-dev
```

### 4. Deploy Services

```bash
# Apply Kubernetes manifests
kubectl apply -k k8s/dev/

# Wait for deployments
kubectl rollout status deployment/agent-api -n mcp-agent-dev
kubectl rollout status deployment/burger-api -n mcp-agent-dev
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n mcp-agent-dev

# Check services
kubectl get svc -n mcp-agent-dev

# View logs
kubectl logs -n mcp-agent-dev deployment/agent-api
```

## Environments

### Development (mcp-agent-dev)

- Used for development and testing
- Lower resource limits
- Separate namespace

**Deployment:**
```bash
kubectl apply -k k8s/dev/
```

### Production (mcp-agent-prod)

- Production-ready configuration
- Higher resource limits and replicas
- Separate namespace with stricter security

**Deployment:**
```bash
kubectl apply -k k8s/prod/
```

## Services

### Agent API

- **Port:** 3000
- **Deployment:** agent-api
- **Purpose:** LangChain.js agent with MCP integration
- **Health Check:** `GET /health`

### Agent WebApp

- **Port:** 80
- **Deployment:** agent-webapp
- **Purpose:** Web interface for agent interactions
- **Static:** Nginx serving React app

### Burger API

- **Port:** 8080
- **Deployment:** burger-api
- **Purpose:** Burger ordering system API
- **Health Check:** `GET /api`

### Burger WebApp

- **Port:** 80
- **Deployment:** burger-webapp
- **Purpose:** Web interface for burger ordering
- **Static:** Nginx serving React app

### PostgreSQL

- **Port:** 5432
- **StatefulSet:** postgres
- **Purpose:** Database for burgers, orders, and users
- **Storage:** 10Gi persistent volume

## Common Tasks

### Update Application

```bash
# Build new image
docker build -f packages/agent-api/Dockerfile -t gcr.io/PROJECT_ID/agent-api:VERSION .

# Push to registry
docker push gcr.io/PROJECT_ID/agent-api:VERSION

# Update deployment
kubectl set image deployment/agent-api agent-api=gcr.io/PROJECT_ID/agent-api:VERSION -n mcp-agent-dev

# Watch rollout
kubectl rollout status deployment/agent-api -n mcp-agent-dev
```

### Scale Services

```bash
# Scale agent-api
kubectl scale deployment agent-api --replicas=3 -n mcp-agent-dev

# Scale burger-api
kubectl scale deployment burger-api --replicas=2 -n mcp-agent-dev
```

### View Logs

```bash
# All pods for a deployment
kubectl logs -n mcp-agent-dev deployment/agent-api --tail=100 -f

# Specific pod
kubectl logs -n mcp-agent-dev <pod-name> -f

# Previous crashed pod
kubectl logs -n mcp-agent-dev <pod-name> --previous
```

### Port Forwarding

```bash
# Agent API
kubectl port-forward -n mcp-agent-dev svc/agent-api 3000:3000

# Burger API
kubectl port-forward -n mcp-agent-dev svc/burger-api 8080:8080

# PostgreSQL
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432
```

### Debug Pods

```bash
# Describe pod
kubectl describe pod <pod-name> -n mcp-agent-dev

# Execute commands in pod
kubectl exec -it <pod-name> -n mcp-agent-dev -- /bin/sh

# Get pod events
kubectl get events -n mcp-agent-dev --sort-by='.lastTimestamp'
```

## Troubleshooting

### ImagePullBackOff

**Symptoms:** Pods stuck in ImagePullBackOff state

**Solutions:**
1. Verify image exists: `docker images | grep agent-api`
2. Check registry authentication
3. Verify image name in deployment manifest

### CrashLoopBackOff

**Symptoms:** Pods continuously restarting

**Solutions:**
1. Check logs: `kubectl logs <pod-name> -n mcp-agent-dev --previous`
2. Verify secrets are created correctly
3. Check database connectivity
4. Verify environment variables

### Service Not Accessible

**Symptoms:** Cannot connect to service

**Solutions:**
1. Check service: `kubectl get svc -n mcp-agent-dev`
2. Verify pod is running: `kubectl get pods -n mcp-agent-dev`
3. Check load balancer: `kubectl describe svc <service-name> -n mcp-agent-dev`
4. Test with port-forward first

### Database Connection Issues

**Symptoms:** Apps cannot connect to PostgreSQL

**Solutions:**
1. Verify PostgreSQL is running: `kubectl get pods -n mcp-agent-dev | grep postgres`
2. Check secrets: `kubectl get secret postgres-secret -n mcp-agent-dev`
3. Test connection: `kubectl exec -it postgres-0 -n mcp-agent-dev -- psql -U burgerapp -d burgerdb`
4. Check logs: `kubectl logs postgres-0 -n mcp-agent-dev`

## Best Practices

1. **Always use namespaces** to separate environments
2. **Store secrets securely** using Kubernetes secrets or external secret managers
3. **Use resource limits** to prevent resource exhaustion
4. **Implement health checks** for all services
5. **Use rolling updates** for zero-downtime deployments
6. **Monitor logs and metrics** with Datadog or similar tools
7. **Backup PostgreSQL** regularly using pg_dump or snapshots
8. **Test in dev** before deploying to production
9. **Use version tags** for Docker images, not `latest`
10. **Document changes** in deployment manifests

## Next Steps

- Set up monitoring: See [../monitoring/](../monitoring/)
- Run tests: See [../testing/](../testing/)
- Understand architecture: See [../architecture/](../architecture/)
