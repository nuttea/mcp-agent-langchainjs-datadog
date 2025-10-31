# Gateway API Architecture - Multi-Tenant Pattern

## Overview

This setup follows the **GKE Multi-Tenant Shared Gateway** pattern (similar to [example 3](https://github.com/GoogleCloudPlatform/gke-networking-recipes/blob/main/gateway/gke-gateway-controller/ex3-multi-tenant-gw.yaml)) where:

- One shared Gateway in a dedicated infrastructure namespace
- Multiple tenant namespaces (dev, prod) with their own HTTPRoutes
- Label-based access control for cross-namespace routing

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Internet Traffic                              │
│                 platform-engineering-demo.dev                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ DNS → Static IP
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│              GCP Global L7 Load Balancer                         │
│                 (External HTTPS/HTTP)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                  shared-infra Namespace                          │
│                                                                  │
│    ┌────────────────────────────────────────────────┐          │
│    │          Gateway: shared-gateway               │          │
│    │  Class: gke-l7-global-external-managed         │          │
│    │  Static IP: mcp-agent-gateway-ip               │          │
│    │                                                 │          │
│    │  Listener:                                      │          │
│    │    - name: http                                 │          │
│    │    - protocol: HTTP                             │          │
│    │    - port: 80                                   │          │
│    │    - allowedRoutes:                             │          │
│    │        namespaces:                              │          │
│    │          from: Selector                         │          │
│    │          selector:                              │          │
│    │            shared-gateway-access: "true"        │          │
│    └─────────────┬──────────────────────────────────┘          │
│                  │                                               │
└──────────────────┼───────────────────────────────────────────────┘
                   │
                   │ Routes from namespaces with label
                   │ "shared-gateway-access: true"
                   │
     ┌─────────────┴─────────────┐
     │                           │
     │                           │
┌────▼──────────────────┐   ┌───▼──────────────────┐
│ mcp-agent-dev         │   │ mcp-agent-prod       │
│ Label:                │   │ Label:               │
│   shared-gateway-     │   │   shared-gateway-    │
│   access: "true"      │   │   access: "true"     │
│                       │   │                      │
│ ┌──────────────────┐ │   │ ┌──────────────────┐ │
│ │   HTTPRoute      │ │   │ │   HTTPRoute      │ │
│ │   dev-route      │ │   │ │   prod-route     │ │
│ └────────┬─────────┘ │   │ └────────┬─────────┘ │
│          │           │   │          │           │
│  Hostnames:          │   │  Hostnames:          │
│  - dev.domain.dev    │   │  - domain.dev        │
│  - *.dev.domain.dev  │   │  - www.domain.dev    │
│          │           │   │  - burgers.domain.dev│
│          │           │   │          │           │
│    ┌─────▼────────┐  │   │    ┌─────▼────────┐  │
│    │              │  │   │    │              │  │
│    │  Services:   │  │   │    │  Services:   │  │
│    │              │  │   │    │              │  │
│    │ agent-webapp │  │   │    │ agent-webapp │  │
│    │ burger-webapp│  │   │    │ burger-webapp│  │
│    │ agent-api    │  │   │    │ agent-api    │  │
│    │ burger-api   │  │   │    │ burger-api   │  │
│    │              │  │   │    │              │  │
│    └──────────────┘  │   │    └──────────────┘  │
│                      │   │                      │
└──────────────────────┘   └──────────────────────┘
```

## Traffic Flow

### Development Traffic

```
User Request: http://dev.platform-engineering-demo.dev
         ↓
    DNS Resolution → Static IP
         ↓
  GCP Load Balancer
         ↓
  shared-gateway (shared-infra namespace)
         ↓
  Matches HTTPRoute in mcp-agent-dev namespace
         ↓
  Routes to: agent-webapp service (mcp-agent-dev)
         ↓
  Backend Pods
```

### Production Traffic

```
User Request: http://platform-engineering-demo.dev
         ↓
    DNS Resolution → Static IP
         ↓
  GCP Load Balancer
         ↓
  shared-gateway (shared-infra namespace)
         ↓
  Matches HTTPRoute in mcp-agent-prod namespace
         ↓
  Routes to: agent-webapp service (mcp-agent-prod)
         ↓
  Backend Pods
```

## Namespace Structure

### shared-infra
**Purpose**: Infrastructure namespace for shared Gateway
**Contains**:
- Gateway resource (shared-gateway)
- No application workloads

### mcp-agent-dev
**Purpose**: Development environment
**Label**: `shared-gateway-access: "true"`
**Contains**:
- HTTPRoute (mcp-agent-dev-route)
- Services: agent-webapp, burger-webapp, agent-api, burger-api
- Deployments, ConfigMaps, Secrets

**Hostnames**:
- `dev.platform-engineering-demo.dev` → agent-webapp
- `burgers.dev.platform-engineering-demo.dev` → burger-webapp
- `api.dev.platform-engineering-demo.dev` → agent-api
- `burger-api.dev.platform-engineering-demo.dev` → burger-api

### mcp-agent-prod
**Purpose**: Production environment
**Label**: `shared-gateway-access: "true"`
**Contains**:
- HTTPRoute (mcp-agent-prod-route)
- Services: agent-webapp, burger-webapp, agent-api, burger-api
- Deployments, ConfigMaps, Secrets

**Hostnames**:
- `platform-engineering-demo.dev` → agent-webapp
- `www.platform-engineering-demo.dev` → agent-webapp
- `burgers.platform-engineering-demo.dev` → burger-webapp
- `api.platform-engineering-demo.dev` → agent-api
- `burger-api.platform-engineering-demo.dev` → burger-api

## Security & Isolation

### Cross-Namespace Access Control

The Gateway uses **label-based selection** to control which namespaces can attach HTTPRoutes:

```yaml
allowedRoutes:
  namespaces:
    from: Selector
    selector:
      matchLabels:
        shared-gateway-access: "true"
```

Only namespaces with the label `shared-gateway-access: "true"` can create HTTPRoutes that attach to the shared Gateway.

### Benefits

1. **Cost Efficiency**: One load balancer serves multiple environments
2. **Centralized Management**: Gateway config managed in dedicated namespace
3. **Team Isolation**: Each team manages their own HTTPRoutes in their namespace
4. **Secure Multi-Tenancy**: Label-based access control
5. **Easy Scaling**: Add new environments by creating namespace + HTTPRoute

## DNS Configuration

All domains point to the same static IP address:

| Domain | Type | Value |
|--------|------|-------|
| platform-engineering-demo.dev | A | [GATEWAY_IP] |
| www.platform-engineering-demo.dev | A | [GATEWAY_IP] |
| burgers.platform-engineering-demo.dev | A | [GATEWAY_IP] |
| api.platform-engineering-demo.dev | A | [GATEWAY_IP] |
| burger-api.platform-engineering-demo.dev | A | [GATEWAY_IP] |
| dev.platform-engineering-demo.dev | A | [GATEWAY_IP] |
| *.dev.platform-engineering-demo.dev | A | [GATEWAY_IP] |

The Gateway routes traffic to the correct backend based on the `Host` header in the HTTP request.

## Comparison: Multi-Tenant vs Other Patterns

### Multi-Tenant Shared Gateway (This Setup)
✅ **Pros**:
- One load balancer for all environments (cost-effective)
- Centralized gateway management
- Easy to add new tenants/environments
- Label-based security

❌ **Cons**:
- Shared fate (if gateway fails, all environments affected)
- Requires coordination for gateway upgrades

### Gateway Per Namespace
✅ **Pros**:
- Complete isolation between environments
- Independent lifecycle management

❌ **Cons**:
- Multiple load balancers (higher cost)
- More complex DNS management

### Service LoadBalancer (Previous Setup)
✅ **Pros**:
- Simple, direct L4 routing

❌ **Cons**:
- One LoadBalancer per service (very expensive)
- No host-based routing
- Limited HTTP features

## Future Enhancements

1. **HTTPS Support**
   - Add TLS certificates (Google-managed or cert-manager)
   - Update listener to support HTTPS on port 443
   - HTTP → HTTPS redirect

2. **Traffic Policies**
   - Request timeout configuration
   - Retry policies
   - Rate limiting

3. **Advanced Routing**
   - Header-based routing
   - Path-based routing within services
   - Traffic splitting for canary deployments

4. **Monitoring**
   - Gateway metrics in Cloud Monitoring
   - Request logs in Cloud Logging
   - Datadog APM integration

5. **Additional Environments**
   - Staging namespace (mcp-agent-staging)
   - QA namespace (mcp-agent-qa)
   - Add corresponding HTTPRoutes
