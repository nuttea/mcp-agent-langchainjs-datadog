# IAP Fix - Ready to Deploy! 🚀

## ✅ What's Been Fixed

### 1. nginx Configuration Updated ✅
**File**: `packages/agent-webapp/nginx.conf`

Added `/health` endpoint:
```nginx
location = /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

### 2. HealthCheckPolicy Created ✅
**Files**:
- `k8s/gateway/05-healthcheck-policy-iap.yaml` (prod)
- `k8s/overlays/dev/healthcheck-policy.yaml` (dev)

Applied to both environments:
```bash
$ kubectl get healthcheckpolicy -A
NAMESPACE        NAME                        AGE
mcp-agent-dev    agent-webapp-health-check   1m
mcp-agent-prod   agent-webapp-health-check   1m
```

### 3. Kustomization Updated ✅
Both dev and prod kustomization.yaml include the health check policies.

## 🚀 Deploy Commands

### Option 1: Deploy Everything (Recommended)

```bash
# Deploy to production (rebuilds and pushes all images)
make deploy ENV=prod

# Deploy to dev
make deploy ENV=dev
```

This will:
1. Rebuild agent-webapp with new nginx.conf
2. Push image to registry
3. Apply all Kubernetes manifests including HealthCheckPolicy
4. Wait for rollout to complete

### Option 2: Deploy Only agent-webapp

If you want to deploy just agent-webapp without rebuilding other services:

```bash
# Build and push agent-webapp
cd packages/agent-webapp
docker build -t us-central1-docker.pkg.dev/datadog-ese-sandbox/mcp-agent/agent-webapp:latest .
docker push us-central1-docker.pkg.dev/datadog-ese-sandbox/mcp-agent/agent-webapp:latest

# Restart deployment to pull new image
kubectl rollout restart deployment/agent-webapp -n mcp-agent-prod
kubectl rollout restart deployment/agent-webapp -n mcp-agent-dev
```

### Option 3: Use Kubectl Apply

```bash
# Apply just the new HealthCheckPolicy (already done)
kubectl apply -f k8s/gateway/05-healthcheck-policy-iap.yaml
kubectl apply -f k8s/overlays/dev/healthcheck-policy.yaml

# Then deploy with kustomize
kubectl apply -k k8s/overlays/prod
kubectl apply -k k8s/overlays/dev
```

## ⏱️ Expected Timeline

| Step | Duration | What Happens |
|------|----------|--------------|
| Build agent-webapp | 2-3 min | Docker builds image with new nginx.conf |
| Push to registry | 1-2 min | Image uploaded to Artifact Registry |
| Deploy to cluster | 1-2 min | Kubernetes applies manifests |
| Pods restart | 1-2 min | New pods with /health endpoint start |
| Health checks start passing | 2-5 min | Backend becomes HEALTHY |
| IAP authentication works | Immediate | Users can login! |
| **Total** | **10-15 min** | |

## 🧪 Verification Steps

### Step 1: Check Build & Deployment

```bash
# Watch deployment progress
kubectl rollout status deployment/agent-webapp -n mcp-agent-prod

# Check pods are running
kubectl get pods -n mcp-agent-prod -l service=agent-webapp
```

### Step 2: Test /health Endpoint

```bash
# Port forward to agent-webapp
kubectl port-forward -n mcp-agent-prod deployment/agent-webapp 8080:80 &

# Test health endpoint
curl http://localhost:8080/health
# Expected: "healthy"

# Kill port-forward
kill %1
```

### Step 3: Check Backend Health

```bash
# Wait 2-5 minutes, then check backend health
gcloud compute backend-services get-health \
  gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
  --global

# Expected output:
# healthState: HEALTHY
```

### Step 4: Test IAP Authentication

1. Open **incognito browser** window
2. Go to: `https://www.platform-engineering-demo.dev`
3. **Expected**: Redirect to `accounts.google.com`
4. Login with `@datadoghq.com` email
5. **Expected**: Redirect back to application
6. Application loads successfully! ✅

### Step 5: Verify IAP Headers

```bash
# Enable debug logging
kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-prod

# Check logs
kubectl logs -n mcp-agent-prod deployment/agent-api -f | grep "IAP User"

# Expected:
# IAP User: { email: 'user@datadoghq.com', userId: '...' }

# Disable debug logging after verification
kubectl set env deployment/agent-api LOG_IAP_HEADERS=false -n mcp-agent-prod
```

### Step 6: Check Datadog APM

Go to [Datadog APM](https://app.datadoghq.com/apm/traces) and search:
```
service:agent-api iap.user.email:*
```

Should see traces with:
- `iap.user.email`
- `iap.user.id`
- `usr.email`
- `usr.id`

## 📋 Complete Checklist

### Configuration Files ✅
- [x] nginx.conf updated with `/health` endpoint
- [x] HealthCheckPolicy created for prod
- [x] HealthCheckPolicy created for dev
- [x] Kustomization updated for prod
- [x] Kustomization updated for dev
- [x] OAuth redirect URIs configured
- [x] GCPBackendPolicy applied
- [x] IAM permissions configured

### Deployment Tasks ⏳
- [ ] Run `make deploy ENV=prod`
- [ ] Wait for rollout to complete
- [ ] Verify /health endpoint responds
- [ ] Wait for backend to become HEALTHY
- [ ] Test IAP authentication in browser
- [ ] Verify IAP headers in logs
- [ ] Check Datadog APM traces

## 🎯 What This Fixes

### Before
```
User Request → IAP → 302 redirect → ERR_TOO_MANY_REDIRECTS ❌
Health Check → IAP → 302 redirect → UNHEALTHY ❌
```

### After
```
Health Check → nginx /health → 200 OK → HEALTHY ✅
User Request → IAP → OAuth → Login → Success ✅
```

## 🔍 Troubleshooting

### If deployment fails

```bash
# Check deployment events
kubectl describe deployment agent-webapp -n mcp-agent-prod

# Check pod logs
kubectl logs -n mcp-agent-prod -l service=agent-webapp --tail=50
```

### If health check still fails

```bash
# Check HealthCheckPolicy status
kubectl describe healthcheckpolicy agent-webapp-health-check -n mcp-agent-prod

# Test health endpoint locally
kubectl exec -it -n mcp-agent-prod deployment/agent-webapp -- curl localhost/health
```

### If backend still unhealthy

```bash
# Force check backend health
gcloud compute backend-services get-health \
  gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
  --global

# Check health check configuration
gcloud compute health-checks describe \
  gkegw1-yi3w-mcp-agent-prod-agent-webapp-80-4fdj4jjm3trk \
  --global
```

## 📝 Summary

Everything is configured and ready to deploy:

1. ✅ nginx has `/health` endpoint
2. ✅ HealthCheckPolicy configured
3. ✅ OAuth redirect URIs configured
4. ✅ GCPBackendPolicy applied
5. ✅ IAM permissions configured
6. ⏳ Need to deploy agent-webapp

**Just run**: `make deploy ENV=prod`

**Result**: IAP authentication will work! 🎉

## 🔗 Related Documentation

- [IAP_HEALTH_CHECK_FIX.md](IAP_HEALTH_CHECK_FIX.md) - Detailed explanation
- [IAP_REDIRECT_LOOP_TROUBLESHOOTING.md](IAP_REDIRECT_LOOP_TROUBLESHOOTING.md) - OAuth issues
- [IAP_QUICK_FIX.md](IAP_QUICK_FIX.md) - Quick reference
- [IAP_TEST_RESULTS.md](IAP_TEST_RESULTS.md) - Test results

---

**Ready to deploy?** Run `make deploy ENV=prod` now! 🚀
