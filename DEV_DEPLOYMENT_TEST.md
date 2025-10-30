# Dev Deployment Test Plan

## Pre-Deployment Checks ✅

### 1. Current Setup Status

- ✅ **Git Branch**: `main` (will deploy to dev environment)
- ✅ **Tools Installed**:
  - gcloud: `/Users/nuttee.jirattivongvibul/Downloads/google-cloud-sdk/bin/gcloud`
  - kubectl: `/opt/homebrew/bin/kubectl`
  - docker: `/usr/local/bin/docker`
- ✅ **Environment Configuration Detected**:
  ```
  Branch:      main
  Environment: dev
  Namespace:   mcp-agent-dev
  Image Tag:   dev-latest
  Replicas:    2
  Project:     datadog-ese-sandbox
  Cluster:     nuttee-cluster-1
  Region:      asia-southeast1-b
  ```

### 2. Missing Environment Variable

⚠️ **DD_API_KEY is not set**

You need to set this before deployment:
```bash
export DD_API_KEY='your-datadog-api-key'
```

## Test Options

### Option 1: Full Deployment Test (Recommended)

This will build Docker images, push to GCR, and deploy to GKE dev environment.

**Prerequisites:**
1. Set DD_API_KEY:
   ```bash
   export DD_API_KEY='your-dev-datadog-key'
   ```

2. Authenticate with GCloud:
   ```bash
   gcloud auth login
   gcloud config set project datadog-ese-sandbox
   ```

3. Get cluster credentials:
   ```bash
   gcloud container clusters get-credentials nuttee-cluster-1 \
     --project=datadog-ese-sandbox \
     --region=asia-southeast1-b
   ```

**Run the test:**
```bash
# Step 1: Generate secrets
./k8s/scripts/generate-secrets.sh

# Step 2: Build and push images (takes 5-10 minutes)
./k8s/scripts/build-and-push.sh

# Step 3: Deploy to GKE dev
./k8s/scripts/deploy.sh
```

### Option 2: Script Validation Test (Quick)

This validates the scripts without actually building or deploying.

```bash
# Test 1: Verify branch detection
source k8s/config/environments.sh
CURRENT_BRANCH=$(git branch --show-current)
get_environment_config "$CURRENT_BRANCH"
display_environment_config

# Test 2: Check secrets generation (dry-run)
echo "DD_API_KEY check:"
if [ -z "$DD_API_KEY" ]; then
  echo "❌ DD_API_KEY not set"
else
  echo "✅ DD_API_KEY is set"
fi

echo "OPENAI_API_KEY check:"
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY not set"
else
  echo "✅ OPENAI_API_KEY is set"
fi

# Test 3: Check Dockerfiles exist
for service in burger-api burger-mcp burger-webapp agent-api agent-webapp; do
  if [ -f "packages/$service/Dockerfile" ]; then
    echo "✅ packages/$service/Dockerfile exists"
  else
    echo "❌ packages/$service/Dockerfile missing"
  fi
done

# Test 4: Check K8s manifests exist
for manifest in burger-api burger-mcp burger-webapp agent-api agent-webapp namespace; do
  if [ -f "k8s/manifests/$manifest.yaml" ]; then
    echo "✅ k8s/manifests/$manifest.yaml exists"
  else
    echo "❌ k8s/manifests/$manifest.yaml missing"
  fi
done
```

### Option 3: Single Service Test

Test building just one service to verify Docker build works:

```bash
# Test building burger-mcp (smallest service)
cd packages/burger-mcp
docker build -t test-burger-mcp:dev .

# Check if build succeeded
if [ $? -eq 0 ]; then
  echo "✅ Docker build successful"
  docker images | grep test-burger-mcp
else
  echo "❌ Docker build failed"
fi

# Clean up test image
docker rmi test-burger-mcp:dev
```

## Expected Results

### After Secret Generation
```
✓ All required environment variables are set
✓ Secrets file generated successfully!

Next steps:
  Apply secrets to your cluster:
    kubectl apply -f k8s/config/secrets.yaml
```

File created: `k8s/config/secrets.yaml` (git-ignored)

### After Build and Push
```
========================================
All Done!
========================================

Images built and pushed:
  gcr.io/datadog-ese-sandbox/burger-api:dev-latest
  gcr.io/datadog-ese-sandbox/burger-api:latest
  gcr.io/datadog-ese-sandbox/burger-mcp:dev-latest
  gcr.io/datadog-ese-sandbox/burger-mcp:latest
  gcr.io/datadog-ese-sandbox/burger-webapp:dev-latest
  gcr.io/datadog-ese-sandbox/burger-webapp:latest
  gcr.io/datadog-ese-sandbox/agent-api:dev-latest
  gcr.io/datadog-ese-sandbox/agent-api:latest
  gcr.io/datadog-ese-sandbox/agent-webapp:dev-latest
  gcr.io/datadog-ese-sandbox/agent-webapp:latest
```

### After Deployment
```
========================================
Deployment Complete!
========================================

Environment Details:
  Branch:      main
  Environment: dev
  Namespace:   mcp-agent-dev
  Image Tag:   dev-latest

Pods:
NAME                             READY   STATUS    RESTARTS   AGE
burger-api-xxx-yyy               1/1     Running   0          2m
burger-mcp-xxx-yyy               1/1     Running   0          2m
burger-webapp-xxx-yyy            1/1     Running   0          2m
agent-api-xxx-yyy                1/1     Running   0          2m
agent-webapp-xxx-yyy             1/1     Running   0          2m

Services:
NAME             TYPE           EXTERNAL-IP     PORT(S)
burger-api       ClusterIP      10.x.x.x        8080/TCP
burger-mcp       ClusterIP      10.x.x.x        3000/TCP
burger-webapp    LoadBalancer   x.x.x.x         80:30080/TCP
agent-api        ClusterIP      10.x.x.x        8080/TCP
agent-webapp     LoadBalancer   x.x.x.x         80:30081/TCP
```

## Verification Commands

After deployment, verify everything is working:

```bash
# 1. Check all pods are running
kubectl get pods -n mcp-agent-dev

# 2. Check services and external IPs
kubectl get services -n mcp-agent-dev

# 3. Check deployment status
kubectl get deployments -n mcp-agent-dev

# 4. View logs for a specific service
kubectl logs -f deployment/burger-mcp -n mcp-agent-dev

# 5. Describe a pod to see events
kubectl get pods -n mcp-agent-dev
kubectl describe pod <pod-name> -n mcp-agent-dev

# 6. Test service connectivity
# Get the external IP for burger-webapp
export BURGER_WEBAPP_IP=$(kubectl get service burger-webapp -n mcp-agent-dev -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Burger Webapp: http://$BURGER_WEBAPP_IP"

# Test if it responds
curl -I http://$BURGER_WEBAPP_IP
```

## Troubleshooting

### Build Failures

**Problem**: Docker build fails for a service

**Check**:
```bash
# Verify Dockerfile exists
ls -l packages/*/Dockerfile

# Try building manually
cd packages/burger-api
docker build -t test .
```

### Push Failures

**Problem**: Cannot push to GCR

**Solution**:
```bash
# Re-authenticate
gcloud auth login
gcloud auth configure-docker gcr.io

# Check permissions
gcloud projects get-iam-policy datadog-ese-sandbox
```

### Deployment Failures

**Problem**: Pods not starting

**Check**:
```bash
# View pod status
kubectl get pods -n mcp-agent-dev

# Describe pod for events
kubectl describe pod <pod-name> -n mcp-agent-dev

# Check logs
kubectl logs <pod-name> -n mcp-agent-dev

# Common issues:
# - Image pull errors: Check if images exist in GCR
# - Secret not found: Generate and apply secrets
# - Resource limits: Check node capacity
```

### Secret Issues

**Problem**: Secrets not found

**Solution**:
```bash
# Generate secrets
export DD_API_KEY='your-key'
export OPENAI_API_KEY='your-key'
./k8s/scripts/generate-secrets.sh

# Apply to cluster
kubectl apply -f k8s/config/secrets.yaml

# Verify
kubectl get secret app-secrets -n mcp-agent-dev
```

## Cleanup

To remove the dev deployment:

```bash
# Option 1: Delete entire namespace (removes everything)
kubectl delete namespace mcp-agent-dev

# Option 2: Delete specific resources
kubectl delete deployments --all -n mcp-agent-dev
kubectl delete services --all -n mcp-agent-dev

# Option 3: Keep namespace, delete pods only
kubectl delete pods --all -n mcp-agent-dev
```

## Next Steps After Successful Test

1. **Monitor the deployment**:
   ```bash
   kubectl get pods -n mcp-agent-dev --watch
   ```

2. **Test the applications**:
   - Get external IPs
   - Access the webapps in browser
   - Test API endpoints

3. **Set up continuous deployment**:
   - Configure GitHub Actions or GitLab CI
   - Automate on push to main branch

4. **Prepare production deployment**:
   - Create prod branch
   - Set prod secrets
   - Test deployment to prod

## Test Execution Log

Use this checklist when running the test:

- [ ] Set DD_API_KEY environment variable
- [ ] Authenticate with gcloud
- [ ] Get GKE cluster credentials
- [ ] Generate secrets: `./k8s/scripts/generate-secrets.sh`
- [ ] Build images: `./k8s/scripts/build-and-push.sh` (10-15 min)
- [ ] Deploy to GKE: `./k8s/scripts/deploy.sh` (3-5 min)
- [ ] Verify pods are running
- [ ] Verify services have external IPs
- [ ] Test application access
- [ ] Check logs for errors
- [ ] Document any issues encountered

## Summary

**What we're testing**:
- ✅ Branch-based environment detection (main → dev)
- ✅ Automatic namespace configuration (mcp-agent-dev)
- ✅ Docker image building and tagging (dev-latest)
- ✅ GCR push with correct project
- ✅ Kubernetes deployment to dev namespace
- ✅ Service creation and external IP assignment
- ✅ Secrets management for dev environment

**Time estimate**:
- Quick validation: 2-3 minutes
- Single service test: 3-5 minutes
- Full deployment: 15-20 minutes

**Risk level**: Low (deploying to dev environment only)
