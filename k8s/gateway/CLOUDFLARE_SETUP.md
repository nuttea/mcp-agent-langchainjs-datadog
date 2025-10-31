# Cloudflare SSL Termination Setup

This guide explains how to use Cloudflare for SSL termination with your GKE Gateway API setup.

## Architecture

```
User Browser (HTTPS)
    ↓
Cloudflare (SSL Termination)
    ↓
GKE Gateway (HTTP only, port 80)
    ↓
Your Services
```

**Benefits:**
- ✅ Free SSL/TLS certificates (Cloudflare Universal SSL)
- ✅ DDoS protection
- ✅ CDN caching
- ✅ Web Application Firewall (WAF)
- ✅ Analytics
- ✅ Automatic SSL renewal
- ✅ No changes needed in Kubernetes

## Cloudflare Setup

### Step 1: Add Your Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click "Add a site"
3. Enter `platform-engineering-demo.dev`
4. Choose a plan (Free is fine)
5. Cloudflare will scan your DNS records

### Step 2: Update Nameservers at Namecheap

Cloudflare will give you 2 nameservers (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`).

1. Log in to Namecheap
2. Go to Domain List → Manage `platform-engineering-demo.dev`
3. Go to Nameservers section
4. Select "Custom DNS"
5. Enter Cloudflare nameservers
6. Save changes

**Wait 5-60 minutes** for nameserver propagation.

### Step 3: Configure DNS Records in Cloudflare

Once nameservers are updated, add these DNS records in Cloudflare:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | www | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | burgers | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | api | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | burger-api | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | dev | [GATEWAY_IP] | Proxied (orange cloud) | Auto |
| A | *.dev | [GATEWAY_IP] | Proxied (orange cloud) | Auto |

**Important**:
- Enable "Proxied" (orange cloud icon) - This routes traffic through Cloudflare
- Replace `[GATEWAY_IP]` with your actual Gateway IP (from `kubectl get gateway -n shared-infra`)

### Step 4: Configure SSL/TLS Settings

In Cloudflare dashboard → SSL/TLS:

1. **SSL/TLS encryption mode**: Set to **"Flexible"**
   - This allows HTTPS (Cloudflare → User) and HTTP (Cloudflare → Origin)
   - Since your Gateway only supports HTTP, this is the correct mode

2. **Always Use HTTPS**: Enable
   - Automatically redirects HTTP to HTTPS

3. **Minimum TLS Version**: TLS 1.2 (recommended)

4. **Universal SSL**: Should be enabled by default (free certificate)

### Step 5: Verify Gateway Configuration

Your Gateway should stay as HTTP-only (port 80):

```bash
kubectl get gateway shared-gateway -n shared-infra -o yaml
```

Should show:
```yaml
listeners:
- name: http
  protocol: HTTP
  port: 80
```

**DO NOT add HTTPS listener** - Cloudflare handles SSL termination.

## SSL/TLS Encryption Modes Explained

### Flexible (Recommended for your setup)
```
User → [HTTPS] → Cloudflare → [HTTP] → Origin (GKE Gateway)
```
- ✅ Free and easy
- ✅ Works with HTTP-only backends
- ⚠️  Traffic between Cloudflare and origin is unencrypted
- Good for: Development, internal services behind firewall

### Full (Better security, requires origin cert)
```
User → [HTTPS] → Cloudflare → [HTTPS] → Origin (GKE Gateway)
```
- ✅ End-to-end encryption
- ⚠️  Requires SSL certificate on origin
- Would require: Adding HTTPS listener to Gateway with certificate

### Full (Strict) (Best security)
```
User → [HTTPS] → Cloudflare → [HTTPS with valid cert] → Origin
```
- ✅ End-to-end encryption with validation
- ⚠️  Requires valid SSL certificate on origin
- Would require: Adding HTTPS listener to Gateway with trusted certificate

**For now, use "Flexible"** since your Gateway only supports HTTP.

## Testing

Once Cloudflare is configured:

```bash
# Test HTTPS (should work)
curl -I https://dev.platform-engineering-demo.dev

# Test HTTP (should redirect to HTTPS)
curl -I http://dev.platform-engineering-demo.dev

# Check SSL certificate (should show Cloudflare certificate)
openssl s_client -connect dev.platform-engineering-demo.dev:443 -servername dev.platform-engineering-demo.dev </dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Subject:"
```

Expected results:
- HTTPS works ✅
- HTTP redirects to HTTPS (301) ✅
- Certificate issuer: Cloudflare ✅

## Additional Cloudflare Features

### 1. Caching (CDN)

Enable caching for static assets:
- Go to Caching → Configuration
- Enable "Browser Cache TTL"
- Create Page Rules for caching

Example Page Rule:
- URL: `*.platform-engineering-demo.dev/*.js`
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month

### 2. Web Application Firewall (WAF)

- Go to Security → WAF
- Enable "Managed Rules"
- Protects against OWASP Top 10 vulnerabilities

### 3. DDoS Protection

Automatically enabled for all proxied traffic (orange cloud).

### 4. Rate Limiting

- Go to Security → WAF → Rate limiting rules
- Protect API endpoints from abuse

Example:
- If `api.dev.platform-engineering-demo.dev/*` receives > 100 requests/minute → Block for 1 hour

### 5. Analytics

- Go to Analytics → Traffic
- See real-time traffic, threats blocked, bandwidth saved

## Troubleshooting

### Error 521: Web server is down
**Cause**: Cloudflare can't reach your origin (Gateway IP)

**Fix**:
```bash
# Verify Gateway is running
kubectl get gateway -n shared-infra

# Verify Gateway has IP
kubectl get gateway shared-gateway -n shared-infra -o jsonpath='{.status.addresses[0].value}'

# Test origin directly (from a server, not your browser)
curl -I http://[GATEWAY_IP]
```

### Error 525: SSL handshake failed
**Cause**: SSL/TLS mode is "Full" but origin doesn't support HTTPS

**Fix**: Change SSL/TLS mode to "Flexible" in Cloudflare dashboard

### Error 526: Invalid SSL certificate
**Cause**: SSL/TLS mode is "Full (Strict)" but origin certificate is invalid

**Fix**: Change SSL/TLS mode to "Flexible"

### DNS not resolving
```bash
# Check nameservers
dig NS platform-engineering-demo.dev

# Should show Cloudflare nameservers
# e.g., ns1.cloudflare.com, ns2.cloudflare.com
```

### HTTPS not working
1. Verify SSL/TLS mode is "Flexible"
2. Verify "Always Use HTTPS" is enabled
3. Check DNS records are "Proxied" (orange cloud)
4. Wait 5-10 minutes for changes to propagate

## Security Best Practices

### 1. Enable "Always Use HTTPS"
Forces all traffic to HTTPS automatically.

### 2. Enable HSTS (HTTP Strict Transport Security)
- Go to SSL/TLS → Edge Certificates
- Enable "Always Use HTTPS"
- Enable "HSTS"
- Settings:
  - Max Age: 6 months
  - Include subdomains: Yes
  - Preload: Yes (after testing)

### 3. Enable Bot Fight Mode
- Go to Security → Bots
- Enable "Bot Fight Mode" (free)

### 4. Use Page Rules for Additional Security
Create page rules for sensitive endpoints:
- `api.*.platform-engineering-demo.dev/*`
- Security Level: High
- WAF: On

## Cost

**Cloudflare Free Plan includes:**
- ✅ Unlimited SSL certificates
- ✅ DDoS protection (unmetered)
- ✅ Global CDN
- ✅ WAF (limited rules)
- ✅ Analytics
- ✅ DNS management

**Paid plans** ($20-200/month) add:
- Advanced WAF rules
- Image optimization
- Stream video delivery
- Load balancing
- Advanced analytics

**For most projects, Free plan is sufficient!**

## Architecture Comparison

### Before (No SSL)
```
User → [HTTP] → GKE Gateway → Services
```
- ❌ No encryption
- ❌ No DDoS protection
- ❌ No caching

### After (Cloudflare SSL Termination)
```
User → [HTTPS] → Cloudflare → [HTTP] → GKE Gateway → Services
      └─ SSL      └─ DDoS       └─ CDN
                  └─ WAF
```
- ✅ Free SSL/TLS
- ✅ DDoS protection
- ✅ CDN caching
- ✅ Web Application Firewall
- ✅ Analytics

## Migration from Current Setup

Your current setup already uses HTTP-only Gateway, so **no changes needed in Kubernetes!**

Just:
1. Add domain to Cloudflare
2. Update nameservers at Namecheap
3. Configure DNS records in Cloudflare
4. Set SSL/TLS mode to "Flexible"
5. Done! ✅

Your existing Gateway and HTTPRoutes continue working as-is.

## Monitoring

### Cloudflare Analytics
- Dashboard → Analytics → Traffic
- Shows: Requests, bandwidth, threats blocked, cache hit ratio

### Kubernetes Monitoring
```bash
# Gateway status
kubectl get gateway -n shared-infra

# HTTPRoute status
kubectl get httproute --all-namespaces

# Backend service health
kubectl get pods -n mcp-agent-dev
```

## Summary

**What Cloudflare provides:**
- 🔒 Free SSL certificates (auto-renewed)
- 🛡️ DDoS protection (unmetered)
- 🚀 Global CDN (faster loading)
- 🔥 Web Application Firewall (security)
- 📊 Analytics (insights)

**What you need to do:**
1. Add domain to Cloudflare (5 min)
2. Update nameservers at Namecheap (1 min)
3. Configure DNS records (5 min)
4. Set SSL mode to "Flexible" (1 min)
5. Wait for propagation (5-60 min)

**Total setup time: ~15 minutes + propagation**

Your Gateway API setup stays exactly the same - HTTP-only on port 80. Cloudflare handles all SSL/TLS termination! 🎉
