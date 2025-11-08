# Google-Managed SSL Certificate Setup for Gateway API

Complete guide for setting up Google-Managed SSL certificates with GKE Gateway API and migrating from Cloudflare to enable IAP authentication.

## Overview

Google-Managed SSL certificates provide automatic certificate provisioning, renewal, and management for your domains. This is the recommended approach for IAP-enabled applications.

## Current vs. Target Architecture

### Current (With Cloudflare - IAP Doesn't Work)
```
User → Cloudflare (HTTPS → HTTP) → GCP ALB (HTTP:80) → IAP ❌
```

### Target (Direct to GCP - IAP Works)
```
User → GCP ALB (HTTPS:443) → IAP ✅ → Gateway API → Backend
         ↓
    Google-Managed SSL Certificate
```

## Prerequisites

- GKE cluster with Gateway API enabled
- Static IP address reserved: ✅ `35.244.154.202`
- Domain ownership verification
- Access to DNS management (Cloudflare)

## Your Static IP Address

```
35.244.154.202
```

This is your GCP Application Load Balancer IP address that DNS should point to.

## Step-by-Step Implementation

### Phase 1: Create Google-Managed SSL Certificate (5 minutes)

#### Option A: Using Certificate Manager (Recommended)

```bash
# Create a certificate map
gcloud certificate-manager maps create platform-demo-cert-map \
    --description="SSL certificates for platform-engineering-demo.dev"

# Create managed certificate entries for each domain
gcloud certificate-manager certificates create platform-demo-www-cert \
    --domains="www.platform-engineering-demo.dev"

gcloud certificate-manager certificates create platform-demo-root-cert \
    --domains="platform-engineering-demo.dev"

gcloud certificate-manager certificates create platform-demo-dev-cert \
    --domains="dev.platform-engineering-demo.dev"

gcloud certificate-manager certificates create platform-demo-burgers-cert \
    --domains="burgers.platform-engineering-demo.dev"

gcloud certificate-manager certificates create platform-demo-api-cert \
    --domains="api.platform-engineering-demo.dev,burger-api.platform-engineering-demo.dev"

# Add certificates to map
gcloud certificate-manager maps entries create www-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-www-cert" \
    --hostname="www.platform-engineering-demo.dev"

gcloud certificate-manager maps entries create root-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-root-cert" \
    --hostname="platform-engineering-demo.dev"

gcloud certificate-manager maps entries create dev-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-dev-cert" \
    --hostname="dev.platform-engineering-demo.dev"

gcloud certificate-manager maps entries create burgers-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-burgers-cert" \
    --hostname="burgers.platform-engineering-demo.dev"

gcloud certificate-manager maps entries create api-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-api-cert" \
    --hostname="api.platform-engineering-demo.dev"

gcloud certificate-manager maps entries create burger-api-entry \
    --map="platform-demo-cert-map" \
    --certificates="platform-demo-api-cert" \
    --hostname="burger-api.platform-engineering-demo.dev"
```

#### Option B: Using Classic SSL Certificates (Simpler)

```bash
# Create a single multi-domain certificate
gcloud compute ssl-certificates create platform-demo-cert \
    --domains=www.platform-engineering-demo.dev,platform-engineering-demo.dev,dev.platform-engineering-demo.dev,burgers.platform-engineering-demo.dev,api.platform-engineering-demo.dev,burger-api.platform-engineering-demo.dev \
    --global
```

**Note**: Classic SSL certificates have a limit of 100 domains per certificate.

### Phase 2: Update Gateway to Use HTTPS (5 minutes)

#### Update Gateway Configuration

**File**: `k8s/gateway-infra/gateway.yaml`

```yaml
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: shared-infra
  annotations:
    # Reference the certificate map
    networking.gke.io/certmap: platform-demo-cert-map
spec:
  gatewayClassName: gke-l7-global-external-managed
  addresses:
  - type: NamedAddress
    value: mcp-agent-gateway-ip
  listeners:
  # HTTP listener (for redirect to HTTPS)
  - name: http
    protocol: HTTP
    port: 80
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            shared-gateway-access: "true"
      kinds:
      - kind: HTTPRoute

  # HTTPS listener (for IAP and secure traffic)
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      options:
        networking.gke.io/pre-shared-certs: platform-demo-cert
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            shared-gateway-access: "true"
      kinds:
      - kind: HTTPRoute
```

#### Apply Gateway Updates

```bash
# Apply the updated Gateway
kubectl apply -f k8s/gateway-infra/gateway.yaml

# Wait for Gateway to update (2-5 minutes)
kubectl get gateway shared-gateway -n shared-infra -o yaml
```

### Phase 3: Update HTTPRoutes to Use HTTPS Listener (2 minutes)

#### Production HTTPRoute

**File**: `k8s/overlays/prod/httproute.yaml`

Change the `parentRefs` section:

```yaml
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http' to 'https'
```

#### Development HTTPRoute

**File**: `k8s/overlays/dev/httproute.yaml`

Make the same change:

```yaml
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http' to 'https'
```

#### Apply HTTPRoute Updates

```bash
kubectl apply -k k8s/overlays/prod
kubectl apply -k k8s/overlays/dev
```

### Phase 4: Update DNS in Cloudflare (5 minutes)

#### Step 1: Get GCP IP Address

Your static IP: **`35.244.154.202`**

#### Step 2: Update Cloudflare DNS Records

In Cloudflare dashboard (https://dash.cloudflare.com/):

1. Select domain: `platform-engineering-demo.dev`
2. Go to **DNS** → **Records**
3. Update each record:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | www | 35.244.154.202 | ⚫ DNS only | Auto |
| A | @ | 35.244.154.202 | ⚫ DNS only | Auto |
| A | dev | 35.244.154.202 | ⚫ DNS only | Auto |
| A | burgers | 35.244.154.202 | ⚫ DNS only | Auto |
| A | api | 35.244.154.202 | ⚫ DNS only | Auto |
| A | burger-api | 35.244.154.202 | ⚫ DNS only | Auto |

**Critical**: Click the orange cloud icon to turn it gray (⚫ DNS only). This disables Cloudflare proxy.

#### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution (may take 1-5 minutes)
dig www.platform-engineering-demo.dev +short
# Should return: 35.244.154.202

dig dev.platform-engineering-demo.dev +short
# Should return: 35.244.154.202
```

### Phase 5: Wait for SSL Certificate Provisioning (10-30 minutes)

#### Check Certificate Status

```bash
# For Certificate Manager
gcloud certificate-manager certificates list

# For Classic SSL Certificates
gcloud compute ssl-certificates list

# Describe specific certificate
gcloud compute ssl-certificates describe platform-demo-cert --global
```

#### Certificate States

- **PROVISIONING**: Google is provisioning the certificate
- **ACTIVE**: Certificate is ready and being served
- **FAILED**: Check domain ownership and DNS

#### Troubleshooting

If certificate stays in PROVISIONING:
1. Verify DNS points to correct IP (35.244.154.202)
2. Verify Cloudflare proxy is disabled (gray cloud)
3. Check domain ownership verification
4. Wait up to 30 minutes for initial provisioning

### Phase 6: Configure HTTP to HTTPS Redirect (Optional but Recommended)

Create an HTTPRoute for HTTP to HTTPS redirect:

**File**: `k8s/gateway-infra/http-redirect.yaml`

```yaml
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: http-to-https-redirect
  namespace: shared-infra
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: http
  hostnames:
  - "www.platform-engineering-demo.dev"
  - "platform-engineering-demo.dev"
  - "dev.platform-engineering-demo.dev"
  - "burgers.platform-engineering-demo.dev"
  - "api.platform-engineering-demo.dev"
  - "burger-api.platform-engineering-demo.dev"
  rules:
  - filters:
    - type: RequestRedirect
      requestRedirect:
        scheme: https
        statusCode: 301
```

Apply it:

```bash
kubectl apply -f k8s/gateway-infra/http-redirect.yaml
```

## Testing & Verification

### Step 1: Test HTTPS Connection

```bash
# Test HTTPS (should work after SSL is provisioned)
curl -I https://www.platform-engineering-demo.dev/

# Should NOT see Cloudflare headers anymore
# Should see: x-goog-iap-generated-response: true
```

### Step 2: Test IAP Authentication

1. **Clear browser cache** or use incognito window
2. Go to: `https://www.platform-engineering-demo.dev`
3. **Expected**: Redirect to `accounts.google.com`
4. Login with `@datadoghq.com` email
5. **Expected**: Redirect back to application
6. Application loads successfully! ✅

### Step 3: Verify No Cloudflare

```bash
$ curl -I https://www.platform-engineering-demo.dev/ | grep -i "server\|cf-"

# Should NOT see:
# - server: cloudflare
# - cf-ray: ...
# - cf-cache-status: ...
```

### Step 4: Verify IAP Headers

```bash
# Enable debug logging in dev
kubectl set env deployment/agent-api LOG_IAP_HEADERS=true -n mcp-agent-dev

# Check logs
kubectl logs -n mcp-agent-dev deployment/agent-api -f | grep "IAP User"

# Expected:
# IAP User: { email: 'user@datadoghq.com', userId: '...' }
```

## Complete Implementation Script

I'll create an automated script to do all of this. Here's what you need to run:

### Quick Setup Commands

```bash
# 1. Create Google-Managed SSL Certificate
gcloud compute ssl-certificates create platform-demo-cert \
    --domains=www.platform-engineering-demo.dev,platform-engineering-demo.dev,dev.platform-engineering-demo.dev,burgers.platform-engineering-demo.dev,api.platform-engineering-demo.dev,burger-api.platform-engineering-demo.dev \
    --global

# 2. Apply updated Gateway with HTTPS listener
# (I'll create the updated files for you)

# 3. Update Cloudflare DNS
# Point all A records to: 35.244.154.202
# Set to DNS only (disable proxy)

# 4. Wait for certificate provisioning (10-30 min)
watch -n 30 'gcloud compute ssl-certificates describe platform-demo-cert --global --format="value(managed.status)"'

# 5. Test IAP authentication
# https://www.platform-engineering-demo.dev
```

## Timeline

| Step | Duration | What Happens |
|------|----------|--------------|
| Create SSL cert | 1 min | Certificate created (PROVISIONING state) |
| Update Gateway | 2 min | HTTPS listener added |
| Update HTTPRoutes | 1 min | Routes use HTTPS listener |
| Update DNS | 5 min | Point to GCP IP, disable Cloudflare proxy |
| DNS propagation | 1-5 min | DNS resolves to GCP IP |
| SSL provisioning | 10-30 min | Google validates domain and provisions cert |
| Test IAP | 1 min | Should work immediately after SSL is ACTIVE |
| **Total** | **20-45 min** | |

## Benefits of Google-Managed Certificates

✅ **Automatic renewal** - Never expires
✅ **Free** - No cost for certificates
✅ **Fast provisioning** - Usually 10-20 minutes
✅ **Multi-domain support** - Up to 100 domains per certificate
✅ **Native integration** - Works seamlessly with Gateway API
✅ **IAP compatible** - Enables IAP to work correctly
✅ **No manual management** - Fully automated

## Next Steps

Would you like me to:

1. ✅ Create the updated Gateway configuration with HTTPS listener
2. ✅ Create the updated HTTPRoute configurations
3. ✅ Create an HTTP to HTTPS redirect configuration
4. ✅ Create an automated setup script
5. ✅ Provide the exact DNS records to update in Cloudflare

Let me create all of these for you now!
