# Kubernetes Session Affinity Options for MCP Multi-Replica Deployment

This document explores all available session affinity options for solving the MCP transport state issue when running burger-mcp with multiple replicas.

## Problem Statement

The burger-mcp server stores MCP transport state **in memory** (in the `transports` map). When running with multiple replicas behind a load balancer, requests from the same client can be routed to different pods, causing "No valid session ID provided" errors because the transport state doesn't exist on the new pod.

## Kubernetes Native Session Affinity Options

### Option 1: ClientIP Session Affinity (✅ CHOSEN)

**What it is**: Routes all requests from the same client IP address to the same pod.

**Configuration**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: burger-mcp
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 hours (default, max: 86400 = 1 day)
```

**Available Values**:
- `sessionAffinity`: Only 2 options exist in Kubernetes
  - `"ClientIP"` - Client IP based session affinity
  - `"None"` - No session affinity (default)

**Configuration Parameters**:
- `timeoutSeconds`: Duration to maintain sticky session
  - Must be: `>0 && <=86400` (1 day)
  - Default: `10800` (3 hours)
  - Our setting: `10800` (3 hours) - sufficient for typical chat sessions

**How it Works**:
1. First request from `agent-api` pod (IP: 10.0.1.5) goes to `burger-mcp` pod A
2. Kubernetes kube-proxy tracks this mapping for `timeoutSeconds`
3. All subsequent requests from 10.0.1.5 route to pod A
4. After timeout or pod restart, new mapping can be created

**Pros**:
- ✅ Native Kubernetes feature (no additional components)
- ✅ Simple configuration
- ✅ Works at network layer (kube-proxy handles it)
- ✅ No application code changes needed
- ✅ Works with ClusterIP services

**Cons**:
- ❌ Only based on source IP (cannot use headers like `mcp-session-id`)
- ❌ Doesn't work well with load balancers that hide client IP
- ❌ Timeout is fixed - can't extend dynamically
- ❌ Not sticky across pod restarts/rollouts

**Why It Works for Our Use Case**:
- ✅ `agent-api` pods have stable IPs within the cluster
- ✅ Direct ClusterIP service communication (no external load balancer)
- ✅ 3-hour timeout is longer than typical chat sessions
- ✅ Each `agent-api` pod connects from its own IP
- ✅ Simple and reliable

**Limitations**:
- If you're behind an Ingress/LoadBalancer, the Service might see the Ingress controller's IP instead of the real client IP
- X-Forwarded-For headers are NOT considered (Kubernetes Issue #36415)
- Sessions don't survive pod restarts or rolling updates of burger-mcp

### Option 2: None (Default)

**Configuration**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: burger-mcp
spec:
  sessionAffinity: None  # This is the default
```

**Behavior**: Round-robin or random distribution across all pods.

**Use Case**: Stateless services only.

**Why Not for MCP**: Breaks MCP transport state consistency.

## Alternative Approaches (Beyond Kubernetes Service)

### Option 3: Ingress Controller Session Affinity

**What it is**: Use Ingress controller features (NGINX, Traefik, etc.) for more sophisticated affinity.

**NGINX Ingress Example**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: burger-mcp-ingress
  annotations:
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/session-cookie-name: "mcp-session"
    nginx.ingress.kubernetes.io/session-cookie-expires: "10800"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "10800"
    # Header-based affinity (custom configuration)
    nginx.ingress.kubernetes.io/configuration-snippet: |
      set $affinity_key $http_mcp_session_id;
spec:
  rules:
  - host: burger-mcp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: burger-mcp
            port:
              number: 3000
```

**Pros**:
- ✅ Cookie-based affinity (survives pod restarts)
- ✅ Can use custom headers with configuration snippets
- ✅ More flexible timeout options
- ✅ Can persist affinity information

**Cons**:
- ❌ Requires Ingress controller (extra component)
- ❌ Only works for external traffic (not internal ClusterIP)
- ❌ More complex configuration
- ❌ Depends on Ingress controller features

**Why Not for Our Use Case**:
- ❌ burger-mcp is internal-only (ClusterIP, not exposed via Ingress)
- ❌ Adds unnecessary complexity for internal service-to-service communication

### Option 4: StatefulSet with Predictable Pod Names

**What it is**: Use StatefulSet instead of Deployment to get stable pod names/IPs.

**Configuration**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: burger-mcp
spec:
  serviceName: burger-mcp
  replicas: 2
  selector:
    matchLabels:
      app: burger-mcp
  template:
    # ... pod template
```

**Accessing Specific Pods**:
```bash
# Direct pod access via headless service
burger-mcp-0.burger-mcp.namespace.svc.cluster.local
burger-mcp-1.burger-mcp.namespace.svc.cluster.local
```

**Application Changes Needed**:
```typescript
// agent-api would need to track which burger-mcp pod to use
// Store in database: { sessionId: "abc", mcpPod: "burger-mcp-0" }
const mcpPodUrl = `http://${mcpPod}.burger-mcp:3000/mcp`;
```

**Pros**:
- ✅ Stable network identities
- ✅ Can implement custom routing logic
- ✅ Sessions survive pod restarts (same pod name)
- ✅ Complete control over routing

**Cons**:
- ❌ Requires significant application code changes
- ❌ Need to track pod assignments in database
- ❌ More complex deployment (StatefulSet vs Deployment)
- ❌ Manual pod selection logic in agent-api
- ❌ Doesn't handle pod failures gracefully

**Why Not for Our Use Case**:
- ❌ Too complex for the problem we're solving
- ❌ Requires rewriting connection logic in agent-api
- ❌ burger-mcp doesn't need StatefulSet features (no persistent volumes)

### Option 5: Shared State Storage (Redis/Database)

**What it is**: Store MCP transport state externally instead of in-memory.

**Architecture**:
```
agent-api --> burger-mcp pod 1 --> Redis (shared transport state)
          --> burger-mcp pod 2 --> Redis
```

**Required Changes**:
```typescript
// burger-mcp/src/server.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Store transport state in Redis instead of memory
const getTransport = async (sessionId: string) => {
  const data = await redis.get(`mcp:transport:${sessionId}`);
  // Deserialize and reconstruct transport
};

const setTransport = async (sessionId: string, transport: any) => {
  // Serialize and store transport state
  await redis.set(`mcp:transport:${sessionId}`, JSON.stringify(data));
};
```

**Pros**:
- ✅ True horizontal scaling without affinity
- ✅ Sessions survive pod restarts
- ✅ Any pod can handle any request
- ✅ Best for highly available systems

**Cons**:
- ❌ Requires external storage (Redis/Memcached)
- ❌ Complex serialization/deserialization of transport objects
- ❌ Network latency for every state access
- ❌ MCP transport objects might not be serializable
- ❌ Significant code refactoring required

**Why Not for Our Use Case**:
- ❌ MCP StreamableHTTPServerTransport likely not serializable
- ❌ Over-engineering for our scale
- ❌ Adds operational complexity (Redis maintenance)
- ❌ Would require forking/modifying MCP SDK

### Option 6: Single Replica (Simple but Not HA)

**Configuration**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: burger-mcp
spec:
  replicas: 1  # Only one pod
```

**Pros**:
- ✅ No session affinity needed
- ✅ Simplest possible solution
- ✅ No state consistency issues

**Cons**:
- ❌ Single point of failure
- ❌ No horizontal scaling
- ❌ Downtime during rolling updates
- ❌ Can't handle high load

**Why Not for Our Use Case**:
- ❌ Not production-ready (no HA)
- ❌ Defeats the purpose of Kubernetes orchestration

## Comparison Matrix

| Solution | Complexity | HA | Code Changes | State Persistence | Best For |
|----------|-----------|-----|--------------|-------------------|----------|
| **ClientIP Affinity** | ⭐ Low | ✅ Yes | ❌ None | ❌ Lost on restart | **Internal services with stable client IPs** |
| None (Round Robin) | ⭐ Lowest | ✅ Yes | ❌ None | ❌ N/A | Stateless services only |
| Ingress Affinity | ⭐⭐ Medium | ✅ Yes | ❌ None | ✅ Cookie-based | External-facing services |
| StatefulSet | ⭐⭐⭐ High | ⚠️ Partial | ✅ Major | ✅ Per-pod state | Databases, caches |
| Shared State | ⭐⭐⭐⭐ Very High | ✅ Yes | ✅ Major | ✅ Full | High-scale systems |
| Single Replica | ⭐ Lowest | ❌ No | ❌ None | ❌ N/A | Dev/test only |

## Decision: Why We Chose ClientIP Affinity

✅ **Our Choice**: `sessionAffinity: ClientIP` with 3-hour timeout

**Reasoning**:
1. **Minimal Complexity**: Zero code changes, simple YAML configuration
2. **Perfect Fit**: Internal ClusterIP service with stable client IPs
3. **Sufficient Timeout**: 3 hours > typical chat session duration
4. **Production Ready**: Native Kubernetes feature, battle-tested
5. **Easy Rollback**: Can easily change back to single replica if issues arise

**Trade-offs Accepted**:
- Sessions lost on burger-mcp pod restart → Acceptable (agent-api creates new session automatically)
- Based on IP only → Not an issue (internal service-to-service communication)
- Fixed timeout → Acceptable (3 hours is generous)

## Testing Session Affinity

### Verify Configuration

```bash
# Check if session affinity is configured
kubectl get svc burger-mcp -n mcp-agent-dev -o yaml | grep -A 3 sessionAffinity

# Expected output:
# sessionAffinity: ClientIP
# sessionAffinityConfig:
#   clientIP:
#     timeoutSeconds: 10800
```

### Test Stickiness

```bash
# Get pod IPs
kubectl get pods -n mcp-agent-dev -l service=burger-mcp -o wide

# Make multiple requests and check which pod handles them
# (They should go to the same pod from the same client)
for i in {1..10}; do
  kubectl logs -n mcp-agent-dev deployment/agent-api --tail=5 | grep "MCP session"
  sleep 2
done
```

### Monitor Session Distribution

```bash
# Check request distribution across pods
kubectl top pods -n mcp-agent-dev -l service=burger-mcp

# If affinity works correctly, one pod should have higher traffic
# based on which agent-api pod is more active
```

## Future Considerations

If we need more sophisticated session management in the future:

1. **Outgrow ClientIP Affinity**:
   - If we add external Ingress to burger-mcp
   - If we need session persistence across pod restarts
   - If we need to scale beyond 2-3 replicas

2. **Consider Ingress-based Affinity**:
   - If burger-mcp becomes externally accessible
   - If we need cookie-based persistence
   - If we need header-based routing (`mcp-session-id`)

3. **Consider Shared State**:
   - If we need true horizontal scaling (10+ replicas)
   - If session persistence is critical
   - If downtime during deployments is unacceptable

## References

- [Kubernetes Service API - sessionAffinity](https://kubernetes.io/docs/reference/kubernetes-api/service-resources/service-v1/#ServiceSpec)
- [Kubernetes Service - Virtual IPs and Service Proxies](https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies)
- [NGINX Ingress - Session Affinity](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#session-affinity)
- [Kubernetes Issue #36415 - X-Forwarded-For with ClientIP](https://github.com/kubernetes/kubernetes/issues/36415)
- [Kubernetes Issue #57402 - Header-based Session Affinity](https://github.com/kubernetes/kubernetes/issues/57402)

## Related Files

- [k8s/base/burger-mcp.yaml](k8s/base/burger-mcp.yaml) - Service configuration with ClientIP affinity
- [packages/burger-mcp/src/server.ts](packages/burger-mcp/src/server.ts) - Transport state management
- [packages/agent-api/src/express-server.ts](packages/agent-api/src/express-server.ts) - MCP client connection logic
