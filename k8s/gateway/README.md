# Gateway API Setup for MCP Agent

This directory contains Gateway API configuration for managing ingress traffic to the MCP Agent application using GKE's L7 Global External Application Load Balancer.

## Architecture

**Pattern**: Shared Gateway per cluster
**Load Balancer**: L7 Global External Managed (HTTP only)
**Domain**: platform-engineering-demo.dev

### Service Mapping

#### Production Environment (`mcp-agent-prod` namespace)
- `platform-engineering-demo.dev` → agent-webapp
- `www.platform-engineering-demo.dev` → agent-webapp
- `burgers.platform-engineering-demo.dev` → burger-webapp
- `api.platform-engineering-demo.dev` → agent-api (optional, for debugging)
- `burger-api.platform-engineering-demo.dev` → burger-api (optional, for debugging)

#### Development Environment (`mcp-agent-dev` namespace)
- `dev.platform-engineering-demo.dev` → agent-webapp
- `burgers.dev.platform-engineering-demo.dev` → burger-webapp
- `api.dev.platform-engineering-demo.dev` → agent-api (optional)
- `burger-api.dev.platform-engineering-demo.dev` → burger-api (optional)

## Prerequisites

1. **GKE Cluster with Gateway API enabled**
2. **Static IP address reserved**
3. **Domain registered** (Namecheap)

## Setup Instructions

### Step 1: Enable Gateway API on GKE Cluster

If creating a new cluster:
```bash
gcloud container clusters create CLUSTER_NAME \
  --gateway-api=standard \
  --region=REGION
```

For existing cluster:
```bash
gcloud container clusters update CLUSTER_NAME \
  --gateway-api=standard \
  --region=REGION
```

### Step 2: Reserve Static IP Address

```bash
# Reserve a global static IP address
gcloud compute addresses create mcp-agent-gateway-ip \
  --global \
  --ip-version IPV4

# Get the IP address
gcloud compute addresses describe mcp-agent-gateway-ip --global --format="get(address)"
```

**Save this IP address** - you'll need it for DNS configuration.

### Step 3: Create Production Namespace

```bash
kubectl apply -f k8s/gateway/00-namespace-prod.yaml
```

### Step 4: Deploy Gateway (in default namespace)

```bash
kubectl apply -f k8s/gateway/01-gateway.yaml
```

This creates a shared Gateway in the `default` namespace that can be referenced by HTTPRoutes in any namespace.

**Wait for Gateway to be ready** (this can take 5-10 minutes):
```bash
kubectl get gateway shared-gateway -n default -w
```

You should see `PROGRAMMED` status become `True`.

### Step 5: Deploy HTTPRoutes

Deploy HTTPRoutes for both environments:

```bash
# Dev environment
kubectl apply -f k8s/gateway/02-httproute-dev.yaml

# Prod environment
kubectl apply -f k8s/gateway/03-httproute-prod.yaml
```

Check the HTTPRoute status:
```bash
# Dev
kubectl get httproute -n mcp-agent-dev

# Prod
kubectl get httproute -n mcp-agent-prod
```

### Step 6: Configure DNS in Namecheap

1. Log in to your Namecheap account
2. Go to Domain List → Manage `platform-engineering-demo.dev`
3. Go to Advanced DNS
4. Add the following A records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | [GATEWAY_IP] | Automatic |
| A Record | www | [GATEWAY_IP] | Automatic |
| A Record | burgers | [GATEWAY_IP] | Automatic |
| A Record | api | [GATEWAY_IP] | Automatic |
| A Record | burger-api | [GATEWAY_IP] | Automatic |
| A Record | dev | [GATEWAY_IP] | Automatic |
| A Record | *.dev | [GATEWAY_IP] | Automatic |

Where `[GATEWAY_IP]` is the static IP from Step 2.

**Note**: DNS propagation can take 5-60 minutes.

### Step 7: Verify Setup

Test DNS resolution:
```bash
# Production
dig platform-engineering-demo.dev
dig burgers.platform-engineering-demo.dev

# Development
dig dev.platform-engineering-demo.dev
dig burgers.dev.platform-engineering-demo.dev
```

Test HTTP access:
```bash
# Production
curl -v http://platform-engineering-demo.dev
curl -v http://burgers.platform-engineering-demo.dev

# Development
curl -v http://dev.platform-engineering-demo.dev
curl -v http://burgers.dev.platform-engineering-demo.dev
```

## Deploying Services to Production

You'll need to create service manifests for the `mcp-agent-prod` namespace similar to your dev environment. Example:

```bash
# Copy and modify dev manifests for prod
cp -r k8s/manifests k8s/manifests-prod

# Update namespace in all files
sed -i '' 's/mcp-agent-dev/mcp-agent-prod/g' k8s/manifests-prod/*.yaml

# Apply prod manifests
kubectl apply -f k8s/manifests-prod/
```

## Removing LoadBalancer Services

Since Gateway API will handle external traffic, you can remove the `type: LoadBalancer` from your services:

```yaml
# Before (with LoadBalancer)
apiVersion: v1
kind: Service
metadata:
  name: agent-webapp
spec:
  type: LoadBalancer  # Remove this
  ports:
  - port: 80

# After (with Gateway API)
apiVersion: v1
kind: Service
metadata:
  name: agent-webapp
spec:
  type: ClusterIP  # Change to ClusterIP
  ports:
  - port: 80
```

## Troubleshooting

### Check Gateway Status
```bash
kubectl describe gateway shared-gateway -n default
```

### Check HTTPRoute Status
```bash
kubectl describe httproute -n mcp-agent-dev
kubectl describe httproute -n mcp-agent-prod
```

### Check Gateway IP
```bash
kubectl get gateway shared-gateway -n default -o jsonpath='{.status.addresses[0].value}'
```

### View Gateway Controller Logs
```bash
# Gateway controller runs as part of GKE control plane
# Check events for issues
kubectl get events -n default | grep gateway
```

### Common Issues

1. **Gateway not getting IP address**
   - Ensure static IP name matches: `mcp-agent-gateway-ip`
   - Check static IP exists: `gcloud compute addresses list --global`

2. **HTTPRoute not working**
   - Verify service exists in the target namespace
   - Check service port matches HTTPRoute backendRef port
   - Ensure Gateway is in `PROGRAMMED` state

3. **502 Bad Gateway**
   - Service backend is not healthy
   - Check pod readiness: `kubectl get pods -n NAMESPACE`
   - Check service endpoints: `kubectl get endpoints -n NAMESPACE`

4. **DNS not resolving**
   - Wait for DNS propagation (up to 60 minutes)
   - Check Namecheap DNS settings are correct
   - Use `dig` to verify DNS records

## Updating Routes

To add or modify routes, edit the HTTPRoute files and reapply:

```bash
kubectl apply -f k8s/gateway/02-httproute-dev.yaml
kubectl apply -f k8s/gateway/03-httproute-prod.yaml
```

Changes are applied immediately by the Gateway controller.

## Adding HTTPS (Future Enhancement)

To add HTTPS support:

1. Update Gateway listener to include HTTPS
2. Configure TLS certificates (Google-managed or custom)
3. Update HTTPRoutes to reference HTTPS listener

Example:
```yaml
spec:
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: gateway-cert
```

## Cost Considerations

- **Global L7 Load Balancer**: ~$18/month base + $0.008 per GB processed
- **Static IP**: ~$3-4/month when in use
- **Certificate (if using Google-managed SSL)**: Free

## References

- [GKE Gateway API Documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/gateway-api)
- [Gateway API Specification](https://gateway-api.sigs.k8s.io/)
- [GKE Load Balancer Types](https://cloud.google.com/load-balancing/docs/choosing-load-balancer)
