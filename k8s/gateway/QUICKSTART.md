# Gateway API Quick Start Guide

## TL;DR - Quick Setup Commands

```bash
# 1. Enable Gateway API on your GKE cluster
gcloud container clusters update mcp-agent-cluster \
  --gateway-api=standard \
  --region=asia-southeast1

# 2. Reserve static IP
gcloud compute addresses create mcp-agent-gateway-ip \
  --global \
  --ip-version IPV4

# 3. Get the IP address (save this for DNS)
GATEWAY_IP=$(gcloud compute addresses describe mcp-agent-gateway-ip --global --format="get(address)")
echo "Gateway IP: $GATEWAY_IP"

# 4. Apply all Gateway resources
kubectl apply -f k8s/gateway/00-namespace-prod.yaml
kubectl apply -f k8s/gateway/01-gateway.yaml

# Wait for Gateway to be ready (5-10 minutes)
kubectl wait --for=condition=Programmed gateway/shared-gateway -n default --timeout=600s

# 5. Apply HTTPRoutes
kubectl apply -f k8s/gateway/02-httproute-dev.yaml
kubectl apply -f k8s/gateway/03-httproute-prod.yaml

# 6. Verify
kubectl get gateway -n default
kubectl get httproute -n mcp-agent-dev
kubectl get httproute -n mcp-agent-prod
```

## DNS Configuration in Namecheap

After getting your `GATEWAY_IP`, configure these DNS records in Namecheap:

### Advanced DNS → Add New Record

**Production Records:**
```
Type: A Record | Host: @ | Value: [GATEWAY_IP] | TTL: Automatic
Type: A Record | Host: www | Value: [GATEWAY_IP] | TTL: Automatic
Type: A Record | Host: burgers | Value: [GATEWAY_IP] | TTL: Automatic
Type: A Record | Host: api | Value: [GATEWAY_IP] | TTL: Automatic
Type: A Record | Host: burger-api | Value: [GATEWAY_IP] | TTL: Automatic
```

**Development Records:**
```
Type: A Record | Host: dev | Value: [GATEWAY_IP] | TTL: Automatic
Type: A Record | Host: *.dev | Value: [GATEWAY_IP] | TTL: Automatic
```

## Testing Your Setup

```bash
# Wait for DNS propagation (5-60 minutes)
dig platform-engineering-demo.dev

# Test HTTP endpoints
curl -I http://platform-engineering-demo.dev
curl -I http://dev.platform-engineering-demo.dev
curl -I http://burgers.platform-engineering-demo.dev
curl -I http://burgers.dev.platform-engineering-demo.dev
```

## Domain Mapping Summary

| Domain | Environment | Service | Namespace |
|--------|-------------|---------|-----------|
| platform-engineering-demo.dev | Production | agent-webapp | mcp-agent-prod |
| www.platform-engineering-demo.dev | Production | agent-webapp | mcp-agent-prod |
| burgers.platform-engineering-demo.dev | Production | burger-webapp | mcp-agent-prod |
| api.platform-engineering-demo.dev | Production | agent-api | mcp-agent-prod |
| burger-api.platform-engineering-demo.dev | Production | burger-api | mcp-agent-prod |
| dev.platform-engineering-demo.dev | Development | agent-webapp | mcp-agent-dev |
| burgers.dev.platform-engineering-demo.dev | Development | burger-webapp | mcp-agent-dev |
| api.dev.platform-engineering-demo.dev | Development | agent-api | mcp-agent-dev |
| burger-api.dev.platform-engineering-demo.dev | Development | burger-api | mcp-agent-dev |

## Next Steps

1. **Deploy Production Environment**
   ```bash
   # Copy manifests to prod
   cp -r k8s/manifests k8s/manifests-prod

   # Update namespace references
   find k8s/manifests-prod -type f -name "*.yaml" -exec sed -i '' 's/mcp-agent-dev/mcp-agent-prod/g' {} \;

   # Apply
   kubectl apply -f k8s/manifests-prod/
   ```

2. **Remove Old LoadBalancers** (optional)
   - Update service types from `LoadBalancer` to `ClusterIP` in your manifests
   - This will save costs since Gateway handles external traffic

3. **Add HTTPS** (recommended for production)
   - See main README.md for HTTPS configuration
   - Use Google-managed SSL certificates (free)

## Troubleshooting One-Liners

```bash
# Check Gateway status
kubectl get gateway shared-gateway -n default -o wide

# Get Gateway IP
kubectl get gateway shared-gateway -n default -o jsonpath='{.status.addresses[0].value}'

# Check HTTPRoute status
kubectl describe httproute -n mcp-agent-dev

# Check if backend services exist
kubectl get svc -n mcp-agent-dev
kubectl get svc -n mcp-agent-prod

# View recent events
kubectl get events -n default --sort-by='.lastTimestamp' | grep gateway
```

## Important Notes

- Gateway provisioning takes **5-10 minutes**
- DNS propagation takes **5-60 minutes**
- Total setup time: **15-70 minutes** from start to working domains
- The shared Gateway lives in the `default` namespace but routes to services in any namespace
- Services must be `ClusterIP` or `LoadBalancer` type (not `NodePort`)
