# Migration from LoadBalancer Services to Gateway API

## Before: LoadBalancer Services

### Architecture
```
┌────────────────────────────────────────────┐
│  agent-webapp Service (LoadBalancer)       │
│  External IP: 34.87.159.194                │
└────────────────────────────────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ agent-webapp pods│
         └──────────────────┘

┌────────────────────────────────────────────┐
│  burger-webapp Service (LoadBalancer)      │
│  External IP: 34.142.228.102               │
└────────────────────────────────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ burger-webapp pods│
         └──────────────────┘
```

### Costs (Approximate)
- **2 Load Balancers** × $18/month = **$36/month**
- Plus $0.008 per GB processed per LB
- Each service gets its own IP address
- Total: **~$40-50/month** (depending on traffic)

### Limitations
1. ❌ No domain names (using raw IPs)
2. ❌ No host-based routing
3. ❌ Multiple IPs to manage
4. ❌ Expensive (one LB per service)
5. ❌ No SSL/TLS termination
6. ❌ Limited L7 features

## After: Gateway API

### Architecture
```
┌─────────────────────────────────────────────┐
│         Shared Gateway (1 Load Balancer)    │
│         Static IP: [SINGLE IP]              │
│         Domain: platform-engineering-demo.dev│
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Dev          │      │ Prod         │
│ HTTPRoute    │      │ HTTPRoute    │
└──────┬───────┘      └──────┬───────┘
       │                     │
       ▼                     ▼
  Services              Services
```

### Costs (Approximate)
- **1 Load Balancer** × $18/month = **$18/month**
- Plus $0.008 per GB processed (total for all services)
- **1 Static IP** × $3/month = **$3/month**
- Total: **~$21-25/month** (50% cost savings!)

### Benefits
1. ✅ Custom domains (dev.platform-engineering-demo.dev, platform-engineering-demo.dev)
2. ✅ Host-based routing (multiple domains → single IP)
3. ✅ Single IP to manage
4. ✅ 50% cost reduction
5. ✅ Ready for SSL/TLS (easy to add)
6. ✅ Advanced L7 features (retries, timeouts, etc.)
7. ✅ Multi-tenant isolation
8. ✅ Centralized management

## Migration Steps

### Step 1: Current State (No Changes Yet)
Your services still use LoadBalancer type:
- agent-webapp: 34.87.159.194
- burger-webapp: 34.142.228.102

### Step 2: Run Gateway Setup
```bash
cd k8s/gateway
./setup-gateway.sh
```

This will:
1. Enable Gateway API on your GKE cluster
2. Reserve a static IP address
3. Create the shared Gateway
4. Deploy HTTPRoutes for dev and prod

### Step 3: Configure DNS in Namecheap
Point all domains to the new Gateway IP (provided by setup script).

### Step 4: Test Gateway (Before Migrating Services)
Once DNS propagates:
```bash
# Test dev
curl -v http://dev.platform-engineering-demo.dev

# Test prod (after deploying prod namespace)
curl -v http://platform-engineering-demo.dev
```

### Step 5: Update Services to ClusterIP (Optional)
Once Gateway is working, you can remove LoadBalancer type to save costs:

**Before:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-webapp
spec:
  type: LoadBalancer  # Remove this
  ports:
  - port: 80
    targetPort: 80
```

**After:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: agent-webapp
spec:
  type: ClusterIP  # Change to ClusterIP
  ports:
  - port: 80
    targetPort: 80
```

Apply the changes:
```bash
kubectl apply -f k8s/manifests/agent-webapp.yaml
kubectl apply -f k8s/manifests/burger-webapp.yaml
```

### Step 6: Verify and Cleanup
```bash
# Verify services are ClusterIP
kubectl get svc -n mcp-agent-dev

# Old LoadBalancer IPs will be released automatically
# Check load balancers in GCP Console to confirm deletion
```

## Rollback Plan

If something goes wrong, you can rollback:

1. **Revert services to LoadBalancer type**
   ```bash
   # Edit service manifests back to type: LoadBalancer
   kubectl apply -f k8s/manifests/
   ```

2. **Delete Gateway resources**
   ```bash
   kubectl delete httproute mcp-agent-dev-route -n mcp-agent-dev
   kubectl delete httproute mcp-agent-prod-route -n mcp-agent-prod
   kubectl delete gateway shared-gateway -n shared-infra
   ```

3. **Point DNS back to old IPs**
   - dev.platform-engineering-demo.dev → 34.87.159.194
   - burgers.dev.platform-engineering-demo.dev → 34.142.228.102

## Comparison Table

| Feature | LoadBalancer Services | Gateway API |
|---------|----------------------|-------------|
| **Cost** | $40-50/month | $21-25/month |
| **# of Load Balancers** | 2+ (one per service) | 1 (shared) |
| **IP Addresses** | Multiple (one per service) | Single static IP |
| **Domain Support** | ❌ No | ✅ Yes |
| **Host-based Routing** | ❌ No | ✅ Yes |
| **SSL/TLS** | ❌ Manual setup | ✅ Easy (Google-managed) |
| **Path-based Routing** | ❌ No | ✅ Yes |
| **Header-based Routing** | ❌ No | ✅ Yes |
| **Traffic Policies** | ❌ Limited | ✅ Advanced |
| **Multi-tenant Isolation** | ❌ No | ✅ Yes |
| **Centralized Management** | ❌ No | ✅ Yes |
| **Environment Separation** | Physical (diff IPs) | Logical (same IP, diff routes) |

## Testing Checklist

After migration, verify:

### Development Environment
- [ ] `http://dev.platform-engineering-demo.dev` → agent-webapp (loads UI)
- [ ] `http://burgers.dev.platform-engineering-demo.dev` → burger-webapp (loads UI)
- [ ] `http://api.dev.platform-engineering-demo.dev/api/me` → agent-api (returns JSON)
- [ ] `http://burger-api.dev.platform-engineering-demo.dev/api` → burger-api (returns JSON)
- [ ] Image URLs work (via agent-webapp proxy)

### Production Environment
- [ ] `http://platform-engineering-demo.dev` → agent-webapp (loads UI)
- [ ] `http://www.platform-engineering-demo.dev` → agent-webapp (loads UI)
- [ ] `http://burgers.platform-engineering-demo.dev` → burger-webapp (loads UI)
- [ ] `http://api.platform-engineering-demo.dev/api/me` → agent-api (returns JSON)
- [ ] `http://burger-api.platform-engineering-demo.dev/api` → burger-api (returns JSON)

### Gateway Health
- [ ] Gateway shows "Programmed" status: `kubectl get gateway -n shared-infra`
- [ ] HTTPRoutes accepted: `kubectl get httproute --all-namespaces`
- [ ] No errors in events: `kubectl get events -n shared-infra`

## Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| **Setup** | 30 minutes | Run setup-gateway.sh, configure DNS |
| **DNS Propagation** | 5-60 minutes | Wait for DNS records to propagate |
| **Testing** | 15 minutes | Verify all endpoints work |
| **Migration** | 10 minutes | Convert services to ClusterIP (optional) |
| **Verification** | 15 minutes | Final checks |
| **Total** | **1-2 hours** | Including DNS propagation time |

## Troubleshooting

### Gateway not getting IP
```bash
# Check Gateway status
kubectl describe gateway shared-gateway -n shared-infra

# Verify static IP exists
gcloud compute addresses list --global
```

### HTTPRoute not working
```bash
# Check HTTPRoute status
kubectl describe httproute -n mcp-agent-dev

# Verify namespace has correct label
kubectl get namespace mcp-agent-dev --show-labels
```

### 404 errors
```bash
# Check backend services exist
kubectl get svc -n mcp-agent-dev
kubectl get endpoints -n mcp-agent-dev

# Verify pods are running
kubectl get pods -n mcp-agent-dev
```

### DNS not resolving
```bash
# Check DNS records
dig dev.platform-engineering-demo.dev

# Verify IP matches Gateway IP
kubectl get gateway shared-gateway -n shared-infra -o jsonpath='{.status.addresses[0].value}'
```

## Support

If you encounter issues:
1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
2. Review [README.md](./README.md) for detailed troubleshooting
3. Check GCP Console → Network Services → Load Balancing
4. Review Gateway logs in Cloud Logging
