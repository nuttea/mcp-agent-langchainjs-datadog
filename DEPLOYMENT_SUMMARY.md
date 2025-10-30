# GKE Deployment Summary - Updated Configuration

## ✅ Configuration Updated

All deployment files have been updated with the following configuration:

### Cluster Information
- **Project ID**: `datadog-ese-sandbox`
- **Cluster Name**: `nuttee-cluster-1`
- **Region**: `asia-southeast1-b` (updated from us-central1)
- **Namespace**: `mcp-agent-dev` (new)
- **Environment**: `dev`

### Namespace & Labels

All Kubernetes resources are now deployed in the `mcp-agent-dev` namespace with consistent labeling:

```yaml
labels:
  app: mcp-agent          # Application name
  service: <name>         # Service name (burger-mcp, burger-webapp, etc.)
  component: <type>       # Component type (frontend, mcp-server)
  environment: dev        # Environment
```

## 📦 Updated Files

### New Files Created
- ✅ [k8s/manifests/namespace.yaml](k8s/manifests/namespace.yaml) - Namespace definition
- ✅ [k8s/scripts/deploy.sh](k8s/scripts/deploy.sh) - Automated deployment script
- ✅ [QUICKSTART_GKE_UPDATED.md](QUICKSTART_GKE_UPDATED.md) - Updated quick start guide

### Files Updated
- ✅ [k8s/config/configmap.yaml](k8s/config/configmap.yaml) - Added namespace and labels
- ✅ [k8s/config/secrets.example.yaml](k8s/config/secrets.example.yaml) - Added namespace and labels
- ✅ [k8s/manifests/burger-mcp.yaml](k8s/manifests/burger-mcp.yaml) - Updated with namespace and labels
- ✅ [k8s/manifests/burger-webapp.yaml](k8s/manifests/burger-webapp.yaml) - Updated with namespace and labels
- ✅ [k8s/manifests/agent-webapp.yaml](k8s/manifests/agent-webapp.yaml) - Updated with namespace and labels
- ✅ [k8s/scripts/build-and-push.sh](k8s/scripts/build-and-push.sh) - Updated region and namespace info

## 🚀 Quick Deploy Commands

### Option 1: Automated Deployment (Recommended)

```bash
# 1. Configure kubectl
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=asia-southeast1-b

# 2. Build and push images
./k8s/scripts/build-and-push.sh

# 3. Deploy everything
./k8s/scripts/deploy.sh

# 4. Check status
kubectl get all -n mcp-agent-dev
```

### Option 2: Manual Step-by-Step

```bash
# 1. Configure kubectl
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=asia-southeast1-b

# 2. Build and push images
./k8s/scripts/build-and-push.sh

# 3. Create namespace
kubectl apply -f k8s/manifests/namespace.yaml

# 4. Create ConfigMap
kubectl apply -f k8s/config/configmap.yaml

# 5. Create secrets
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-dev \
  --from-literal=openai-api-key=YOUR_KEY \
  --from-literal=datadog-api-key=YOUR_DD_KEY

# 6. Deploy services
kubectl apply -f k8s/manifests/

# 7. Check status
kubectl get pods -n mcp-agent-dev
kubectl get services -n mcp-agent-dev
```

## 📊 Deployed Services

All services are deployed in namespace `mcp-agent-dev`:

### 1. burger-mcp (MCP Server)
```yaml
Replicas: 2
Service Type: ClusterIP
Port: 3000
Selector:
  app: mcp-agent
  service: burger-mcp
  environment: dev
```

### 2. burger-webapp (Orders Dashboard)
```yaml
Replicas: 2
Service Type: LoadBalancer
Port: 80
Selector:
  app: mcp-agent
  service: burger-webapp
  environment: dev
```

### 3. agent-webapp (Chat Interface)
```yaml
Replicas: 2
Service Type: LoadBalancer
Port: 80
Selector:
  app: mcp-agent
  service: agent-webapp
  environment: dev
```

## 🔧 Common Operations

### View Resources

```bash
# All resources in namespace
kubectl get all -n mcp-agent-dev

# Only pods
kubectl get pods -n mcp-agent-dev

# Only services
kubectl get services -n mcp-agent-dev

# With labels
kubectl get pods -n mcp-agent-dev --show-labels
kubectl get pods -n mcp-agent-dev -l app=mcp-agent
kubectl get pods -n mcp-agent-dev -l service=burger-mcp
```

### Logs and Debugging

```bash
# Stream logs from a deployment
kubectl logs -f deployment/burger-mcp -n mcp-agent-dev

# Logs from all pods with label
kubectl logs -f -l app=mcp-agent -n mcp-agent-dev

# Logs from specific service
kubectl logs -f -l service=burger-webapp -n mcp-agent-dev

# Describe a pod
kubectl describe pod <pod-name> -n mcp-agent-dev

# Execute command in pod
kubectl exec -it <pod-name> -n mcp-agent-dev -- sh
```

### Port Forwarding

```bash
# Forward burger-mcp
kubectl port-forward svc/burger-mcp 3000:3000 -n mcp-agent-dev

# Forward burger-webapp
kubectl port-forward svc/burger-webapp 8080:80 -n mcp-agent-dev

# Forward agent-webapp
kubectl port-forward svc/agent-webapp 8081:80 -n mcp-agent-dev
```

### Updates and Restarts

```bash
# Restart a deployment
kubectl rollout restart deployment/burger-mcp -n mcp-agent-dev

# Watch rollout status
kubectl rollout status deployment/burger-mcp -n mcp-agent-dev

# Scale deployment
kubectl scale deployment burger-mcp --replicas=3 -n mcp-agent-dev

# Update image
kubectl set image deployment/burger-mcp \
  burger-mcp=gcr.io/datadog-ese-sandbox/burger-mcp:v2 \
  -n mcp-agent-dev
```

### Clean Up

```bash
# Delete entire namespace (removes everything)
kubectl delete namespace mcp-agent-dev

# Delete specific resources
kubectl delete -f k8s/manifests/ -n mcp-agent-dev
kubectl delete configmap app-config -n mcp-agent-dev
kubectl delete secret app-secrets -n mcp-agent-dev
```

## 📝 Namespace Benefits

Using a dedicated namespace provides:

1. **Isolation**: Resources are isolated from other applications
2. **Organization**: All related resources grouped together
3. **Resource Quotas**: Can set limits per namespace
4. **Access Control**: RBAC policies per namespace
5. **Easy Cleanup**: Delete namespace to remove everything
6. **Multi-Environment**: Easy to create staging, prod namespaces

## 🌍 Multi-Environment Setup

To create additional environments:

```bash
# Create staging namespace
kubectl create namespace mcp-agent-staging

# Create production namespace
kubectl create namespace mcp-agent-prod

# Deploy to specific namespace
kubectl apply -f k8s/manifests/ -n mcp-agent-staging
```

Update labels in manifests:
```yaml
environment: staging  # or prod
```

## 📚 Documentation

- **Quick Start**: [QUICKSTART_GKE_UPDATED.md](QUICKSTART_GKE_UPDATED.md)
- **Detailed Guide**: [DEPLOY_GKE.md](DEPLOY_GKE.md)
- **Original Quick Start**: [QUICKSTART_GKE.md](QUICKSTART_GKE.md)
- **Complete Summary**: [GKE_DEPLOYMENT_SUMMARY.md](GKE_DEPLOYMENT_SUMMARY.md)
- **Kubernetes Docs**: [k8s/README.md](k8s/README.md)

## ⚠️ Important Notes

1. **Region Updated**: Changed from `us-central1` to `asia-southeast1-b`
2. **Namespace**: All resources now use `mcp-agent-dev` namespace
3. **Labels**: Consistent labeling across all resources
4. **Scripts Updated**: Build and deploy scripts use correct region
5. **Services Ready**: 3 out of 5 services ready to deploy
6. **Functions Pending**: burger-api and agent-api still need conversion

## 🎯 Next Steps

1. ✅ **Test Infrastructure**
   ```bash
   ./k8s/scripts/deploy.sh
   kubectl get all -n mcp-agent-dev
   ```

2. ❌ **Convert Azure Functions**
   - burger-api (4-6 hours)
   - agent-api (6-8 hours)

3. ❌ **Set Up GCP Services**
   - Firestore
   - Cloud Storage
   - Vertex AI

4. ❌ **Configure Monitoring**
   - Datadog agent
   - APM tracing
   - Logging

## 📞 Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/burger-mcp -n mcp-agent-dev`
- Describe resources: `kubectl describe pod <pod-name> -n mcp-agent-dev`
- View events: `kubectl get events -n mcp-agent-dev`

---

**Last Updated**: $(date)
**Namespace**: mcp-agent-dev
**Environment**: dev
**Region**: asia-southeast1-b
**Cluster**: nuttee-cluster-1
**Project**: datadog-ese-sandbox
