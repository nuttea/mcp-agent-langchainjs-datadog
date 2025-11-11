# Enabling Identity-Aware Proxy (IAP) for GKE Gateway API

This guide walks you through enabling Google Cloud Identity-Aware Proxy (IAP) for your GKE services exposed via Gateway API, specifically for `www.platform-engineering-demo.dev`.

## Overview

Identity-Aware Proxy (IAP) provides enterprise-level authentication and authorization for applications accessed via HTTPS. IAP verifies user identity and uses context to determine if a user should be allowed to access an application.

## Architecture

```
User → IAP Authentication → Gateway API → HTTPRoute → Backend Service (agent-webapp)
                                                            ↓
                                                    Application receives:
                                                    - X-Goog-Authenticated-User-Email
                                                    - X-Goog-Authenticated-User-Id
                                                    - X-Goog-IAP-JWT-Assertion
```

## Prerequisites

1. GKE cluster with Gateway API enabled
2. A registered domain with SSL certificate configured
3. Google Cloud project with IAP API enabled
4. Access to Google Cloud Console with appropriate permissions

## Step 1: Enable IAP API

```bash
# Enable IAP API for your project
gcloud services enable iap.googleapis.com --project=YOUR_PROJECT_ID
```

## Step 2: Create OAuth 2.0 Credentials

### 2.1 Configure OAuth Consent Screen

1. Go to [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Select **Internal** (for Google Workspace users) or **External**
3. Fill in the required fields:
   - App name: `MCP Agent Platform`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes (optional): `openid`, `email`, `profile`
5. Click **Save and Continue**

### 2.2 Create OAuth Client ID

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Name: `iap-agent-webapp-prod`
5. **Authorized redirect URIs**: Add:
   ```
   https://iap.googleapis.com/v1/oauth/clientIds/YOUR_CLIENT_ID:handleRedirect
   ```
   Note: You'll update this after getting the client ID
6. Click **Create**
7. **Save the Client ID and Client Secret** - you'll need these

### 2.3 Download Credentials

```bash
# After creating, download the JSON file or note down:
# - Client ID: 123456789-abcdefg.apps.googleusercontent.com
# - Client Secret: GOCSPX-xxx...
```

## Step 3: Create Kubernetes Secret

Create a Kubernetes secret with the OAuth **client secret only** (not the client ID). The Client ID is specified in the GCPBackendPolicy YAML.

**Important**: The secret must contain exactly **1 key-value pair** with the key named `key`. This is a GCP IAP requirement.

```bash
# Create the secret in the mcp-agent-prod namespace
# ONLY include the client secret, NOT the client ID
kubectl create secret generic oauth-client-secret \
  --from-literal=key=YOUR_CLIENT_SECRET \
  -n mcp-agent-prod

# Verify the secret has exactly 1 key named 'key'
kubectl get secret oauth-client-secret -n mcp-agent-prod -o yaml
```

Or create from a file:

```bash
# Method 1: Create from literal file
echo -n "YOUR_CLIENT_SECRET" > iap-secret.txt
kubectl create secret generic oauth-client-secret \
  --from-file=key=iap-secret.txt \
  -n mcp-agent-prod
rm iap-secret.txt

# Method 2: Create from YAML
cat <<EOF > oauth-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: oauth-client-secret
  namespace: mcp-agent-prod
type: Opaque
stringData:
  key: "YOUR_CLIENT_SECRET"
EOF

# Apply it
kubectl apply -f oauth-secret.yaml

# Remove the file (don't commit it!)
rm oauth-secret.yaml
```

## Step 4: Create GCPBackendPolicy

Create a `GCPBackendPolicy` resource to enable IAP for the agent-webapp service:

**File**: `k8s/gateway/04-backendpolicy-iap.yaml`

```yaml
---
# GCPBackendPolicy for IAP - Agent Webapp
apiVersion: networking.gke.io/v1
kind: GCPBackendPolicy
metadata:
  name: agent-webapp-iap-policy
  namespace: mcp-agent-prod
spec:
  default:
    iap:
      enabled: true
      oauth2ClientSecret:
        name: oauth-client-secret
      clientID: YOUR_CLIENT_ID  # Replace with actual Client ID
  targetRef:
    group: ""
    kind: Service
    name: agent-webapp
```

**Important**: Replace `YOUR_CLIENT_ID` with your actual OAuth 2.0 Client ID.

## Step 5: Apply the Configuration

```bash
# Apply the BackendPolicy
kubectl apply -f k8s/gateway/04-backendpolicy-iap.yaml

# Verify the policy
kubectl get gcpbackendpolicy -n mcp-agent-prod
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod
```

## Step 6: Configure IAM Permissions

Grant IAP access to specific users or groups:

### Option A: Via gcloud CLI

```bash
# Grant access to a specific user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member=user:email@example.com \
  --role=roles/iap.httpsResourceAccessor

# Grant access to a group
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member=group:team@example.com \
  --role=roles/iap.httpsResourceAccessor

# Grant access to all authenticated users in your organization
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE_NAME \
  --member=domain:yourdomain.com \
  --role=roles/iap.httpsResourceAccessor
```

### Option B: Via Cloud Console

1. Go to [Identity-Aware Proxy](https://console.cloud.google.com/security/iap)
2. Find your backend service (agent-webapp)
3. Click the checkbox next to it
4. Click **Add Principal** in the right panel
5. Add users/groups with the role `IAP-secured Web App User`
6. Click **Save**

### Option C: Find Backend Service Name

```bash
# List all backend services to find the correct name
gcloud compute backend-services list

# Or use kubectl to find the service
kubectl get service agent-webapp -n mcp-agent-prod -o yaml
```

## Step 7: Update Application Code to Extract IAP Headers

IAP adds authentication headers to requests. Update your application to extract and use them.

### Headers Added by IAP

- `X-Goog-Authenticated-User-Email`: User's email address
- `X-Goog-Authenticated-User-Id`: User's unique ID
- `X-Goog-IAP-JWT-Assertion`: Signed JWT with user claims

### Example: Update agent-api

**File**: `packages/agent-api/src/middleware/iap-auth.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// IAP JWT issuer and audience
const IAP_ISSUER = 'https://cloud.google.com/iap';
const IAP_AUDIENCE = '/projects/PROJECT_NUMBER/global/backendServices/BACKEND_SERVICE_ID';

// JWKS client for verifying IAP JWT
const client = jwksClient({
  jwksUri: 'https://www.gstatic.com/iap/verify/public_key-jwk',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface IAPUser {
  email: string;
  userId: string;
  sub: string;
}

export function extractIAPHeaders(req: Request): IAPUser | null {
  // Extract headers
  const email = req.get('X-Goog-Authenticated-User-Email');
  const userId = req.get('X-Goog-Authenticated-User-Id');
  const jwtAssertion = req.get('X-Goog-IAP-JWT-Assertion');

  if (!email || !userId) {
    return null;
  }

  // Remove "accounts.google.com:" prefix from email
  const cleanEmail = email.replace(/^accounts\.google\.com:/, '');
  const cleanUserId = userId.replace(/^accounts\.google\.com:/, '');

  return {
    email: cleanEmail,
    userId: cleanUserId,
    sub: cleanUserId,
  };
}

export function verifyIAPToken(req: Request, res: Response, next: NextFunction) {
  const jwtAssertion = req.get('X-Goog-IAP-JWT-Assertion');

  if (!jwtAssertion) {
    res.status(401).json({ error: 'Missing IAP JWT assertion' });
    return;
  }

  // Verify JWT
  jwt.verify(
    jwtAssertion,
    getKey,
    {
      issuer: IAP_ISSUER,
      audience: IAP_AUDIENCE,
    },
    (err, decoded) => {
      if (err) {
        console.error('IAP JWT verification failed:', err);
        res.status(401).json({ error: 'Invalid IAP JWT' });
        return;
      }

      // Attach user info to request
      const user = extractIAPHeaders(req);
      if (user) {
        (req as any).iapUser = user;
      }

      next();
    }
  );
}

export function requireIAPAuth(req: Request, res: Response, next: NextFunction) {
  const user = extractIAPHeaders(req);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized - IAP authentication required' });
    return;
  }

  (req as any).iapUser = user;
  next();
}
```

### Update Express Server

**File**: `packages/agent-api/src/express-server.ts`

```typescript
import { requireIAPAuth, extractIAPHeaders } from './middleware/iap-auth.js';

// Add middleware conditionally based on environment
if (process.env.ENABLE_IAP === 'true') {
  app.use(requireIAPAuth);
  console.log('IAP authentication enabled');
}

// Update existing routes to use IAP user
app.post('/api/chat', async (req, res) => {
  const iapUser = (req as any).iapUser;

  // Use iapUser.email or iapUser.userId for user identification
  const userId = iapUser?.userId || req.body.userId;

  // ... rest of the code
});
```

## Step 8: Configure Datadog to Capture IAP Headers

Update your Datadog configuration to capture IAP authentication headers for observability.

### Update Deployment ConfigMap

**File**: `k8s/base/configmap.yaml`

Add to agent-api section:

```yaml
DD_TRACE_CLIENT_IP_HEADER: "X-Goog-Authenticated-User-Email"
DD_TRACE_HEADERS: "X-Goog-Authenticated-User-Email,X-Goog-Authenticated-User-Id"
```

### Update Datadog APM Tags

**File**: `packages/agent-api/src/express-server.ts`

```typescript
import tracer from 'dd-trace';

// Middleware to add IAP user to Datadog traces
app.use((req, res, next) => {
  const span = tracer.scope().active();
  if (span) {
    const iapUser = extractIAPHeaders(req);
    if (iapUser) {
      span.setTag('iap.user.email', iapUser.email);
      span.setTag('iap.user.id', iapUser.userId);
      span.setTag('usr.email', iapUser.email);
      span.setTag('usr.id', iapUser.userId);
    }
  }
  next();
});
```

## Step 9: Update Kustomization

Add the BackendPolicy to your kustomization file:

**File**: `k8s/overlays/prod/kustomization.yaml`

```yaml
resources:
  # ... existing resources
  - ../../gateway/04-backendpolicy-iap.yaml
```

## Step 10: Deploy and Verify

```bash
# Deploy the changes
make deploy ENV=prod

# Check the BackendPolicy status
kubectl get gcpbackendpolicy -n mcp-agent-prod
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Check the Gateway status
kubectl get gateway shared-gateway -n shared-infra -o yaml

# Check for IAP in the backend service
gcloud compute backend-services list --filter="name~agent-webapp"
gcloud compute backend-services describe BACKEND_SERVICE_NAME --global
```

## Step 11: Test IAP Authentication

1. **Clear browser cache and cookies** for your domain
2. Navigate to `https://www.platform-engineering-demo.dev`
3. You should be redirected to Google OAuth consent screen
4. Sign in with an authorized account
5. After successful authentication, you'll be redirected to your application
6. **Verify headers** in your application logs or Datadog APM traces

### Test with curl

```bash
# This should return 302 redirect to Google login
curl -I https://www.platform-engineering-demo.dev

# After logging in via browser, extract the cookie and test
curl https://www.platform-engineering-demo.dev \
  -H "Cookie: GCP_IAP_AUTH_TOKEN_xxx=..."
```

## Troubleshooting

### Common Issues

#### 1. "Error: invalid_client"

- **Cause**: OAuth client credentials mismatch
- **Solution**: Verify the client ID and secret in the Kubernetes secret match the OAuth credentials

```bash
# Check the secret
kubectl get secret oauth-client-secret -n mcp-agent-prod -o yaml

# Decode and verify
kubectl get secret oauth-client-secret -n mcp-agent-prod -o jsonpath='{.data.client_id}' | base64 -d
```

#### 2. "403 Forbidden" After Authentication

- **Cause**: User doesn't have IAP access
- **Solution**: Grant the user `roles/iap.httpsResourceAccessor` role

```bash
# Check current IAM bindings
gcloud iap web get-iam-policy \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME

# Add user
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=BACKEND_SERVICE_NAME \
  --member=user:email@example.com \
  --role=roles/iap.httpsResourceAccessor
```

#### 3. Headers Not Present in Application

- **Cause**: IAP not properly configured or backend service not using HTTPS
- **Solution**:
  - Verify GCPBackendPolicy is applied
  - Check backend service configuration
  - Ensure service is using HTTPS (required for IAP)

```bash
# Check BackendPolicy status
kubectl describe gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Check service
kubectl get service agent-webapp -n mcp-agent-prod -o yaml
```

#### 4. "Could not fetch URI" Error

- **Cause**: Backend service health check failing
- **Solution**: Configure proper health check endpoints

```bash
# Check backend service health
gcloud compute backend-services get-health BACKEND_SERVICE_NAME --global
```

### Debug Mode

Enable debug logging:

```bash
# Add to agent-api deployment
kubectl set env deployment/agent-api -n mcp-agent-prod \
  DEBUG=express:* \
  LOG_IAP_HEADERS=true
```

## Monitoring IAP with Datadog

### Key Metrics to Monitor

1. **Authentication Success Rate**: Track successful vs failed IAP authentications
2. **User Activity**: Monitor which users are accessing the application
3. **Header Presence**: Alert if IAP headers are missing
4. **JWT Verification Failures**: Track JWT validation errors

### Datadog Dashboard

Create a dashboard with:

```json
{
  "title": "IAP Authentication Monitoring",
  "widgets": [
    {
      "definition": {
        "title": "IAP Authenticated Requests",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.express.request{iap.user.email:*}.as_count()"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Unique Users (Last 24h)",
        "type": "query_value",
        "requests": [
          {
            "q": "count_nonzero(count:trace.express.request{iap.user.email:*} by {iap.user.email})"
          }
        ]
      }
    }
  ]
}
```

### Datadog Monitors

Create monitors for:

1. **Missing IAP Headers**:
   ```
   avg(last_5m):sum:trace.express.request{!iap.user.email:*} > 10
   ```

2. **JWT Verification Failures**:
   ```
   avg(last_5m):sum:trace.iap.jwt.verification.failure{*}.as_count() > 5
   ```

## Security Considerations

1. **JWT Verification**: Always verify the JWT assertion in your application
2. **Header Validation**: Don't trust headers without JWT verification
3. **Least Privilege**: Grant IAP access only to necessary users
4. **Audit Logging**: Enable Cloud Audit Logs for IAP access
5. **Secret Management**: Rotate OAuth credentials regularly
6. **Network Policies**: Restrict backend service access to only Gateway

## Rollback Procedure

If you need to disable IAP:

```bash
# Delete the BackendPolicy
kubectl delete gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod

# Or set enabled to false
kubectl patch gcpbackendpolicy agent-webapp-iap-policy -n mcp-agent-prod \
  --type=merge -p '{"spec":{"default":{"iap":{"enabled":false}}}}'

# Redeploy
make deploy ENV=prod
```

## Additional Resources

- [Google Cloud IAP Documentation](https://cloud.google.com/iap/docs)
- [GKE Gateway API with IAP](https://cloud.google.com/kubernetes-engine/docs/how-to/configure-gateway-resources)
- [IAP JWT Verification](https://cloud.google.com/iap/docs/signed-headers-howto)
- [Datadog IAP Monitoring](https://docs.datadoghq.com/security/application_security/policies/library_configuration/)

## Next Steps

1. Enable IAP for other services (burger-webapp, API endpoints)
2. Implement custom authorization logic based on user email/domain
3. Configure advanced IAP settings (session duration, access levels)
4. Set up monitoring alerts for authentication failures
5. Implement user session management with IAP identity
