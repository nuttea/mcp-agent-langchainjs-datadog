# IAP Health Check Issue - Critical Fix Required

## 🔴 Critical Problem Identified

The redirect loop is caused by **IAP intercepting health check requests**.

### Root Cause

1. Health check requests go to: `GET /`
2. IAP intercepts ALL requests (including health checks)
3. Health check doesn't have authentication cookie
4. IAP redirects health check to OAuth (302 redirect)
5. Health check fails → Backend marked unhealthy
6. User requests also fail because backend is unhealthy
7. Result: `ERR_TOO_MANY_REDIRECTS`

## ✅ Solution Options

### Option 1: Dedicated Health Check Endpoint (Recommended)

Create a separate health check endpoint that bypasses IAP using firewall rules.

#### Step 1: Add Health Check Endpoint to agent-webapp

Update `nginx.conf` to add a dedicated health endpoint:

```nginx
# Health check endpoint (before location / block)
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

#### Step 2: Update GKE Health Check Path

```bash
# This will be done automatically by updating the HTTPRoute/GCPBackendPolicy
# The health check path needs to be /health instead of /
```

#### Step 3: Configure Firewall Rule to Allow Health Checks

Health checks come from Google's IP ranges and should bypass IAP:

```bash
# Create firewall rule (if not already exists)
gcloud compute firewall-rules create allow-health-checks \
    --allow tcp:80,tcp:443,tcp:8080 \
    --source-ranges 35.191.0.0/16,130.211.0.0/22 \
    --target-tags gke-node \
    --description "Allow Google Cloud health checks"
```

### Option 2: Configure GCPBackendPolicy with Health Check Exclusion

Unfortunately, **GCPBackendPolicy doesn't support path-based IAP exclusions**. IAP is all-or-nothing for a backend service.

### Option 3: Use Separate Backend Service for Health (Complex)

Create a separate backend service without IAP just for health checks. This is overly complex and not recommended.

## 🚀 Recommended Fix: Option 1

### Implementation Steps

#### 1. Update nginx.conf

**File**: `packages/agent-webapp/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Health check endpoint - must be accessible without authentication
    # This endpoint is accessed by Google Cloud health checks
    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Root location for the React app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ... rest of config
}
```

#### 2. Rebuild and Deploy agent-webapp

```bash
# Build new image with updated nginx config
cd packages/agent-webapp
docker build -t us-central1-docker.pkg.dev/datadog-ese-sandbox/mcp-agent/agent-webapp:latest .
docker push us-central1-docker.pkg.dev/datadog-ese-sandbox/mcp-agent/agent-webapp:latest

# Or use make command
make build-agent-webapp
make push-agent-webapp

# Deploy
make deploy ENV=prod
```

#### 3. Update Health Check Path via GCP Console (Temporary)

Since GKE Gateway API manages health checks automatically, we need to either:

**Option A**: Wait for the health check to update automatically (may take time)

**Option B**: Manually update the health check path:

```bash
gcloud compute health-checks update http \
    gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
    --global \
    --request-path=/health
```

**Option C**: Add a GCPHealthCheckPolicy (if supported):

```yaml
apiVersion: networking.gke.io/v1
kind: GCPHealthCheckPolicy
metadata:
  name: agent-webapp-health-check
  namespace: mcp-agent-prod
spec:
  default:
    checkIntervalSec: 10
    timeoutSec: 5
    healthyThreshold: 2
    unhealthyThreshold: 2
    config:
      type: HTTP
      httpHealthCheck:
        requestPath: /health
        port: 80
  targetRef:
    group: ""
    kind: Service
    name: agent-webapp
```

### Alternative Workaround: Use Kubernetes Health Probes

Update the agent-webapp deployment to use Kubernetes-native health checks:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-webapp
spec:
  template:
    spec:
      containers:
      - name: agent-webapp
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔍 Why IAP Doesn't Work with Health Checks

### IAP Authentication Flow
1. User makes request
2. IAP checks for valid cookie/JWT
3. No cookie → Redirect to OAuth (302)
4. User authenticates → Gets cookie
5. Request proceeds to backend

### Health Check Flow (Broken)
1. Health check makes request (no cookie)
2. IAP checks for valid cookie/JWT
3. No cookie → Redirect to OAuth (302) ← **This fails health check!**
4. Health check expects 200 OK, gets 302
5. Backend marked UNHEALTHY
6. All traffic fails

### With `/health` Endpoint (Fixed)
1. Health check makes request to `/health`
2. **nginx returns 200 directly (before IAP)**
3. Health check passes
4. Backend marked HEALTHY
5. User traffic can flow (IAP still protects `/`)

## 🔐 Security Consideration

The `/health` endpoint should:
- Return minimal information (just "healthy")
- Not expose sensitive data
- Be acceptable to be publicly accessible
- Only respond to health check IP ranges (via firewall)

Health check IP ranges:
- `35.191.0.0/16`
- `130.211.0.0/22`

## 📝 Implementation Priority

1. **Immediate**: Update nginx.conf with `/health` endpoint
2. **Immediate**: Rebuild and deploy agent-webapp
3. **Wait**: Health check should auto-update, or manually update
4. **Verify**: Check backend health status
5. **Test**: Access application in browser

## 🧪 Testing

### Test Health Endpoint Locally

```bash
# Port forward to agent-webapp
kubectl port-forward -n mcp-agent-prod deployment/agent-webapp 8080:80

# Test health endpoint
curl http://localhost:8080/health
# Expected: "healthy"

# Test root (should still serve React app)
curl http://localhost:8080/
# Expected: HTML content
```

### Verify Backend Health

```bash
# Check backend health after deploying fix
gcloud compute backend-services get-health \
    gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
    --global

# Expected: HEALTHY status
```

### Test IAP Authentication

After backend is healthy:
1. Open incognito browser
2. Go to `https://www.platform-engineering-demo.dev`
3. Should redirect to Google OAuth
4. Login with `@datadoghq.com` email
5. Should redirect back and load successfully

## 📊 Monitoring

### Datadog Metrics

Create monitors for:
1. Backend health status changes
2. Health check failure rate
3. IAP authentication success rate

### Logs to Check

```bash
# agent-webapp logs (should see health checks)
kubectl logs -n mcp-agent-prod deployment/agent-webapp | grep "/health"

# Should see:
# GET /health 200 - (from health check IPs)
```

## Summary

The redirect loop is caused by IAP intercepting health check requests. The fix is to create a dedicated `/health` endpoint that returns 200 OK before IAP processing, allowing health checks to pass while still protecting the main application with IAP.

**Critical**: This fix must be implemented before IAP can work properly with user traffic.
