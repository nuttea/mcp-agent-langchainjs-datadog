# Google-Managed SSL with Load Balancer Authorization - Quick Setup

Since Cloudflare will be in **DNS only mode** (not intercepting traffic), you can use the simpler **Load Balancer Authorization** method for Google-Managed SSL certificates.

## 🎯 Your Setup

- **Current**: Cloudflare proxy (🟠 orange cloud) → GCP ALB HTTP:80
- **Target**: Cloudflare DNS only (⚫ gray cloud) → GCP ALB HTTPS:443
- **Method**: Load Balancer Authorization (simpler!)

## ✅ Why Load Balancer Authorization?

When Cloudflare is in DNS-only mode:
- ✅ Traffic goes directly from users to GCP
- ✅ No interception or proxy
- ✅ Google CA can validate via load balancer directly
- ✅ Faster and simpler than DNS authorization
- ✅ No CNAME records needed!

## 🚀 Quick Implementation (20-30 minutes)

### Step 1: Disable Cloudflare Proxy FIRST (5 minutes)

**Do this BEFORE creating certificates!**

In Cloudflare dashboard (https://dash.cloudflare.com/):

1. Select domain: `platform-engineering-demo.dev`
2. Go to **DNS** → **Records**
3. For each A record, click the **orange cloud** to turn it **gray**:

| Record | Current | Change To |
|--------|---------|-----------|
| www | 🟠 Proxied | ⚫ DNS only |
| @ | 🟠 Proxied | ⚫ DNS only |
| dev | 🟠 Proxied | ⚫ DNS only |
| burgers | 🟠 Proxied | ⚫ DNS only |
| api | 🟠 Proxied | ⚫ DNS only |
| burger-api | 🟠 Proxied | ⚫ DNS only |

4. Update each A record content to: **35.244.154.202**
5. Save

**Verify DNS**:
```bash
dig www.platform-engineering-demo.dev +short
# Should return: 35.244.154.202 (not Cloudflare IP)
```

### Step 2: Update Gateway with HTTPS Listener (2 minutes)

**File**: `k8s/gateway-infra/gateway.yaml`

```yaml
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: shared-infra
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

  # HTTPS listener with managed certificates
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "*.platform-engineering-demo.dev"
    tls:
      mode: Terminate
      options:
        # Let GKE automatically provision Google-Managed certificates
        networking.gke.io/managed-certificates: "platform-demo-cert"
    allowedRoutes:
      namespaces:
        from: Selector
        selector:
          matchLabels:
            shared-gateway-access: "true"
      kinds:
      - kind: HTTPRoute
```

Apply:

```bash
kubectl apply -f k8s/gateway-infra/gateway.yaml
```

### Step 3: Create Managed Certificate Resource (1 minute)

**File**: `k8s/gateway-infra/managed-certificate.yaml`

```yaml
---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: platform-demo-cert
  namespace: shared-infra
spec:
  domains:
    - www.platform-engineering-demo.dev
    - platform-engineering-demo.dev
    - dev.platform-engineering-demo.dev
    - burgers.platform-engineering-demo.dev
    - api.platform-engineering-demo.dev
    - burger-api.platform-engineering-demo.dev
```

Apply:

```bash
kubectl apply -f k8s/gateway-infra/managed-certificate.yaml
```

### Step 4: Update HTTPRoutes to Use HTTPS (2 minutes)

**Production**: `k8s/overlays/prod/httproute.yaml`

Change:
```yaml
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http'
```

**Development**: `k8s/overlays/dev/httproute.yaml`

Change:
```yaml
spec:
  parentRefs:
  - name: shared-gateway
    namespace: shared-infra
    sectionName: https  # Changed from 'http'
```

Apply:

```bash
kubectl apply -k k8s/overlays/prod
kubectl apply -k k8s/overlays/dev
```

### Step 5: Create HTTP to HTTPS Redirect (1 minute)

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

Apply:

```bash
kubectl apply -f k8s/gateway-infra/http-redirect.yaml
```

### Step 6: Monitor Certificate Provisioning (10-30 minutes)

```bash
# Watch certificate status
watch kubectl get managedcertificate platform-demo-cert -n shared-infra

# Or check details
kubectl describe managedcertificate platform-demo-cert -n shared-infra

# Certificate states:
# - Provisioning: Google is provisioning the certificate
# - Active: Certificate is ready ✅
# - FailedNotVisible: Check DNS points to correct IP
```

### Step 7: Verify Gateway Status

```bash
# Check Gateway HTTPS listener
kubectl get gateway shared-gateway -n shared-infra -o yaml | grep -A 20 listeners

# Check attached HTTPRoutes
kubectl get httproute -A
```

### Step 8: Test HTTPS and IAP (After certificate is Active)

```bash
# Test HTTPS connection
curl -I https://www.platform-engineering-demo.dev/

# Should see:
# - HTTP/2 200 or 302 (not error)
# - x-goog-iap-generated-response: true
# - No Cloudflare headers (server: cloudflare)

# Test IAP redirect
# Should redirect to accounts.google.com (not loop to itself)
```

### Step 9: Test IAP Authentication

1. Open **incognito browser**
2. Go to: `https://www.platform-engineering-demo.dev`
3. **Expected**: Redirect to `accounts.google.com`
4. Login with `@datadoghq.com` email
5. **Expected**: Redirect back to application
6. Application loads successfully! ✅

## 📊 Timeline

| Step | Duration | Notes |
|------|----------|-------|
| Disable Cloudflare proxy | 5 min | Do FIRST! |
| Update Gateway config | 2 min | Add HTTPS listener |
| Create ManagedCertificate | 1 min | Define domains |
| Update HTTPRoutes | 2 min | Use HTTPS listener |
| Create HTTP redirect | 1 min | Optional |
| DNS propagation | 1-5 min | Automatic |
| Certificate provisioning | 10-30 min | Google validates |
| Test IAP | 2 min | Should work! |
| **Total** | **25-50 min** | |

## 🔍 Troubleshooting

### Certificate Stays in "Provisioning"

**Check**: DNS resolves to correct IP

```bash
dig www.platform-engineering-demo.dev +short
# Must return: 35.244.154.202
```

**Fix**: Verify Cloudflare proxy is disabled (gray cloud)

### Certificate Shows "FailedNotVisible"

**Cause**: Google CA cannot reach your load balancer

**Fixes**:
1. Verify DNS points to 35.244.154.202
2. Verify Cloudflare proxy is disabled
3. Wait a few minutes and check again
4. Verify Gateway is listening on port 443

### IAP Still Shows Redirect Loop

**Cause**: Still need OAuth redirect URIs

**Fix**: Add these to OAuth client in Google Cloud Console:

```
https://iap.googleapis.com/v1/oauth/clientIds/449012790678-o4n20ce420kjuao68mciclp915dlrubj.apps.googleusercontent.com:handleRedirect
https://www.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
https://dev.platform-engineering-demo.dev/_gcp_gatekeeper/authenticate
```

## ✅ Advantages of Load Balancer Authorization

Compared to DNS authorization:
- ✅ **Simpler**: No CNAME records needed
- ✅ **Fewer steps**: Just disable proxy and create cert
- ✅ **Faster**: No waiting for CNAME propagation
- ✅ **Cleaner DNS**: No _acme-challenge records

## 📝 Next Steps

I'll create:
1. ✅ Updated Gateway configuration
2. ✅ Updated HTTPRoute configurations
3. ✅ ManagedCertificate resource
4. ✅ HTTP redirect configuration
5. ✅ Automated setup script

Ready to implement? Let me know and I'll create all the files!

## 📍 Your Static IP

```
35.244.154.202
```

Point all your DNS A records to this IP with Cloudflare proxy disabled (⚫ DNS only).
