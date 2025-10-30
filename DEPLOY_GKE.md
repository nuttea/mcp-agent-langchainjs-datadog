# Deploying to Google Kubernetes Engine (GKE)

This guide explains how to deploy the MCP Agent LangChain.js application to GKE cluster `nuttee-cluster-1` in project `datadog-ese-sandbox`.

## Overview

This application currently uses Azure services and needs to be adapted for GCP. Here's the migration path:

### Current Azure Services → GCP Equivalents

| Azure Service | GCP Equivalent | Notes |
|---------------|----------------|-------|
| Azure Functions | Cloud Run / GKE | We'll use GKE with standard Node.js apps |
| Azure Cosmos DB | Firestore / Cloud SQL | Use Firestore for NoSQL |
| Azure Blob Storage | Cloud Storage | Direct replacement |
| Azure OpenAI | Vertex AI / OpenAI API | Use Vertex AI or keep OpenAI API |
| Azure Static Web Apps | Cloud Storage + CDN | Serve static files from GCS |
| Application Insights | Cloud Monitoring | Native GCP monitoring |

## Prerequisites

1. **GCP CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project datadog-ese-sandbox
   ```

2. **kubectl** configured for your cluster:
   ```bash
   gcloud container clusters get-credentials nuttee-cluster-1 --region=us-central1
   ```

3. **Docker** installed for building images

## Step 1: Set Up GCP Services

### 1.1 Create Firestore Database

```bash
gcloud firestore databases create --region=us-central1
```

### 1.2 Create Cloud Storage Bucket

```bash
gsutil mb -p datadog-ese-sandbox -c STANDARD -l us-central1 gs://mcp-agent-burgers-data
gsutil mb -p datadog-ese-sandbox -c STANDARD -l us-central1 gs://mcp-agent-burgers-images
```

### 1.3 Set Up Vertex AI (Optional)

If using Vertex AI instead of OpenAI:
```bash
gcloud services enable aiplatform.googleapis.com
```

## Step 2: Build Docker Images

The application has 5 services that need to be containerized:

```bash
export PROJECT_ID=datadog-ese-sandbox
export REGION=us-central1

# Build burger-mcp (MCP server)
cd packages/burger-mcp
docker build -t gcr.io/$PROJECT_ID/burger-mcp:latest .
docker push gcr.io/$PROJECT_ID/burger-mcp:latest

# Build burger-webapp (Frontend)
cd ../burger-webapp
docker build -t gcr.io/$PROJECT_ID/burger-webapp:latest .
docker push gcr.io/$PROJECT_ID/burger-webapp:latest

# Build agent-webapp (Frontend)
cd ../agent-webapp
docker build -t gcr.io/$PROJECT_ID/agent-webapp:latest .
docker push gcr.io/$PROJECT_ID/agent-webapp:latest
```

**Note**: `burger-api` and `agent-api` are Azure Functions and need to be converted to standard Express/Fastify apps before containerization. See [Converting Azure Functions](#converting-azure-functions) section.

## Step 3: Create Kubernetes Resources

### 3.1 Create ConfigMap

Create `k8s/config/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  GCP_PROJECT_ID: "datadog-ese-sandbox"
  FIRESTORE_DATABASE: "(default)"
  GCS_BUCKET: "mcp-agent-burgers-data"
  GCS_IMAGES_BUCKET: "mcp-agent-burgers-images"
  BURGER_API_URL: "http://burger-api:8080"
  BURGER_MCP_URL: "http://burger-mcp:3000/mcp"
  AGENT_API_URL: "http://agent-api:8080"
  NODE_ENV: "production"
```

Apply:
```bash
kubectl apply -f k8s/config/configmap.yaml
```

### 3.2 Create Secrets

```bash
# Create secret for API keys
kubectl create secret generic app-secrets \
  --from-literal=openai-api-key=<YOUR_OPENAI_API_KEY> \
  --from-literal=datadog-api-key=<YOUR_DATADOG_API_KEY>
```

## Step 4: Deploy Services

### 4.1 Deploy burger-mcp

Create `k8s/manifests/burger-mcp.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: burger-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: burger-mcp
  template:
    metadata:
      labels:
        app: burger-mcp
    spec:
      containers:
      - name: burger-mcp
        image: gcr.io/datadog-ese-sandbox/burger-mcp:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        env:
        - name: BURGER_API_URL
          value: "http://burger-api:8080"
---
apiVersion: v1
kind: Service
metadata:
  name: burger-mcp
spec:
  selector:
    app: burger-mcp
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

Apply:
```bash
kubectl apply -f k8s/manifests/burger-mcp.yaml
```

### 4.2 Deploy Web Apps

Similar deployment files for:
- `burger-webapp.yaml`
- `agent-webapp.yaml`

### 4.3 Create Ingress

Create `k8s/manifests/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-agent-ingress
  annotations:
    kubernetes.io/ingress.class: "gce"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  rules:
  - host: burgers.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: burger-webapp
            port:
              number: 80
  - host: agent.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: agent-webapp
            port:
              number: 80
```

## Converting Azure Functions

The `burger-api` and `agent-api` are Azure Functions and need to be converted to standard HTTP servers.

### Option 1: Manual Conversion

1. Create an Express/Fastify server
2. Convert Azure Function bindings to HTTP routes
3. Replace Azure SDK calls with GCP SDK calls

### Option 2: Use Azure Functions on Kubernetes (Advanced)

You can run Azure Functions in Kubernetes using KEDA, but this adds complexity.

## Monitoring with Datadog

### Install Datadog Agent

```bash
helm repo add datadog https://helm.datadoghq.com
helm repo update

helm install datadog datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.site='datadoghq.com' \
  --set datadog.logs.enabled=true \
  --set datadog.apm.enabled=true
```

### Configure APM in Your Apps

Add to your Node.js apps:

```javascript
import tracer from 'dd-trace';
tracer.init({
  service: 'burger-mcp',
  env: 'production'
});
```

## Verification

```bash
# Check pods
kubectl get pods

# Check services
kubectl get services

# Check ingress
kubectl get ingress

# View logs
kubectl logs -f deployment/burger-mcp

# Port forward for testing
kubectl port-forward svc/burger-mcp 3000:3000
```

## Next Steps

1. **Convert Azure Functions** to standard Node.js apps
2. **Migrate data** from Cosmos DB to Firestore
3. **Update environment variables** to use GCP services
4. **Set up CI/CD** with Cloud Build or GitHub Actions
5. **Configure domain and SSL** certificates
6. **Set up monitoring** and alerting

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Service not accessible
```bash
kubectl get endpoints
kubectl describe service <service-name>
```

### Image pull errors
```bash
# Ensure GKE has access to GCR
gcloud projects add-iam-policy-binding datadog-ese-sandbox \
  --member=serviceAccount:<GKE_SA> \
  --role=roles/storage.objectViewer
```

## Clean Up

```bash
# Delete all resources
kubectl delete -f k8s/manifests/
kubectl delete configmap app-config
kubectl delete secret app-secrets
```

## Important Notes

- This is a **conversion guide** - the Azure Functions need significant refactoring
- Consider using **Cloud Run** instead of GKE for simpler deployment
- **Security**: Use Workload Identity for GCP service authentication
- **Costs**: Monitor your GCP costs, especially for Firestore and Vertex AI

## Additional Resources

- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Migrating from Azure to GCP](https://cloud.google.com/free/docs/aws-azure-gcp-service-comparison)
- [Datadog on GKE](https://docs.datadoghq.com/containers/kubernetes/)
