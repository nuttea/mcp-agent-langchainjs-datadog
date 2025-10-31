# Cloudflare SSL Setup - Quick Start

## TL;DR

Use Cloudflare for FREE SSL/TLS, DDoS protection, and CDN.

**Your Gateway stays HTTP-only** - Cloudflare handles all SSL termination.

## 5-Minute Setup

### Step 1: Get Your Gateway IP

```bash
kubectl get gateway shared-gateway -n shared-infra -o jsonpath='{.status.addresses[0].value}'
```

**Save this IP** - you'll need it for Cloudflare DNS.

Example: `34.102.244.218`

### Step 2: Add Domain to Cloudflare

1. Go to https://dash.cloudflare.com/
2. Click "Add a site"
3. Enter: `platform-engineering-demo.dev`
4. Choose: Free plan
5. Click "Add site"

### Step 3: Update Nameservers at Namecheap

Cloudflare will show you 2 nameservers like:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

Go to Namecheap:
1. Domain List → Manage `platform-engineering-demo.dev`
2. Nameservers → Custom DNS
3. Enter Cloudflare nameservers
4. Save

**Wait 10-60 minutes** for propagation.

### Step 4: Add DNS Records in Cloudflare

Go to Cloudflare → DNS → Records, add these **A records**:

| Name | Content | Proxy | TTL |
|------|---------|-------|-----|
| @ | [GATEWAY_IP] | ✅ Proxied | Auto |
| www | [GATEWAY_IP] | ✅ Proxied | Auto |
| burgers | [GATEWAY_IP] | ✅ Proxied | Auto |
| api | [GATEWAY_IP] | ✅ Proxied | Auto |
| burger-api | [GATEWAY_IP] | ✅ Proxied | Auto |
| dev | [GATEWAY_IP] | ✅ Proxied | Auto |
| *.dev | [GATEWAY_IP] | ✅ Proxied | Auto |

**Important**: Click the cloud icon to enable "Proxied" (orange) for each record.

### Step 5: Configure SSL Settings

Cloudflare → SSL/TLS:

1. **Overview**: Set to "Flexible"
2. **Edge Certificates**:
   - Enable "Always Use HTTPS"
   - Enable "Automatic HTTPS Rewrites"

### Step 6: Test

Wait 5-10 minutes after DNS changes, then:

```bash
# Should work with HTTPS
curl -I https://dev.platform-engineering-demo.dev

# Should redirect to HTTPS
curl -I http://dev.platform-engineering-demo.dev
```

## Done! 🎉

Your setup now has:
- ✅ Free SSL/TLS certificates
- ✅ HTTPS for all domains
- ✅ DDoS protection
- ✅ Global CDN
- ✅ Web Application Firewall

## Configuration Summary

```
User Browser
    ↓ HTTPS (Cloudflare SSL)
Cloudflare
    ↓ HTTP (no SSL needed)
GKE Gateway (port 80 only)
    ↓
Your Services
```

**Your Gateway stays HTTP-only** - no changes needed in Kubernetes!

## Troubleshooting

### Error 521: Web server is down
Gateway might not be running or IP is wrong.

```bash
# Check Gateway
kubectl get gateway shared-gateway -n shared-infra
```

### Error 525: SSL handshake failed
SSL mode is wrong.

**Fix**: Set SSL/TLS mode to "Flexible" in Cloudflare

### HTTPS not working
1. Check SSL mode is "Flexible"
2. Check "Always Use HTTPS" is enabled
3. Check DNS records are "Proxied" (orange cloud)
4. Wait 5-10 minutes

### DNS not resolving
```bash
dig NS platform-engineering-demo.dev
```

Should show Cloudflare nameservers. If not, wait longer for propagation.

## Next Steps

Once HTTPS is working:

1. **Enable HSTS** (SSL/TLS → Edge Certificates)
2. **Configure Caching** (Caching → Configuration)
3. **Enable Bot Protection** (Security → Bots)
4. **Review Analytics** (Analytics → Traffic)

See [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for detailed configuration.

## What You Get (FREE)

- 🔒 SSL/TLS certificates (auto-renewed)
- 🛡️ DDoS protection (unlimited)
- 🚀 CDN (global caching)
- 🔥 WAF (basic rules)
- 📊 Analytics
- 🌍 DNS management

## Cost

**FREE** - Cloudflare Free plan includes everything you need!

No changes to your existing Gateway API setup required.
