# IAP Deployment Checklist

Use this checklist to ensure a successful IAP deployment for `www.platform-engineering-demo.dev`.

## Pre-Deployment Checklist

### ☐ 1. OAuth 2.0 Credentials

- [ ] OAuth Consent Screen configured in Google Cloud Console
- [ ] OAuth Client ID created (Web application type)
- [ ] Client ID saved: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
- [ ] Client Secret saved securely (NOT in git)
- [ ] Authorized redirect URI configured (if needed)

### ☐ 2. Code Review

- [ ] Review [packages/agent-api/src/middleware/iap-auth.ts](packages/agent-api/src/middleware/iap-auth.ts)
- [ ] Review [packages/agent-api/src/express-server.ts](packages/agent-api/src/express-server.ts) changes
- [ ] Verify no TypeScript errors: `cd packages/agent-api && npm run build`
- [ ] Run linter: `cd packages/agent-api && npm run lint`

### ☐ 3. Kubernetes Configuration Review

- [ ] Review [k8s/gateway/04-backendpolicy-iap.yaml](k8s/gateway/04-backendpolicy-iap.yaml)
- [ ] Verify Client ID is correct in BackendPolicy
- [ ] Review [k8s/overlays/prod/patches/agent-api-iap.yaml](k8s/overlays/prod/patches/agent-api-iap.yaml)
- [ ] Verify [k8s/overlays/prod/kustomization.yaml](k8s/overlays/prod/kustomization.yaml) includes IAP resources
- [ ] Test Kustomize build: `kubectl kustomize k8s/overlays/prod`

### ☐ 4. Prerequisites Verification

- [ ] gcloud CLI installed: `gcloud version`
- [ ] kubectl configured: `kubectl get nodes`
- [ ] Access to namespace: `kubectl get ns mcp-agent-prod`
- [ ] IAP API enabled: `gcloud services list --enabled | grep iap`

## Deployment Steps

### ☐ 5. Create Kubernetes Secret

```bash
# Option A: Using setup script (recommended)
./k8s/scripts/setup-iap.sh

# Option B: Manual creation
kubectl create secret generic oauth-client-secret \
  --from-literal=client_id=449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com \
  --from-literal=client_secret=YOUR_CLIENT_SECRET \
  -n mcp-agent-prod
```

- [ ] Secret created successfully
- [ ] Verify secret: `kubectl get secret oauth-client-secret -n mcp-agent-prod`

### ☐ 6. Deploy Configuration

```bash
# Deploy to production
make deploy ENV=prod
```

- [ ] Deployment started without errors
- [ ] Wait for rollout: `kubectl rollout status deployment/agent-api -n mcp-agent-prod`
- [ ] Wait for rollout: `kubectl rollout status deployment/agent-webapp -n mcp-agent-prod`

### ☐ 7. Verify Kubernetes Resources

```bash
# Check BackendPolicy
kubectl get gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Check BackendPolicy status
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Check agent-api deployment
kubectl get deployment agent-api -n mcp-agent-prod -o yaml | grep -A 10 "env:"
```

- [ ] BackendPolicy created
- [ ] BackendPolicy status shows no errors
- [ ] agent-api has `ENABLE_IAP=true` environment variable
- [ ] agent-api has `DD_TRACE_CLIENT_IP_HEADER` environment variable

### ☐ 8. Wait for Gateway Update

The Gateway API load balancer takes 5-10 minutes to fully propagate IAP configuration.

```bash
# Check Gateway status
kubectl get gateway shared-gateway -n shared-infra -o yaml

# List backend services (to find the name for IAM)
gcloud compute backend-services list
```

- [ ] Gateway shows no errors
- [ ] Backend service name noted: `_______________________`

### ☐ 9. Configure IAM Permissions

Grant IAP access to authorized users:

```bash
# For a specific user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=user:YOUR_EMAIL@example.com \
  --role=roles/iap.httpsResourceAccessor

# For all users in your domain
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=domain:yourdomain.com \
  --role=roles/iap.httpsResourceAccessor
```

- [ ] IAM permissions granted
- [ ] Verify permissions: `gcloud iap web get-iam-policy --resource-type=backend-services --service=BACKEND_SERVICE_NAME`

## Post-Deployment Testing

### ☐ 10. Authentication Flow Test

**Test 1: Unauthenticated Access**
- [ ] Open incognito/private browser window
- [ ] Navigate to: `https://www.platform-engineering-demo.dev`
- [ ] Expected: Redirect to Google OAuth login
- [ ] If not redirecting, wait 5 more minutes for Gateway to update

**Test 2: Authenticated Access**
- [ ] Login with authorized Google account
- [ ] Expected: Redirect back to application
- [ ] Application loads successfully
- [ ] No console errors in browser

**Test 3: Unauthorized Access (Optional)**
- [ ] Login with non-authorized account (if possible)
- [ ] Expected: "403 Forbidden" error
- [ ] If not showing 403, IAM permissions not configured

### ☐ 11. Verify IAP Headers

Enable debug logging:

```bash
kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-prod
```

Check logs:

```bash
kubectl logs -n mcp-agent-prod deployment/agent-api -f | grep "IAP User"
```

- [ ] Logs show IAP user information
- [ ] Email address matches logged-in user
- [ ] User ID is present

Disable debug logging after testing:

```bash
kubectl set env deployment/agent-api LOG_IAP_HEADERS=false -n mcp-agent-prod
```

### ☐ 12. Datadog APM Verification

Visit [Datadog APM Traces](https://app.datadoghq.com/apm/traces):

1. Search for service: `agent-api`
2. Open a recent trace
3. Check for custom tags:

- [ ] `iap.user.email` tag present
- [ ] `iap.user.id` tag present
- [ ] `usr.email` tag present (Datadog standard)
- [ ] `usr.id` tag present (Datadog standard)
- [ ] Tags show correct user information

### ☐ 13. User Context Verification

Test user context flow:

```bash
# Connect to PostgreSQL
kubectl port-forward -n mcp-agent-prod svc/postgres 5432:5432 &

# Query users table
psql -h localhost -U burgeruser -d burgerdb -c "SELECT id, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
```

- [ ] User ID created based on IAP email
- [ ] User sessions stored correctly
- [ ] Chat history linked to user

### ☐ 14. End-to-End Test

1. Login to the application
2. Start a chat conversation
3. Place a burger order
4. View order history

- [ ] All features work as expected
- [ ] User context maintained throughout
- [ ] No authentication errors
- [ ] Datadog traces show user email on all requests

## Monitoring Setup

### ☐ 15. Create Datadog Dashboard

Create a dashboard to monitor IAP authentication:

- [ ] Widget: Authenticated Requests Count
  - Metric: `sum:trace.express.request{iap.user.email:*}.as_count()`
- [ ] Widget: Unique Users
  - Metric: `count_nonzero(count:trace.express.request{*} by {iap.user.email})`
- [ ] Widget: Top Users by Request Count
  - Metric: `sum:trace.express.request{*} by {iap.user.email}.as_count()`
- [ ] Widget: Authentication Errors
  - Metric: `sum:trace.http.request{http.status_code:401 OR http.status_code:403}.as_count()`

### ☐ 16. Create Datadog Monitors

Set up alerts:

- [ ] Monitor: Missing IAP Headers
  - Alert when: `avg(last_5m):sum:trace.express.request{service:agent-api,!iap.user.email:*} > 10`
- [ ] Monitor: High Authentication Failure Rate
  - Alert when: `avg(last_5m):sum:trace.http.request{http.status_code:401 OR http.status_code:403}.as_count() > 20`

## Documentation

### ☐ 17. Update Team Documentation

- [ ] Share [IAP_IMPLEMENTATION_SUMMARY.md](IAP_IMPLEMENTATION_SUMMARY.md) with team
- [ ] Add IAP credentials to team password manager
- [ ] Document backend service name for future IAM changes
- [ ] Update runbooks with IAP troubleshooting steps

### ☐ 18. Security Review

- [ ] OAuth credentials stored securely (not in git)
- [ ] Kubernetes secret not committed to repository
- [ ] IAM permissions reviewed and approved
- [ ] Only authorized users have access
- [ ] Cloud Audit Logs enabled (optional but recommended)

## Rollback Plan (If Needed)

If issues occur, follow these steps to rollback:

```bash
# 1. Delete BackendPolicy
kubectl delete gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# 2. Disable IAP in agent-api (optional)
kubectl set env deployment/agent-api ENABLE_IAP=false -n mcp-agent-prod

# 3. Wait for Gateway to update (5-10 minutes)
kubectl get gateway shared-gateway -n shared-infra -o yaml

# 4. Verify application works without IAP
curl -I https://www.platform-engineering-demo.dev
```

- [ ] Rollback procedure documented
- [ ] Team knows who to contact for rollback

## Sign-Off

### Deployment Completed By

- **Name**: ___________________________
- **Date**: ___________________________
- **Time**: ___________________________

### Verification Completed By

- **Name**: ___________________________
- **Date**: ___________________________
- **Time**: ___________________________

### Production Approval

- **Name**: ___________________________
- **Date**: ___________________________
- **Time**: ___________________________

## Notes

_Add any notes, issues encountered, or observations during deployment:_

```
[Your notes here]
```

## Next Steps

After successful deployment:

1. [ ] Monitor authentication metrics for 24 hours
2. [ ] Review Datadog traces for any anomalies
3. [ ] Gather user feedback on login experience
4. [ ] Plan JWT verification implementation
5. [ ] Consider extending IAP to other services
6. [ ] Schedule security review

## Resources

- **Detailed Setup Guide**: [docs/deployment/IAP_SETUP.md](docs/deployment/IAP_SETUP.md)
- **Quick Start Guide**: [docs/deployment/IAP_QUICK_START.md](docs/deployment/IAP_QUICK_START.md)
- **Architecture Diagram**: [docs/images/IAP_ARCHITECTURE.md](docs/images/IAP_ARCHITECTURE.md)
- **Implementation Summary**: [IAP_IMPLEMENTATION_SUMMARY.md](IAP_IMPLEMENTATION_SUMMARY.md)
- **Google Cloud IAP Docs**: https://cloud.google.com/iap/docs
- **Datadog APM**: https://app.datadoghq.com/apm
