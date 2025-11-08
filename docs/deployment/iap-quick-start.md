# IAP Quick Start Guide

This is a condensed guide for enabling Identity-Aware Proxy (IAP) on your GKE Gateway API deployment. For detailed information, see [iap-setup.md](iap-setup.md).

## Prerequisites

- GKE cluster with Gateway API enabled
- Domain with SSL configured: `www.platform-engineering-demo.dev`
- gcloud CLI and kubectl installed

## Quick Setup (5 Steps)

### 1. Enable IAP API

```bash
gcloud services enable iap.googleapis.com --project=YOUR_PROJECT_ID
```

### 2. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Create Credentials → OAuth client ID → Web application
3. Name: `iap-agent-webapp-prod`
4. Save the **Client ID** and **Client Secret**

### 3. Run Setup Script

```bash
# Navigate to the repository root
cd /path/to/mcp-agent-langchainjs-datadog

# Run the IAP setup script
./k8s/scripts/setup-iap.sh
```

The script will:
- Create Kubernetes secret with OAuth credentials
- Update BackendPolicy with your Client ID
- Apply the configuration to your cluster
- Help you configure IAM permissions

### 4. Deploy to Production

```bash
make deploy ENV=prod
```

### 5. Grant User Access

Find your backend service name:

```bash
gcloud compute backend-services list
```

Grant access to users:

```bash
# For a specific user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=user:email@example.com \
  --role=roles/iap.httpsResourceAccessor

# For all users in your domain
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=domain:yourdomain.com \
  --role=roles/iap.httpsResourceAccessor
```

## Manual Setup (Without Script)

If you prefer manual setup:

### Create Kubernetes Secret

**Important**: The secret must have exactly **1 key** named `key` containing **only the client secret**. The client ID goes in the GCPBackendPolicy YAML.

```bash
# Only include the client secret, NOT the client ID
kubectl create secret generic oauth-client-secret \
  --from-literal=key=YOUR_CLIENT_SECRET \
  -n mcp-agent-prod
```

### Update BackendPolicy

Edit `k8s/gateway/04-backendpolicy-iap.yaml`:

```yaml
spec:
  default:
    iap:
      enabled: true
      oauth2ClientSecret:
        name: oauth-client-secret
      clientID: YOUR_CLIENT_ID  # Replace with actual Client ID
```

### Apply Configuration

```bash
kubectl apply -f k8s/gateway/04-backendpolicy-iap.yaml
```

## Verification

### Test Authentication

1. Clear browser cache and cookies
2. Navigate to: `https://www.platform-engineering-demo.dev`
3. You should see Google OAuth login
4. After login, the application should load

### Check IAP Headers in Logs

Enable header logging temporarily:

```bash
kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-prod
```

Check logs for IAP headers:

```bash
kubectl logs -n mcp-agent-prod deployment/agent-api -f | grep "IAP User"
```

### Verify in Datadog

1. Go to [Datadog APM](https://app.datadoghq.com/apm/traces)
2. Search for traces from `agent-api` service
3. Look for custom tags:
   - `iap.user.email`
   - `iap.user.id`
   - `usr.email`
   - `usr.id`

## Configuration Files

### Key Files Created/Modified

1. **[k8s/gateway/04-backendpolicy-iap.yaml](../../k8s/gateway/04-backendpolicy-iap.yaml)** - GCPBackendPolicy for IAP
2. **[packages/agent-api/src/middleware/iap-auth.ts](../../packages/agent-api/src/middleware/iap-auth.ts)** - IAP middleware
3. **[k8s/overlays/prod/patches/agent-api-iap.yaml](../../k8s/overlays/prod/patches/agent-api-iap.yaml)** - Environment variables
4. **[k8s/scripts/setup-iap.sh](../../k8s/scripts/setup-iap.sh)** - Automated setup script

### Environment Variables

The following environment variables are configured for agent-api:

- `ENABLE_IAP=true` - Enable IAP authentication
- `LOG_IAP_HEADERS=false` - Enable debug logging (set to `true` for troubleshooting)
- `DD_TRACE_CLIENT_IP_HEADER=X-Forwarded-For` - Capture client IP from ALB
- `DD_TRACE_HEADER_TAGS` - Propagate IAP headers to Datadog traces

## Common Issues

### "Error: invalid_client"

**Cause**: OAuth credentials mismatch

**Solution**: Verify secret values match OAuth credentials

```bash
kubectl get secret oauth-client-secret -n mcp-agent-prod -o yaml
kubectl get secret oauth-client-secret -n mcp-agent-prod -o jsonpath='{.data.client_id}' | base64 -d
```

### "403 Forbidden" After Login

**Cause**: User doesn't have IAP access

**Solution**: Grant IAP role to the user

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=user:email@example.com \
  --role=roles/iap.httpsResourceAccessor
```

### Headers Not Present in Application

**Cause**: IAP not properly configured

**Solution**: Check BackendPolicy status

```bash
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod
```

## Disable IAP

To temporarily disable IAP without deleting the configuration:

```bash
# Delete the BackendPolicy
kubectl delete gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Or set enabled to false
kubectl patch gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod \
  --type=merge -p '{"spec":{"default":{"iap":{"enabled":false}}}}'
```

## Resources

- **Detailed Guide**: [iap-setup.md](iap-setup.md)
- **Google Cloud IAP Docs**: https://cloud.google.com/iap/docs
- **GKE Gateway API**: https://cloud.google.com/kubernetes-engine/docs/how-to/configure-gateway-resources
- **Datadog IAP Monitoring**: https://docs.datadoghq.com/security/application_security/

## Architecture

```
User Request
    ↓
Google Cloud IAP (Authentication)
    ↓
Gateway API (L7 Load Balancer)
    ↓
HTTPRoute (Routing Rules)
    ↓
agent-webapp Service (Backend)
    ↓
Headers Injected:
  - X-Goog-Authenticated-User-Email
  - X-Goog-Authenticated-User-Id
  - X-Goog-IAP-JWT-Assertion
  - X-Forwarded-For (Client IP)
```

## Next Steps

After enabling IAP:

1. **Monitor User Activity**: Set up Datadog dashboards to track authenticated users
2. **Implement Authorization**: Add domain or role-based access control in your application
3. **Enable Session Duration**: Configure custom session timeouts
4. **Set Up Audit Logging**: Enable Cloud Audit Logs for IAP access
5. **Test Error Scenarios**: Verify proper handling of authentication failures

For detailed implementation, see the [full IAP setup guide](iap-setup.md).
