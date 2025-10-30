# Kubernetes Deployment for GKE

This directory contains all the Kubernetes manifests and Dockerfiles needed to deploy the MCP Agent LangChain.js application to Google Kubernetes Engine (GKE).

## Architecture

The application consists of the following services:
- **burger-api**: Backend API for burger ordering
- **burger-mcp**: Model Context Protocol server for burger tools
- **burger-webapp**: Frontend for viewing orders
- **agent-api**: LangChain.js agent API with MCP client
- **agent-webapp**: Chat interface for the AI agent

## Prerequisites

1. **GCP Project**: `datadog-ese-sandbox`
2. **GKE Cluster**: `nuttee-cluster-1`
3. **Google Cloud SDK** installed and authenticated
4. **kubectl** configured for your GKE cluster
5. **Docker** for building images

## GCP Services Required

You'll need to set up:
- **Cloud SQL** or **Firestore** (instead of Azure Cosmos DB)
- **Cloud Storage** (instead of Azure Blob Storage)
- **Vertex AI** or **another LLM provider** (instead of Azure OpenAI)

## Deployment Steps

### 1. Configure kubectl for your GKE cluster

```bash
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=<your-region>
```

### 2. Build and push Docker images

```bash
# Set your project ID and region
export PROJECT_ID=datadog-ese-sandbox
export REGION=<your-region>

# Build and push all images
./k8s/scripts/build-and-push.sh
```

### 3. Create ConfigMaps and Secrets

```bash
# Edit the config file with your values
cp k8s/config/config.example.yaml k8s/config/config.yaml

# Create ConfigMaps and Secrets
kubectl apply -f k8s/config/config.yaml
kubectl apply -f k8s/config/secrets.yaml
```

### 4. Deploy the application

```bash
# Deploy all services
kubectl apply -f k8s/manifests/
```

### 5. Verify deployment

```bash
# Check pod status
kubectl get pods

# Check services
kubectl get services

# Get external IPs
kubectl get ingress
```

## Configuration

### Environment Variables

The application requires the following environment variables:

- `GCP_PROJECT_ID`: Your GCP project ID
- `FIRESTORE_DATABASE`: Firestore database name
- `GCS_BUCKET`: Cloud Storage bucket name
- `LLM_API_ENDPOINT`: LLM API endpoint (Vertex AI or other)
- `LLM_MODEL`: Model name
- `BURGER_API_URL`: Internal service URL for burger API
- `BURGER_MCP_URL`: Internal service URL for burger MCP
- `AGENT_API_URL`: Internal service URL for agent API

### Secrets

Create a secret with sensitive data:

```bash
kubectl create secret generic app-secrets \
  --from-literal=llm-api-key=<your-api-key> \
  --from-literal=datadog-api-key=<your-dd-api-key>
```

## Monitoring with Datadog

The application is configured for Datadog monitoring. To enable:

1. Create a Datadog API key secret
2. Deploy the Datadog agent DaemonSet
3. Configure APM tracing in your application

## Troubleshooting

```bash
# View logs
kubectl logs -f deployment/burger-api

# Describe a pod
kubectl describe pod <pod-name>

# Execute commands in a pod
kubectl exec -it <pod-name> -- /bin/sh
```

## Clean Up

```bash
# Delete all resources
kubectl delete -f k8s/manifests/
```
