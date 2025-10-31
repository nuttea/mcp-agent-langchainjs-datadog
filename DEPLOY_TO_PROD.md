# Deploy to Production Guide

This guide shows how to deploy your application to production on GKE.

## Quick Start

```bash
# 1. Create production namespace and ConfigMap
kubectl apply -f k8s/gateway/00-namespace-shared-infra.yaml
kubectl apply -f k8s/config/configmap-prod.yaml

# 2. Create secrets (if needed)
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-prod \
  --from-literal=openai-api-key=YOUR_OPENAI_API_KEY

# 3. Deploy all services to production
make deploy-all ENV=prod

# 4. Apply HTTPRoutes for production
kubectl apply -f k8s/gateway/03-httproute-prod.yaml

# 5. Check deployment status
make k8s-status ENV=prod
```

## Prerequisites

1. **Production namespace created**: `mcp-agent-prod`
2. **Production ConfigMap**: Environment variables for prod
3. **Secrets created**: OpenAI API keys, etc.
4. **Gateway setup**: Gateway API with HTTPRoutes
5. **Docker images**: Built and pushed to GCR

## Step-by-Step Production Deployment

### Step 1: Create Production ConfigMap

Create a production-specific ConfigMap:

```bash
# Copy dev configmap as template
cp k8s/config/configmap.yaml k8s/config/configmap-prod.yaml

# Edit for production
# - Change namespace to mcp-agent-prod
# - Update PUBLIC_BASE_URL to production domain
# - Review all environment variables
```

Edit `k8s/config/configmap-prod.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: mcp-agent-prod  # Change this
  labels:
    app: mcp-agent
    environment: prod  # Change this
data:
  # ... keep all the config ...
  PUBLIC_BASE_URL: "https://platform-engineering-demo.dev"  # Production URL
  NODE_ENV: "production"
  LOG_LEVEL: "info"  # or "warn" for prod
```

Apply it:

```bash
kubectl apply -f k8s/config/configmap-prod.yaml
```

### Step 2: Create Production Secrets

```bash
# OpenAI API key
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-prod \
  --from-literal=openai-api-key=YOUR_OPENAI_API_KEY \
  --dry-run=client -o yaml | kubectl apply -f -

# If you have other secrets, add them here
```

### Step 3: Create Production Manifests

Copy and modify dev manifests for production:

```bash
# Create prod manifests directory
mkdir -p k8s/manifests-prod

# Copy all dev manifests
cp k8s/manifests/*.yaml k8s/manifests-prod/

# Update namespace in all files (macOS)
sed -i '' 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml

# Or for Linux:
# sed -i 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml

# Update environment labels
sed -i '' 's/environment: dev/environment: prod/g' k8s/manifests-prod/*.yaml
```

**Important Production Changes** (edit manually):

1. **Remove LoadBalancer services** - Gateway handles external traffic:
   ```yaml
   # In agent-webapp.yaml and burger-webapp.yaml
   spec:
     type: ClusterIP  # Change from LoadBalancer
   ```

2. **Update resource limits** (optional, for better production stability):
   ```yaml
   resources:
     requests:
       memory: "512Mi"
       cpu: "500m"
     limits:
       memory: "1Gi"
       cpu: "1000m"
   ```

3. **Update replica count** (optional, for HA):
   ```yaml
   spec:
     replicas: 2  # Change from 1
   ```

### Step 4: Deploy All Services

```bash
# Deploy all production manifests
kubectl apply -f k8s/manifests-prod/

# Or deploy one at a time
kubectl apply -f k8s/manifests-prod/agent-api.yaml
kubectl apply -f k8s/manifests-prod/agent-webapp.yaml
kubectl apply -f k8s/manifests-prod/burger-api.yaml
kubectl apply -f k8s/manifests-prod/burger-mcp.yaml
kubectl apply -f k8s/manifests-prod/burger-webapp.yaml
```

### Step 5: Deploy Production HTTPRoutes

```bash
# Apply HTTPRoute for production
kubectl apply -f k8s/gateway/03-httproute-prod.yaml

# Verify HTTPRoutes
kubectl get httproute -n mcp-agent-prod
```

### Step 6: Verify Deployment

```bash
# Check pods
kubectl get pods -n mcp-agent-prod

# Check services
kubectl get svc -n mcp-agent-prod

# Check deployments
kubectl get deployments -n mcp-agent-prod

# Check HTTPRoutes
kubectl get httproute -n mcp-agent-prod

# Check logs
kubectl logs -n mcp-agent-prod -l app=agent-api --tail=50
```

## Using Make Commands for Production

### Deploy Individual Services

```bash
# Deploy agent-api to production
make deploy-agent-api ENV=prod

# Deploy agent-webapp to production
make deploy-agent-webapp ENV=prod

# Deploy burger-api to production
make deploy-burger-api ENV=prod

# Deploy burger-webapp to production
make deploy-burger-webapp ENV=prod

# Deploy burger-mcp to production
make deploy-burger-mcp ENV=prod
```

### Check Status

```bash
# Show status of production deployment
make k8s-status ENV=prod

# Watch logs
make k8s-logs ENV=prod

# Restart all deployments (if needed)
make k8s-restart ENV=prod
```

## Update Makefile for Production Support

Your Makefile needs to support `ENV` variable. Add this near the top:

```makefile
# Environment (dev or prod)
ENV ?= dev
NAMESPACE ?= mcp-agent-$(ENV)

# Use namespace based on environment
PORT_FORWARD_NAMESPACE = $(NAMESPACE)
```

Then update k8s-apply and k8s-status targets:

```makefile
k8s-apply:
	@echo "Applying K8s manifests to $(NAMESPACE)..."
	kubectl apply -f k8s/manifests/ -n $(NAMESPACE)

k8s-status:
	@echo "=== Deployments in $(NAMESPACE) ==="
	kubectl get deployments -n $(NAMESPACE)
	@echo ""
	@echo "=== Pods in $(NAMESPACE) ==="
	kubectl get pods -n $(NAMESPACE)
	@echo ""
	@echo "=== Services in $(NAMESPACE) ==="
	kubectl get svc -n $(NAMESPACE)

k8s-restart:
	@echo "Restarting all deployments in $(NAMESPACE)..."
	kubectl rollout restart deployment -n $(NAMESPACE)
```

## Production Checklist

Before deploying to production:

- [ ] Production namespace created (`mcp-agent-prod`)
- [ ] Production ConfigMap created with correct values
- [ ] Secrets created (OpenAI API key, etc.)
- [ ] Docker images built and pushed to GCR
- [ ] Production manifests created (in `k8s/manifests-prod/`)
- [ ] Services changed from LoadBalancer to ClusterIP
- [ ] Resource limits configured appropriately
- [ ] Replica count set (2+ for HA)
- [ ] Gateway HTTPRoutes configured for prod domains
- [ ] DNS configured (Cloudflare pointing to Gateway IP)
- [ ] SSL/TLS configured (Cloudflare)
- [ ] Monitoring enabled (Datadog)

## Production vs Development

| Aspect | Development | Production |
|--------|-------------|------------|
| **Namespace** | mcp-agent-dev | mcp-agent-prod |
| **Domain** | dev.platform-engineering-demo.dev | platform-engineering-demo.dev |
| **Services** | LoadBalancer (for testing) | ClusterIP (Gateway handles traffic) |
| **Replicas** | 1 | 2+ (for HA) |
| **Resources** | Lower limits | Higher limits |
| **Logging** | debug | info/warn |
| **Gateway** | shared-gateway | shared-gateway (same) |

## Rollback

If something goes wrong:

```bash
# Rollback to previous deployment
kubectl rollout undo deployment agent-api -n mcp-agent-prod
kubectl rollout undo deployment agent-webapp -n mcp-agent-prod
kubectl rollout undo deployment burger-api -n mcp-agent-prod

# Or rollback all
kubectl rollout undo deployment --all -n mcp-agent-prod

# Check rollout history
kubectl rollout history deployment agent-api -n mcp-agent-prod

# Rollback to specific revision
kubectl rollout undo deployment agent-api -n mcp-agent-prod --to-revision=2
```

## Zero-Downtime Deployment

To ensure zero downtime:

1. **Use readiness probes** (already configured in manifests)
2. **Use multiple replicas** (2+)
3. **Use rolling update strategy**:
   ```yaml
   spec:
     strategy:
       type: RollingUpdate
       rollingUpdate:
         maxUnavailable: 0
         maxSurge: 1
   ```

4. **Monitor rollout**:
   ```bash
   kubectl rollout status deployment agent-api -n mcp-agent-prod
   ```

## Monitoring Production

```bash
# Watch pods
kubectl get pods -n mcp-agent-prod -w

# Tail logs from all pods
kubectl logs -n mcp-agent-prod -l app=mcp-agent --tail=100 -f

# Check resource usage
kubectl top pods -n mcp-agent-prod

# Check events
kubectl get events -n mcp-agent-prod --sort-by='.lastTimestamp'
```

## Common Production Tasks

### Update Image (New Version)

```bash
# Build and push new version
make docker-build-agent-api IMAGE_TAG=v1.2.0

# Update deployment to use new image
kubectl set image deployment/agent-api \
  agent-api=gcr.io/datadog-ese-sandbox/agent-api:v1.2.0 \
  -n mcp-agent-prod

# Or use make command
make deploy-agent-api ENV=prod
```

### Update ConfigMap

```bash
# Edit ConfigMap
kubectl edit configmap app-config -n mcp-agent-prod

# Restart deployments to pick up changes
make k8s-restart ENV=prod
```

### Update Secrets

```bash
# Update OpenAI API key
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-prod \
  --from-literal=openai-api-key=NEW_KEY \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart to pick up new secret
make k8s-restart ENV=prod
```

### Scale Deployment

```bash
# Scale to 3 replicas
kubectl scale deployment agent-api --replicas=3 -n mcp-agent-prod

# Auto-scale (optional)
kubectl autoscale deployment agent-api \
  --min=2 --max=5 --cpu-percent=80 \
  -n mcp-agent-prod
```

## Production Domains

After deployment, your production services will be available at:

- **Agent Webapp**: https://platform-engineering-demo.dev
- **Burger Webapp**: https://burgers.platform-engineering-demo.dev
- **Agent API**: https://api.platform-engineering-demo.dev (optional, for debugging)
- **Burger API**: https://burger-api.platform-engineering-demo.dev (optional, for debugging)

DNS is managed by Cloudflare, SSL termination happens at Cloudflare, and Gateway routes traffic to the correct services.

## Security Considerations

1. **Don't expose internal services** - Only agent-webapp and burger-webapp should be publicly accessible
2. **Use secrets for sensitive data** - Never put API keys in ConfigMaps
3. **Enable network policies** - Restrict pod-to-pod communication
4. **Review RBAC** - Ensure service accounts have minimal permissions
5. **Enable Pod Security Standards** - Enforce security policies
6. **Use Cloudflare WAF** - Protect against common attacks
7. **Monitor logs** - Set up alerts for errors and suspicious activity

## Cost Optimization

1. **Right-size resources** - Don't over-provision CPU/memory
2. **Use ClusterIP services** - Save money on LoadBalancers (Gateway handles external traffic)
3. **Use spot instances** (if applicable) - Save on compute costs
4. **Enable autoscaling** - Scale down during low traffic
5. **Use Cloudflare caching** - Reduce bandwidth costs

## Next Steps

After production deployment:

1. **Set up monitoring** - Datadog dashboards, alerts
2. **Set up CI/CD** - Automate deployments
3. **Enable backup** - For persistent data (if any)
4. **Document runbooks** - For common operational tasks
5. **Load testing** - Verify performance under load
6. **Disaster recovery plan** - How to recover from failures
