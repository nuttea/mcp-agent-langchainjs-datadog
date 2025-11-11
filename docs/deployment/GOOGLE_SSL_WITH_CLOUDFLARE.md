# Google-Managed SSL Certificates with Cloudflare - DNS Authorization

Complete guide for setting up Google-Managed SSL certificates using DNS authorization while migrating from Cloudflare proxy to DNS-only mode.

## 🎯 Strategy: DNS Authorization (Required for Cloudflare Migration)

Since you currently have Cloudflare in front of your load balancer, you **must use DNS authorization** (not load balancer authorization) because:

1. **Load balancer authorization** requires the CA to contact your load balancer directly
2. **Cloudflare proxy blocks** these validation requests
3. **DNS authorization** uses CNAME records instead - works with Cloudflare!

## 📋 Implementation Plan

### Phase 1: Create Certificates with DNS Authorization

### Phase 2: Add DNS Validation Records to Cloudflare

### Phase 3: Wait for Certificate Provisioning

### Phase 4: Update Gateway for HTTPS

### Phase 5: Migrate DNS to Point to GCP

### Phase 6: Disable Cloudflare Proxy

### Phase 7: Test IAP Authentication

## 🚀 Step-by-Step Implementation

### Step 1: Create Certificate Map (1 minute)

```bash
# Create a certificate map for all your domains
gcloud certificate-manager maps create platform-demo-cert-map \
    --description="SSL certificates for platform-engineering-demo.dev domains" \
    --project=datadog-ese-sandbox
```

### Step 2: Create DNS Authorization for Each Domain (5 minutes)

```bash
# Create DNS authorization for each unique domain
# This generates CNAME records you'll add to Cloudflare

# www subdomain
gcloud certificate-manager dns-authorizations create www-platform-demo-dns-auth \
    --domain="www.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

# Root domain
gcloud certificate-manager dns-authorizations create root-platform-demo-dns-auth \
    --domain="platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

# dev subdomain
gcloud certificate-manager dns-authorizations create dev-platform-demo-dns-auth \
    --domain="dev.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

# burgers subdomain
gcloud certificate-manager dns-authorizations create burgers-platform-demo-dns-auth \
    --domain="burgers.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

# api subdomain
gcloud certificate-manager dns-authorizations create api-platform-demo-dns-auth \
    --domain="api.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

# burger-api subdomain
gcloud certificate-manager dns-authorizations create burger-api-platform-demo-dns-auth \
    --domain="burger-api.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox
```

### Step 3: Get DNS Validation Records (2 minutes)

```bash
# Get the CNAME records for each authorization
# You'll add these to Cloudflare

echo "=== DNS Validation Records for Cloudflare ==="
echo ""

for auth in www-platform-demo-dns-auth root-platform-demo-dns-auth dev-platform-demo-dns-auth burgers-platform-demo-dns-auth api-platform-demo-dns-auth burger-api-platform-demo-dns-auth; do
    echo "Authorization: $auth"
    gcloud certificate-manager dns-authorizations describe $auth \
        --format="value(dnsResourceRecord.name,dnsResourceRecord.data)" \
        --project=datadog-ese-sandbox
    echo ""
done
```

**Example Output**:
```
_acme-challenge.www.platform-engineering-demo.dev. → _acme-challenge.www.platform-engineering-demo.dev.auth.acme.invalid.
_acme-challenge.dev.platform-engineering-demo.dev. → _acme-challenge.dev.platform-engineering-demo.dev.auth.acme.invalid.
...
```

### Step 4: Add CNAME Records to Cloudflare (5 minutes)

For each DNS authorization, add a CNAME record in Cloudflare:

1. Go to Cloudflare DNS settings: https://dash.cloudflare.com/
2. Select domain: `platform-engineering-demo.dev`
3. Click **Add record**
4. For each validation record:

| Type | Name | Target | Proxy Status | TTL |
|------|------|--------|--------------|-----|
| CNAME | _acme-challenge.www | [value from step 3] | ⚫ DNS only | Auto |
| CNAME | _acme-challenge | [value from step 3] | ⚫ DNS only | Auto |
| CNAME | _acme-challenge.dev | [value from step 3] | ⚫ DNS only | Auto |
| CNAME | _acme-challenge.burgers | [value from step 3] | ⚫ DNS only | Auto |
| CNAME | _acme-challenge.api | [value from step 3] | ⚫ DNS only | Auto |
| CNAME | _acme-challenge.burger-api | [value from step 3] | ⚫ DNS only | Auto |

**Important**:
- Use the **exact values** from step 3
- Set to **DNS only** (gray cloud, not proxied)
- TTL: Auto or 300 seconds

### Step 5: Create Certificates with DNS Authorization (2 minutes)

```bash
# Create certificates for each domain, referencing the DNS authorizations

gcloud certificate-manager certificates create www-platform-demo-cert \
    --domains="www.platform-engineering-demo.dev" \
    --dns-authorizations=www-platform-demo-dns-auth \
    --project=datadog-ese-sandbox

gcloud certificate-manager certificates create root-platform-demo-cert \
    --domains="platform-engineering-demo.dev" \
    --dns-authorizations=root-platform-demo-dns-auth \
    --project=datadog-ese-sandbox

gcloud certificate-manager certificates create dev-platform-demo-cert \
    --domains="dev.platform-engineering-demo.dev" \
    --dns-authorizations=dev-platform-demo-dns-auth \
    --project=datadog-ese-sandbox

gcloud certificate-manager certificates create burgers-platform-demo-cert \
    --domains="burgers.platform-engineering-demo.dev" \
    --dns-authorizations=burgers-platform-demo-dns-auth \
    --project=datadog-ese-sandbox

gcloud certificate-manager certificates create api-platform-demo-cert \
    --domains="api.platform-engineering-demo.dev" \
    --dns-authorizations=api-platform-demo-dns-auth \
    --project=datadog-ese-sandbox

gcloud certificate-manager certificates create burger-api-platform-demo-cert \
    --domains="burger-api.platform-engineering-demo.dev" \
    --dns-authorizations=burger-api-platform-demo-dns-auth \
    --project=datadog-ese-sandbox
```

### Step 6: Add Certificates to Certificate Map (2 minutes)

```bash
# Map each certificate to its hostname

gcloud certificate-manager maps entries create www-entry \
    --map="platform-demo-cert-map" \
    --certificates="www-platform-demo-cert" \
    --hostname="www.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

gcloud certificate-manager maps entries create root-entry \
    --map="platform-demo-cert-map" \
    --certificates="root-platform-demo-cert" \
    --hostname="platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

gcloud certificate-manager maps entries create dev-entry \
    --map="platform-demo-cert-map" \
    --certificates="dev-platform-demo-cert" \
    --hostname="dev.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

gcloud certificate-manager maps entries create burgers-entry \
    --map="platform-demo-cert-map" \
    --certificates="burgers-platform-demo-cert" \
    --hostname="burgers.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

gcloud certificate-manager maps entries create api-entry \
    --map="platform-demo-cert-map" \
    --certificates="api-platform-demo-cert" \
    --hostname="api.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox

gcloud certificate-manager maps entries create burger-api-entry \
    --map="platform-demo-cert-map" \
    --certificates="burger-api-platform-demo-cert" \
    --hostname="burger-api.platform-engineering-demo.dev" \
    --project=datadog-ese-sandbox
```

### Step 7: Monitor Certificate Provisioning (10-30 minutes)

```bash
# Check certificate status
watch -n 30 'gcloud certificate-manager certificates list --project=datadog-ese-sandbox'

# Or check specific certificate
gcloud certificate-manager certificates describe www-platform-demo-cert \
    --project=datadog-ese-sandbox

# Expected states:
# - PROVISIONING: Validating DNS records
# - ACTIVE: Certificate ready to use ✅
# - FAILED: Check DNS records
```

### Step 8: Update Gateway with HTTPS Listener

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
  # HTTP listener (will redirect to HTTPS)
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

  # HTTPS listener (for secure traffic and IAP)
  - name: https
    protocol: HTTPS
    port: 443
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            shared-gateway-access: "true"
      kinds:
      - kind: HTTPRoute
```

**Note**: The `networking.gke.io/certmap` annotation references the certificate map. GKE will automatically configure TLS.

Apply the updated Gateway:

```bash
kubectl apply -f k8s/gateway-infra/gateway.yaml

# Verify HTTPS listener is created
kubectl get gateway shared-gateway -n shared-infra -o yaml | grep -A 10 listeners
```

### Step 9: Update HTTPRoutes to Use HTTPS Listener

Update both prod and dev HTTPRoutes to reference the HTTPS listener.

**File**: `k8s/overlays/prod/httproute.yaml`

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp-agent-prod-route
  namespace: mcp-agent-prod
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http' to 'https'
  hostnames:
  - "platform-engineering-demo.dev"
  - "www.platform-engineering-demo.dev"
  - "burgers.platform-engineering-demo.dev"
  - "api.platform-engineering-demo.dev"
  - "burger-api.platform-engineering-demo.dev"
  # ... rest of config
```

**File**: `k8s/overlays/dev/httproute.yaml`

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: mcp-agent-dev-route
  namespace: mcp-agent-dev
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http' to 'https'
  # ... rest of config
```

Apply updates:

```bash
kubectl apply -k k8s/overlays/prod
kubectl apply -k k8s/overlays/dev
```

### Step 10: Create HTTP to HTTPS Redirect (Optional but Recommended)

**File**: `k8s/gateway-infra/http-redirect.yaml`

```yaml
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: http-to-https-redirect
  namespace: shared-infra
  labels:
    purpose: https-redirect
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

Apply:

```bash
kubectl apply -f k8s/gateway-infra/http-redirect.yaml
```

### Step 11: Update DNS to Point to GCP (After Certificates are ACTIVE)

**IMPORTANT**: Only do this step AFTER certificates are ACTIVE!

#### In Cloudflare Dashboard

Update these A records to point to GCP IP: **35.244.154.202**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | www | 35.244.154.202 | ⚫ DNS only | Auto |
| A | @ | 35.244.154.202 | ⚫ DNS only | Auto |
| A | dev | 35.244.154.202 | ⚫ DNS only | Auto |
| A | burgers | 35.244.154.202 | ⚫ DNS only | Auto |
| A | api | 35.244.154.202 | ⚫ DNS only | Auto |
| A | burger-api | 35.244.154.202 | ⚫ DNS only | Auto |

**Critical**:
- Set **Proxy status** to ⚫ **DNS only** (gray cloud)
- This disables Cloudflare proxy
- Cloudflare will only provide DNS, not proxy

### Step 12: Verify and Test

```bash
# Wait a few minutes for DNS propagation
sleep 300

# Test DNS resolution
dig www.platform-engineering-demo.dev +short
# Should return: 35.244.154.202

# Test HTTPS
curl -I https://www.platform-engineering-demo.dev/

# Should NOT see Cloudflare headers:
# - server: cloudflare ❌
# - cf-ray: ... ❌

# Should see IAP header:
# - x-goog-iap-generated-response: true ✅
```

## 🔑 Why DNS Authorization?

### Load Balancer Authorization (Won't Work for You)

```
Google CA → Tries to contact your load balancer
              ↓
        Cloudflare proxy intercepts ❌
              ↓
        Validation fails
```

### DNS Authorization (Will Work)

```
Google CA → Checks DNS for CNAME record
              ↓
        Cloudflare DNS provides CNAME ✅
              ↓
        Validation succeeds
              ↓
        Certificate provisioned
```

## 📝 Complete Automation Script

Let me create an automated script for you:

**File**: `k8s/scripts/setup-google-managed-ssl.sh`

```bash
#!/bin/bash
set -e

PROJECT_ID="datadog-ese-sandbox"
CERT_MAP="platform-demo-cert-map"

echo "=== Creating Certificate Map ==="
gcloud certificate-manager maps create $CERT_MAP \
    --description="SSL certificates for platform-engineering-demo.dev" \
    --project=$PROJECT_ID || echo "Map already exists"

echo ""
echo "=== Creating DNS Authorizations ==="

DOMAINS=(
    "www:www.platform-engineering-demo.dev"
    "root:platform-engineering-demo.dev"
    "dev:dev.platform-engineering-demo.dev"
    "burgers:burgers.platform-engineering-demo.dev"
    "api:api.platform-engineering-demo.dev"
    "burger-api:burger-api.platform-engineering-demo.dev"
)

for entry in "${DOMAINS[@]}"; do
    IFS=':' read -r name domain <<< "$entry"
    auth_name="${name}-platform-demo-dns-auth"

    echo "Creating DNS authorization for $domain..."
    gcloud certificate-manager dns-authorizations create $auth_name \
        --domain="$domain" \
        --project=$PROJECT_ID || echo "Authorization already exists"
done

echo ""
echo "=== DNS Validation Records to Add to Cloudflare ==="
echo ""
echo "Add these CNAME records to your Cloudflare DNS:"
echo ""

for entry in "${DOMAINS[@]}"; do
    IFS=':' read -r name domain <<< "$entry"
    auth_name="${name}-platform-demo-dns-auth"

    echo "Domain: $domain"
    gcloud certificate-manager dns-authorizations describe $auth_name \
        --format="table(dnsResourceRecord.name,dnsResourceRecord.data)" \
        --project=$PROJECT_ID
    echo ""
done

echo "=== Creating Certificates ==="

for entry in "${DOMAINS[@]}"; do
    IFS=':' read -r name domain <<< "$entry"
    auth_name="${name}-platform-demo-dns-auth"
    cert_name="${name}-platform-demo-cert"

    echo "Creating certificate for $domain..."
    gcloud certificate-manager certificates create $cert_name \
        --domains="$domain" \
        --dns-authorizations=$auth_name \
        --project=$PROJECT_ID || echo "Certificate already exists"
done

echo ""
echo "=== Adding Certificates to Map ==="

for entry in "${DOMAINS[@]}"; do
    IFS=':' read -r name domain <<< "$entry"
    cert_name="${name}-platform-demo-cert"
    entry_name="${name}-entry"

    echo "Adding $domain to certificate map..."
    gcloud certificate-manager maps entries create $entry_name \
        --map=$CERT_MAP \
        --certificates=$cert_name \
        --hostname="$domain" \
        --project=$PROJECT_ID || echo "Entry already exists"
done

echo ""
echo "=== Certificate Status ==="
gcloud certificate-manager certificates list --project=$PROJECT_ID

echo ""
echo "====================================================================="
echo "NEXT STEPS:"
echo "====================================================================="
echo ""
echo "1. Add the CNAME records shown above to Cloudflare DNS"
echo "2. Wait 10-30 minutes for certificates to become ACTIVE"
echo "3. Check status: gcloud certificate-manager certificates list"
echo "4. Update Gateway to use HTTPS (see docs)"
echo "5. Update HTTPRoutes to use HTTPS listener"
echo "6. Update Cloudflare DNS A records to point to: 35.244.154.202"
echo "7. Disable Cloudflare proxy (gray cloud icon)"
echo "8. Test IAP authentication!"
echo ""
```

## 📋 DNS Records Summary

After certificates are ACTIVE, update these A records in Cloudflare:

### Current (Cloudflare Proxy Enabled)
```
www.platform-engineering-demo.dev → Cloudflare Proxy (🟠) → Your origin
```

### Target (DNS Only - GCP Direct)
```
www.platform-engineering-demo.dev → A record: 35.244.154.202 (⚫ DNS only)
```

### All Records to Update

```
Type: A, Name: www, Content: 35.244.154.202, Proxy: ⚫ DNS only
Type: A, Name: @, Content: 35.244.154.202, Proxy: ⚫ DNS only
Type: A, Name: dev, Content: 35.244.154.202, Proxy: ⚫ DNS only
Type: A, Name: burgers, Content: 35.244.154.202, Proxy: ⚫ DNS only
Type: A, Name: api, Content: 35.244.154.202, Proxy: ⚫ DNS only
Type: A, Name: burger-api, Content: 35.244.154.202, Proxy: ⚫ DNS only
```

## ✅ Benefits of This Approach

### You Get to Keep
- ✅ Cloudflare for DNS management
- ✅ Easy DNS updates via Cloudflare dashboard
- ✅ Cloudflare analytics (DNS level)

### You Gain
- ✅ Google-Managed SSL (free, auto-renewal)
- ✅ IAP authentication (free)
- ✅ Direct connection to GCP (lower latency)
- ✅ Native GCP integration
- ✅ All your IAP code works immediately

### You Lose
- ❌ Cloudflare proxy features (CDN, DDoS, caching)

### GCP Alternatives
- Cloudflare CDN → **Google Cloud CDN** (enable on load balancer)
- Cloudflare DDoS → **Google Cloud Armor** (configure security policies)
- Cloudflare caching → **Cloud CDN** (configure caching rules)

## 🎯 Implementation Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Create certificate map | 1 min | Ready |
| Create DNS authorizations | 2 min | Ready |
| Add CNAME records to Cloudflare | 5 min | Manual |
| Create certificates | 2 min | Ready |
| Add to certificate map | 2 min | Ready |
| Wait for DNS validation | 5-10 min | Auto |
| Wait for certificate provisioning | 10-30 min | Auto |
| Update Gateway config | 2 min | Ready |
| Update HTTPRoutes | 2 min | Ready |
| Update DNS A records | 5 min | Manual |
| Test IAP | 2 min | Ready |
| **Total** | **40-60 min** | |

## 🚀 Ready to Start?

I can create:
1. ✅ Automated SSL setup script
2. ✅ Updated Gateway configuration
3. ✅ Updated HTTPRoute configurations
4. ✅ HTTP to HTTPS redirect
5. ✅ Complete testing guide

Just let me know and I'll create all the configuration files you need!

## 📊 Quick Decision

### Use DNS Authorization + Disable Cloudflare Proxy if:
- ✅ You want IAP to work (already implemented!)
- ✅ You want $0 additional cost
- ✅ You're primarily on GCP
- ✅ You can use Google Cloud CDN/Armor instead

### Use Cloudflare Access if:
- ⚠️ You must keep Cloudflare proxy active
- ⚠️ You have $350+/month budget
- ⚠️ You need multi-provider authentication
- ⚠️ You're willing to rewrite authentication code

**Your GCP IP**: `35.244.154.202`
**Recommendation**: DNS Authorization + Disable Cloudflare Proxy (Best for IAP)
