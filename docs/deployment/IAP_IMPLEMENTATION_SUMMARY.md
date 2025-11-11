# Identity-Aware Proxy (IAP) Implementation Summary

## Overview

This document summarizes the implementation of Google Cloud Identity-Aware Proxy (IAP) for user authentication on the MCP Agent Platform, specifically for `www.platform-engineering-demo.dev`.

## Implementation Status

✅ **All components implemented and ready for deployment**

## What Was Implemented

### 1. Kubernetes Configuration

#### GCPBackendPolicy Resource
- **File**: [k8s/gateway/04-backendpolicy-iap.yaml](k8s/gateway/04-backendpolicy-iap.yaml)
- Configures IAP for the `agent-webapp` service
- References OAuth 2.0 credentials from Kubernetes secret
- Client ID: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`

#### IAP Environment Variables Patch
- **File**: [k8s/overlays/prod/patches/agent-api-iap.yaml](k8s/overlays/prod/patches/agent-api-iap.yaml)
- Enables IAP authentication in agent-api
- Configures Datadog to capture IAP headers
- Sets proper client IP header for GCP ALB (`X-Forwarded-For`)

#### Kustomization Updates
- **File**: [k8s/overlays/prod/kustomization.yaml](k8s/overlays/prod/kustomization.yaml)
- Added BackendPolicy to resources
- Added IAP patch to patches list

### 2. Application Code

#### IAP Authentication Middleware
- **File**: [packages/agent-api/src/middleware/iap-auth.ts](packages/agent-api/src/middleware/iap-auth.ts)
- Extracts IAP user information from headers
- Provides middleware functions:
  - `extractIAPUser()` - Non-blocking user extraction
  - `requireIAPAuth()` - Enforces authentication
  - `requireIAPDomain()` - Domain-based authorization
  - `getIAPUser()` - Utility to get user from request
  - `isIAPEnabled()` - Check if IAP is enabled

#### Express Server Integration
- **File**: [packages/agent-api/src/express-server.ts](packages/agent-api/src/express-server.ts)
- Conditionally enables IAP middleware based on `ENABLE_IAP` env var
- Integrates IAP user with existing authentication flow
- Prioritizes IAP authentication over anonymous mode
- Adds Datadog APM tags for user tracking

### 3. Documentation

#### Comprehensive Setup Guide
- **File**: [docs/deployment/IAP_SETUP.md](docs/deployment/IAP_SETUP.md)
- Complete step-by-step setup instructions
- OAuth 2.0 configuration guide
- Kubernetes secret management
- IAM permission configuration
- Application code updates
- Datadog monitoring setup
- Troubleshooting guide
- Security considerations

#### Quick Start Guide
- **File**: [docs/deployment/IAP_QUICK_START.md](docs/deployment/IAP_QUICK_START.md)
- Condensed setup instructions
- Manual and automated setup options
- Verification steps
- Common issues and solutions

### 4. Automation Scripts

#### IAP Setup Script
- **File**: [k8s/scripts/setup-iap.sh](k8s/scripts/setup-iap.sh)
- Automated setup wizard
- Checks prerequisites
- Creates Kubernetes secrets
- Updates BackendPolicy with Client ID
- Configures IAM permissions
- Provides deployment instructions

## Architecture

```
User Request
    ↓
Google Cloud IAP
  ├─ OAuth 2.0 Authentication
  └─ Authorization Check (IAM)
    ↓
Gateway API (GCP ALB)
  ├─ HTTPRoute (Routing)
  └─ GCPBackendPolicy (IAP Config)
    ↓
agent-webapp Service
  ├─ Headers Injected:
  │   ├─ X-Goog-Authenticated-User-Email
  │   ├─ X-Goog-Authenticated-User-Id
  │   ├─ X-Goog-IAP-JWT-Assertion
  │   └─ X-Forwarded-For (Client IP)
  └─ Proxies to agent-api
    ↓
agent-api Service
  ├─ IAP Middleware (iap-auth.ts)
  │   ├─ Extract user email
  │   ├─ Extract user ID
  │   └─ Add Datadog tags
  └─ User Context
      ├─ Use IAP email as userId
      └─ Store in PostgreSQL
```

## Datadog Integration

### APM Trace Tags

The following custom tags are added to traces for authenticated users:

- `iap.user.email` - User's email address
- `iap.user.id` - User's unique ID
- `usr.email` - Datadog standard user email tag
- `usr.id` - Datadog standard user ID tag

### Environment Variables

Configured in agent-api deployment:

```yaml
ENABLE_IAP: "true"
LOG_IAP_HEADERS: "false"
DD_TRACE_CLIENT_IP_HEADER: "X-Forwarded-For"
DD_TRACE_HEADER_TAGS: "X-Goog-Authenticated-User-Email:iap.user.email,X-Goog-Authenticated-User-Id:iap.user.id"
```

## Deployment Steps

### Prerequisites

1. OAuth 2.0 credentials created in Google Cloud Console
2. Client ID: `449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com`
3. Client Secret: (stored securely, not in repository)

### Automated Deployment

```bash
# 1. Run the IAP setup script
./k8s/scripts/setup-iap.sh

# 2. Deploy to production
make deploy ENV=prod

# 3. Grant user access
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=user:email@example.com \
  --role=roles/iap.httpsResourceAccessor
```

### Manual Deployment

```bash
# 1. Create Kubernetes secret
kubectl create secret generic oauth-client-secret \
  --from-literal=client_id=YOUR_CLIENT_ID \
  --from-literal=client_secret=YOUR_CLIENT_SECRET \
  -n mcp-agent-prod

# 2. Verify BackendPolicy has correct Client ID
cat k8s/gateway/04-backendpolicy-iap.yaml

# 3. Deploy
make deploy ENV=prod

# 4. Configure IAM permissions (see docs)
```

## Files Modified/Created

### Configuration Files
- ✅ `k8s/gateway/04-backendpolicy-iap.yaml` (new)
- ✅ `k8s/overlays/prod/patches/agent-api-iap.yaml` (new)
- ✅ `k8s/overlays/prod/kustomization.yaml` (modified)

### Application Code
- ✅ `packages/agent-api/src/middleware/iap-auth.ts` (new)
- ✅ `packages/agent-api/src/express-server.ts` (modified)

### Documentation
- ✅ `docs/deployment/IAP_SETUP.md` (new)
- ✅ `docs/deployment/IAP_QUICK_START.md` (new)

### Scripts
- ✅ `k8s/scripts/setup-iap.sh` (new)

## Testing Checklist

### Pre-Deployment Testing

- [ ] Run TypeScript compilation: `cd packages/agent-api && npm run build`
- [ ] Verify no linting errors: `cd packages/agent-api && npm run lint`
- [ ] Test Kustomize build: `kubectl kustomize k8s/overlays/prod`
- [ ] Validate BackendPolicy: `kubectl apply --dry-run=client -f k8s/gateway/04-backendpolicy-iap.yaml`

### Post-Deployment Testing

- [ ] Verify BackendPolicy applied: `kubectl get gcpbackendpolicy -n mcp-agent-prod`
- [ ] Check agent-api deployment has IAP env vars: `kubectl describe deployment agent-api -n mcp-agent-prod`
- [ ] Test authentication flow: Visit `https://www.platform-engineering-demo.dev`
- [ ] Verify IAP headers in logs: `kubectl logs -n mcp-agent-prod deployment/agent-api | grep "IAP User"`
- [ ] Check Datadog traces for IAP tags: Search for `iap.user.email` tag in APM
- [ ] Test with authorized user: Should see application
- [ ] Test with unauthorized user: Should see 403 Forbidden

## Security Considerations

### Implemented Security Features

1. **Authentication**: OAuth 2.0 via Google Cloud IAP
2. **Authorization**: IAM-based access control
3. **User Context**: IAP user email propagated through application
4. **Audit Logging**: Datadog APM tracks all authenticated requests
5. **Secure Secrets**: OAuth credentials stored in Kubernetes secrets

### Recommended Additional Security

1. **JWT Verification**: Implement JWT signature validation (see docs)
2. **Domain Restrictions**: Use `requireIAPDomain()` middleware to restrict by email domain
3. **Audit Logs**: Enable Cloud Audit Logs for IAP access
4. **Secret Rotation**: Regularly rotate OAuth credentials
5. **Network Policies**: Restrict backend service access to Gateway only

## Monitoring

### Datadog Dashboards

Recommended metrics to monitor:

1. **Authentication Success Rate**: `sum:trace.express.request{iap.user.email:*}.as_count()`
2. **Unique Users**: `count_nonzero(count:trace.express.request{*} by {iap.user.email})`
3. **User Activity**: `sum:trace.express.request{*} by {iap.user.email}.as_count()`
4. **Failed Authentications**: `sum:trace.http.request{http.status_code:401}.as_count()`

### Alerts

Recommended monitors:

1. **Missing IAP Headers**: Alert if IAP headers not present on requests
2. **High 401/403 Rates**: Alert on authentication/authorization failures
3. **Unusual User Activity**: Alert on access from unexpected users/domains

## Rollback Plan

If issues occur:

```bash
# 1. Disable IAP by removing BackendPolicy
kubectl delete gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# 2. Remove IAP env vars (optional)
kubectl set env deployment/agent-api ENABLE_IAP=false -n mcp-agent-prod

# 3. Wait for Gateway to update (5-10 minutes)
```

## Next Steps

### Immediate (Post-Deployment)

1. Test IAP authentication with your Google account
2. Grant access to team members
3. Monitor Datadog APM for IAP tags
4. Verify user context flows through to database

### Short-Term (1-2 weeks)

1. Implement JWT verification for enhanced security
2. Add domain-based authorization rules
3. Create Datadog dashboards for user activity
4. Set up alerts for authentication failures

### Long-Term (1-3 months)

1. Extend IAP to other services (burger-webapp, API endpoints)
2. Implement advanced authorization logic (roles, permissions)
3. Configure custom session duration
4. Enable Cloud Audit Logs integration

## Support

For issues or questions:

1. **Documentation**: [docs/deployment/IAP_SETUP.md](docs/deployment/IAP_SETUP.md)
2. **Troubleshooting**: Check "Troubleshooting" section in docs
3. **Google Cloud IAP**: https://cloud.google.com/iap/docs
4. **Datadog Support**: https://docs.datadoghq.com

## Summary

✅ **Implementation Complete**

IAP has been fully implemented for `www.platform-engineering-demo.dev` with:
- GCPBackendPolicy configured with your OAuth Client ID
- IAP middleware integrated into agent-api
- Comprehensive documentation and automation scripts
- Datadog APM integration for user tracking
- Ready for deployment to production

**To deploy**: Run `./k8s/scripts/setup-iap.sh` and follow the prompts, then `make deploy ENV=prod`.
