# Deploy to Production - Quick Start

## TL;DR - Fast Production Deployment

```bash
# 1. Run automated setup script
./scripts/setup-prod.sh

# 2. Create secrets (when prompted)
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-prod \
  --from-literal=openai-api-key=YOUR_OPENAI_API_KEY

# 3. Done! Access your apps:
# https://platform-engineering-demo.dev
# https://burgers.platform-engineering-demo.dev
```

## Manual Steps (if you prefer)

### 1. Create Production Namespace & ConfigMap

```bash
kubectl apply -f k8s/gateway/00-namespace-shared-infra.yaml
kubectl apply -f k8s/config/configmap-prod.yaml
```

### 2. Create Secrets

```bash
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-prod \
  --from-literal=openai-api-key=YOUR_OPENAI_API_KEY
```

### 3. Create Production Manifests

```bash
# Create directory
mkdir -p k8s/manifests-prod

# Copy and update manifests
cp k8s/manifests/*.yaml k8s/manifests-prod/

# Update namespace (macOS)
sed -i '' 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml
sed -i '' 's/environment: dev/environment: prod/g' k8s/manifests-prod/*.yaml

# Or for Linux:
# sed -i 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml
# sed -i 's/environment: dev/environment: prod/g' k8s/manifests-prod/*.yaml
```

### 4. Deploy Services

```bash
kubectl apply -f k8s/manifests-prod/
```

### 5. Apply HTTPRoutes

```bash
kubectl apply -f k8s/gateway/03-httproute-prod.yaml
```

### 6. Verify

```bash
kubectl get pods -n mcp-agent-prod
kubectl get httproute -n mcp-agent-prod
```

## Using Make Commands

```bash
# Deploy individual services to production
make deploy-agent-api ENV=prod
make deploy-agent-webapp ENV=prod
make deploy-burger-api ENV=prod
make deploy-burger-webapp ENV=prod
make deploy-burger-mcp ENV=prod

# Check status
make k8s-status ENV=prod

# View logs
make k8s-logs ENV=prod

# Restart all services
make k8s-restart ENV=prod
```

## Production URLs

After deployment, your apps are available at:

- **Agent Webapp**: https://platform-engineering-demo.dev
- **Burger Webapp**: https://burgers.platform-engineering-demo.dev
- **Agent API**: https://api.platform-engineering-demo.dev (optional)
- **Burger API**: https://burger-api.platform-engineering-demo.dev (optional)

## Quick Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n mcp-agent-prod

# Check logs
kubectl logs <pod-name> -n mcp-agent-prod
```

### HTTPRoutes not working

```bash
# Check HTTPRoute status
kubectl describe httproute -n mcp-agent-prod

# Verify Gateway
kubectl get gateway -n shared-infra
```

### 502 errors

```bash
# Check if services have endpoints
kubectl get endpoints -n mcp-agent-prod

# Check if pods are ready
kubectl get pods -n mcp-agent-prod
```

## Important Production Settings

Before going live, ensure:

1. **Secrets are set**: OpenAI API key configured
2. **Replicas increased**: Set to 2+ for high availability
3. **Resource limits configured**: Appropriate CPU/memory limits
4. **Services are ClusterIP**: Remove LoadBalancer type (Gateway handles external traffic)
5. **DNS configured**: Cloudflare pointing to Gateway IP
6. **SSL working**: Cloudflare SSL termination enabled
7. **Monitoring enabled**: Datadog agents running

## Differences from Dev

| Setting | Dev | Prod |
|---------|-----|------|
| Namespace | mcp-agent-dev | mcp-agent-prod |
| Domain | dev.platform-engineering-demo.dev | platform-engineering-demo.dev |
| PUBLIC_BASE_URL | https://dev.platform-engineering-demo.dev | https://platform-engineering-demo.dev |
| Replicas | 1 | 2+ |
| Service Type | LoadBalancer (optional) | ClusterIP |

## Rollback

If something goes wrong:

```bash
# Rollback specific deployment
kubectl rollout undo deployment agent-api -n mcp-agent-prod

# Rollback all
kubectl rollout undo deployment --all -n mcp-agent-prod
```

## Next Steps

1. **Monitor**: Watch logs and metrics in Datadog
2. **Scale**: Adjust replica count based on traffic
3. **Optimize**: Configure HPA (Horizontal Pod Autoscaler)
4. **Backup**: Set up backup strategy for data
5. **CI/CD**: Automate deployments with GitHub Actions

## Full Documentation

See [DEPLOY_TO_PROD.md](DEPLOY_TO_PROD.md) for complete production deployment guide.
