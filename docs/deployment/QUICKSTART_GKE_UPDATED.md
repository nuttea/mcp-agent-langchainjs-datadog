# Quick Start: Deploy to GKE (Updated)

Deploy the MCP Agent LangChain.js application to GKE cluster `nuttee-cluster-1` in project `datadog-ese-sandbox`.

## Configuration

- **Project ID**: `datadog-ese-sandbox`
- **Cluster**: `nuttee-cluster-1`
- **Region**: `asia-southeast1-b`
- **Namespace**: `mcp-agent-dev`
- **Environment**: `dev`

## TL;DR - Quick Deploy

```bash
# 1. Configure kubectl for your cluster
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=asia-southeast1-b

# 2. Build and push Docker images
./k8s/scripts/build-and-push.sh

# 3. Deploy everything (automated)
./k8s/scripts/deploy.sh

# 4. Check status
kubectl get pods -n mcp-agent-dev
kubectl get services -n mcp-agent-dev
```

## Step-by-Step Deployment

### Step 1: Configure kubectl

```bash
gcloud container clusters get-credentials nuttee-cluster-1 \
  --project=datadog-ese-sandbox \
  --region=asia-southeast1-b
```

### Step 2: Build and Push Docker Images

```bash
# Make scripts executable
chmod +x k8s/scripts/*.sh

# Build and push images to GCR
./k8s/scripts/build-and-push.sh
```

This will build and push 3 services:
- `gcr.io/datadog-ese-sandbox/burger-mcp:latest`
- `gcr.io/datadog-ese-sandbox/burger-webapp:latest`
- `gcr.io/datadog-ese-sandbox/agent-webapp:latest`

### Step 3: Create Namespace

```bash
kubectl apply -f k8s/manifests/namespace.yaml
```

This creates the `mcp-agent-dev` namespace with proper labels:
- `app: mcp-agent`
- `environment: dev`

### Step 4: Create ConfigMap

```bash
kubectl apply -f k8s/config/configmap.yaml
```

### Step 5: Create Secrets

```bash
kubectl create secret generic app-secrets \
  --namespace=mcp-agent-dev \
  --from-literal=openai-api-key=YOUR_OPENAI_KEY \
  --from-literal=datadog-api-key=YOUR_DD_API_KEY
```

**Or** if you prefer to keep secrets in a file (not recommended for production):

```bash
# Edit the example file
cp k8s/config/secrets.example.yaml k8s/config/secrets.yaml
# Edit secrets.yaml with your actual keys
kubectl apply -f k8s/config/secrets.yaml
```

### Step 6: Deploy Services

```bash
kubectl apply -f k8s/manifests/
```

Or use the automated deployment script:

```bash
./k8s/scripts/deploy.sh
```

### Step 7: Verify Deployment

```bash
# Check pods
kubectl get pods -n mcp-agent-dev

# Check services
kubectl get services -n mcp-agent-dev

# Check deployments
kubectl get deployments -n mcp-agent-dev

# View logs
kubectl logs -f deployment/burger-mcp -n mcp-agent-dev
```

## What's Deployed

All resources are deployed in the `mcp-agent-dev` namespace with proper labeling:

### Labels Applied
- `app: mcp-agent` - Application name
- `service: <service-name>` - Specific service
- `component: <frontend|mcp-server>` - Component type
- `environment: dev` - Environment

### Services Deployed

1. **burger-mcp** (MCP Server)
   - Deployment with 2 replicas
   - ClusterIP service on port 3000
   - Health checks configured
   - Resource limits: 256Mi-512Mi RAM, 250m-500m CPU

2. **burger-webapp** (Orders Dashboard)
   - Deployment with 2 replicas
   - LoadBalancer service on port 80
   - Nginx serving static files
   - Resource limits: 128Mi-256Mi RAM, 100m-200m CPU

3. **agent-webapp** (Chat Interface)
   - Deployment with 2 replicas
   - LoadBalancer service on port 80
   - Nginx serving static files
   - Proxy API requests to agent-api
   - Resource limits: 128Mi-256Mi RAM, 100m-200m CPU

## Accessing Services

### Get External IPs

```bash
kubectl get services -n mcp-agent-dev
```

Look for the `EXTERNAL-IP` column for LoadBalancer services. It may take a few minutes for GCP to assign external IPs.

### Port Forwarding (for testing)

```bash
# Forward burger-mcp locally
kubectl port-forward svc/burger-mcp 3000:3000 -n mcp-agent-dev

# Forward burger-webapp locally
kubectl port-forward svc/burger-webapp 8080:80 -n mcp-agent-dev

# Forward agent-webapp locally
kubectl port-forward svc/agent-webapp 8081:80 -n mcp-agent-dev
```

## Monitoring

### View Logs

```bash
# Stream logs from burger-mcp
kubectl logs -f deployment/burger-mcp -n mcp-agent-dev

# View logs from all pods
kubectl logs -f -l app=mcp-agent -n mcp-agent-dev

# View logs from specific service
kubectl logs -f -l service=burger-webapp -n mcp-agent-dev
```

### Describe Resources

```bash
# Describe a pod
kubectl describe pod <pod-name> -n mcp-agent-dev

# Describe a service
kubectl describe service burger-mcp -n mcp-agent-dev

# Describe deployment
kubectl describe deployment burger-mcp -n mcp-agent-dev
```

### Execute Commands in Pods

```bash
# Get a shell in a pod
kubectl exec -it <pod-name> -n mcp-agent-dev -- sh

# Run a command
kubectl exec <pod-name> -n mcp-agent-dev -- curl localhost:3000
```

## Updating Deployments

### Update Image

```bash
# Build and push new image
./k8s/scripts/build-and-push.sh

# Restart deployment to pull new image
kubectl rollout restart deployment/burger-mcp -n mcp-agent-dev

# Watch rollout status
kubectl rollout status deployment/burger-mcp -n mcp-agent-dev
```

### Update ConfigMap

```bash
# Edit configmap
kubectl edit configmap app-config -n mcp-agent-dev

# Or apply changes
kubectl apply -f k8s/config/configmap.yaml

# Restart deployments to pick up changes
kubectl rollout restart deployment -n mcp-agent-dev
```

## Scaling

```bash
# Scale a deployment
kubectl scale deployment burger-mcp --replicas=3 -n mcp-agent-dev

# Auto-scale based on CPU
kubectl autoscale deployment burger-mcp \
  --min=2 --max=10 --cpu-percent=80 \
  -n mcp-agent-dev
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n mcp-agent-dev

# Describe pod for events
kubectl describe pod <pod-name> -n mcp-agent-dev

# Check logs
kubectl logs <pod-name> -n mcp-agent-dev
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n mcp-agent-dev

# Check if pods are ready
kubectl get pods -n mcp-agent-dev -o wide

# Verify service configuration
kubectl describe service burger-mcp -n mcp-agent-dev
```

### Image Pull Errors

```bash
# Verify images exist in GCR
gcloud container images list --project=datadog-ese-sandbox

# Check if GKE can access GCR
kubectl describe pod <pod-name> -n mcp-agent-dev | grep -A 5 "Events"
```

## Clean Up

### Delete All Resources

```bash
# Delete the entire namespace (removes all resources)
kubectl delete namespace mcp-agent-dev
```

### Delete Specific Resources

```bash
# Delete a service
kubectl delete service burger-mcp -n mcp-agent-dev

# Delete a deployment
kubectl delete deployment burger-mcp -n mcp-agent-dev

# Delete configmap
kubectl delete configmap app-config -n mcp-agent-dev
```

## Useful Commands Cheat Sheet

```bash
# List all resources in namespace
kubectl get all -n mcp-agent-dev

# Get resource usage
kubectl top pods -n mcp-agent-dev
kubectl top nodes

# Edit a resource
kubectl edit deployment burger-mcp -n mcp-agent-dev

# Apply all manifests
kubectl apply -f k8s/manifests/ -f k8s/config/

# Delete all
kubectl delete -f k8s/manifests/ -f k8s/config/

# Watch resources
kubectl get pods -n mcp-agent-dev --watch

# Get YAML of running resource
kubectl get deployment burger-mcp -n mcp-agent-dev -o yaml
```

## Next Steps

1. ✅ Deploy the 3 ready services
2. ❌ Convert Azure Functions (burger-api, agent-api)
3. ❌ Set up GCP services (Firestore, Cloud Storage)
4. ❌ Configure Vertex AI or OpenAI
5. ❌ Set up monitoring and alerting
6. ❌ Configure custom domains and SSL

See [DEPLOY_GKE.md](DEPLOY_GKE.md) for detailed information on Azure Functions conversion.
