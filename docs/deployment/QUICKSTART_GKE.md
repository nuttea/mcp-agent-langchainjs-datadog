# Quick Start: Deploy to GKE

This guide helps you quickly deploy the MCP Agent LangChain.js application to your GKE cluster `nuttee-cluster-1` in project `datadog-ese-sandbox`.

## TL;DR - Quick Deploy

```bash
# 1. Configure kubectl
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=us-central1

# 2. Build and push images
./k8s/scripts/build-and-push.sh

# 3. Deploy to Kubernetes
kubectl apply -f k8s/config/configmap.yaml
kubectl create secret generic app-secrets \
  --from-literal=openai-api-key=YOUR_KEY \
  --from-literal=datadog-api-key=YOUR_DD_KEY

kubectl apply -f k8s/manifests/

# 4. Check status
kubectl get pods
kubectl get services
```

## What's Been Created

I've set up the following for you:

### ✅ Dockerfiles Created
- `packages/burger-mcp/Dockerfile` - MCP server
- `packages/burger-webapp/Dockerfile` - Orders dashboard
- `packages/agent-webapp/Dockerfile` - Chat interface
- `packages/burger-webapp/nginx.conf` - Nginx config
- `packages/agent-webapp/nginx.conf` - Nginx config

### ✅ Kubernetes Manifests
- `k8s/manifests/burger-mcp.yaml` - MCP server deployment + service
- `k8s/manifests/burger-webapp.yaml` - Frontend deployment + LoadBalancer
- `k8s/manifests/agent-webapp.yaml` - Chat UI deployment + LoadBalancer

### ✅ Configuration Files
- `k8s/config/configmap.yaml` - Application configuration
- `k8s/config/secrets.example.yaml` - Secrets template

### ✅ Deployment Scripts
- `k8s/scripts/build-and-push.sh` - Automated build and push
- `DEPLOY_GKE.md` - Detailed deployment guide
- `k8s/README.md` - Kubernetes documentation

## ⚠️ Important: What's Missing

### Azure Functions Not Converted Yet

The `burger-api` and `agent-api` are **Azure Functions** and need to be converted to standard Node.js HTTP servers before they can run on Kubernetes.

**You have two options:**

### Option 1: Quick Test Without APIs (Recommended to Start)

Deploy just the frontend apps and MCP server to test the infrastructure:

```bash
# Deploy only the services we have Dockerfiles for
kubectl apply -f k8s/manifests/burger-mcp.yaml
kubectl apply -f k8s/manifests/burger-webapp.yaml
kubectl apply -f k8s/manifests/agent-webapp.yaml
```

### Option 2: Convert Azure Functions (For Full Functionality)

To convert the Azure Functions, you need to:

1. **Create Express/Fastify servers** for burger-api and agent-api
2. **Convert function triggers** to HTTP routes
3. **Replace Azure SDK calls** with GCP equivalents
4. **Create Dockerfiles** for these services

See [DEPLOY_GKE.md](DEPLOY_GKE.md#converting-azure-functions) for detailed instructions.

## Current Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  agent-webapp   │────▶│   agent-api     │ ❌ (Azure Function)
│   (Frontend)    │     │  (LangChain.js) │
└─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   burger-mcp    │ ✅ (Ready to deploy)
                        │  (MCP Server)   │
                        └─────────────────┘
                               │
                               ▼
┌─────────────────┐     ┌─────────────────┐
│ burger-webapp   │────▶│   burger-api    │ ❌ (Azure Function)
│   (Frontend)    │     │  (Orders API)   │
└─────────────────┘     └─────────────────┘
```

## Next Steps

### 1. Test the MCP Server

Deploy just the MCP server to verify it works:

```bash
kubectl apply -f k8s/manifests/burger-mcp.yaml

# Port forward to test locally
kubectl port-forward svc/burger-mcp 3000:3000

# Test the endpoint
curl http://localhost:3000
```

### 2. Configure GCP Services

Before full deployment, set up:

- **Firestore** for database
- **Cloud Storage** for file storage
- **Vertex AI** or keep using OpenAI for LLM

### 3. Convert Azure Functions

The biggest task is converting the Azure Functions. I recommend:

1. Start with `burger-api` (simpler, no LLM dependencies)
2. Create an Express server that wraps the existing logic
3. Replace Cosmos DB with Firestore
4. Replace Azure Blob with Cloud Storage

### 4. Set Up Monitoring

```bash
# Install Datadog agent
helm install datadog datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.site='datadoghq.com'
```

## Useful Commands

```bash
# View logs
kubectl logs -f deployment/burger-mcp

# Describe resources
kubectl describe pod <pod-name>

# Execute commands in pod
kubectl exec -it <pod-name> -- sh

# Get external IPs
kubectl get services

# Delete everything
kubectl delete -f k8s/manifests/
```

## Getting Help

If you need help with:
- **Converting Azure Functions**: Check [DEPLOY_GKE.md](DEPLOY_GKE.md)
- **Kubernetes basics**: See [k8s/README.md](k8s/README.md)
- **GCP services**: Refer to Google Cloud documentation

## Summary

**What Works Now:**
- ✅ Dockerfiles for 3 services (burger-mcp, burger-webapp, agent-webapp)
- ✅ Kubernetes manifests ready to deploy
- ✅ Build and deployment scripts
- ✅ Configuration templates

**What Needs Work:**
- ❌ Convert burger-api from Azure Functions
- ❌ Convert agent-api from Azure Functions
- ❌ Set up GCP services (Firestore, Cloud Storage)
- ❌ Configure LLM provider (Vertex AI or OpenAI)
- ❌ Migrate data from Azure Cosmos DB

**Time Estimate:**
- Testing infrastructure: 1-2 hours
- Converting Azure Functions: 4-8 hours per service
- Full migration: 2-3 days

Good luck with your deployment! 🚀
