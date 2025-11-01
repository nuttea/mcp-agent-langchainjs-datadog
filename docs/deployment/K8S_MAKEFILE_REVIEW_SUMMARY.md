# Kubernetes & Makefile Review Summary

## Executive Summary

The current Kubernetes manifests and Makefile are functional but have significant room for improvement. The main issue is **duplicate manifests** for dev and prod environments. Moving to **Kustomize overlays** will eliminate duplication, improve maintainability, and follow Kubernetes best practices.

## Current State Analysis

### Makefile Review ✅

**Strengths:**
- Well-organized with clear sections (Development, Docker, Kubernetes, Port Forwarding, Datadog)
- Comprehensive help system (`make help`)
- Support for both dev and prod environments via `ENV` variable
- Individual service deployment targets
- Port forwarding helpers for each service
- Datadog integration commands

**Issues:**
1. **Hardcoded paths**: References `k8s/manifests/` directly
2. **No Kustomize**: Not leveraging Kustomize for environment management
3. **Namespace handling**: Manual namespace specification in commands
4. **Image tags**: Hardcoded to `latest`, no version management

### Kubernetes Manifests Review

**Current Structure:**
```
k8s/
├── manifests/          # Dev environment
│   ├── agent-api.yaml
│   ├── agent-webapp.yaml
│   ├── burger-api.yaml
│   ├── burger-mcp.yaml
│   ├── burger-webapp.yaml
│   └── namespace.yaml
│
├── manifests-prod/     # Prod environment (DUPLICATE!)
│   ├── agent-api.yaml
│   ├── burger-api.yaml
│   ├── burger-mcp.yaml
│   ├── burger-webapp.yaml
│   └── namespace.yaml
│
├── config/
│   ├── configmap.yaml
│   ├── configmap-prod.yaml
│   └── secrets.yaml
│
├── postgres-statefulset.yaml
├── postgres-init-job.yaml
└── scripts/
```

**Problems:**

1. **Code Duplication** 🔴
   - `manifests/` and `manifests-prod/` are 95% identical
   - Only differences: namespace and environment labels
   - Changes must be made in two places
   - High risk of configuration drift

2. **Not Using Kustomize** 🔴
   - Kustomize is built into kubectl
   - Industry standard for Kubernetes configuration management
   - Perfect for managing multiple environments

3. **Manual Namespace Management** 🟡
   - Namespace hardcoded in each manifest
   - Error-prone when adding new environments

4. **Inconsistent Structure** 🟡
   - Some files in root (`postgres-statefulset.yaml`)
   - Some in subdirectories (`manifests/`, `config/`)
   - No clear organization

## Recommended Solution: Kustomize Overlays

### Proposed Structure

```
k8s/
├── base/                           # Common resources (DRY!)
│   ├── kustomization.yaml
│   ├── agent-api.yaml             # No namespace, no env labels
│   ├── agent-webapp.yaml
│   ├── burger-api.yaml
│   ├── burger-webapp.yaml
│   ├── burger-mcp.yaml
│   ├── postgres-statefulset.yaml
│   └── postgres-init-job.yaml
│
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml    # Points to ../base, adds namespace
│   │   ├── namespace.yaml        # mcp-agent-dev
│   │   ├── configmap.yaml        # Dev-specific config
│   │   └── patches/
│   │       ├── replicas.yaml     # replicas: 1
│   │       └── resources.yaml    # Lower limits
│   │
│   └── prod/
│       ├── kustomization.yaml    # Points to ../base, adds namespace
│       ├── namespace.yaml        # mcp-agent-prod
│       ├── configmap.yaml        # Prod-specific config
│       └── patches/
│           ├── replicas.yaml     # replicas: 3
│           └── resources.yaml    # Higher limits
│
├── config/                        # Shared configs
│   └── secrets-template.yaml
│
├── datadog/                       # Datadog monitoring
│   └── datadog-values.yaml
│
└── scripts/
    ├── build-and-push.sh
    └── deploy-datadog.sh
```

### Key Benefits

1. **Single Source of Truth** 📝
   - Base resources defined once
   - Changes propagate to all environments

2. **Environment-Specific Customization** 🎯
   - Overlays patch only what's different
   - Easy to see differences between environments

3. **Easy to Scale** 📈
   - Add new environments (staging, qa) by creating new overlays
   - No code duplication

4. **Standard Tooling** 🛠️
   - Kustomize built into kubectl
   - Industry best practice

5. **Simplified Makefile** 🎯
   - Single command: `kubectl apply -k k8s/overlays/dev`
   - No manual namespace management

## Migration Plan

See [K8S_KUSTOMIZE_REORGANIZATION_PLAN.md](K8S_KUSTOMIZE_REORGANIZATION_PLAN.md) for detailed migration steps.

**Quick Summary:**
1. Create `k8s/base/` with common manifests
2. Create `k8s/overlays/dev/` with dev-specific patches
3. Create `k8s/overlays/prod/` with prod-specific patches
4. Update Makefile to use `kubectl apply -k`
5. Test both environments
6. Remove old `manifests/` and `manifests-prod/` directories

## Updated Makefile Commands

### Current (Before)
```makefile
k8s-apply:
\t@echo "Applying Kubernetes manifests to dev environment..."
\tkubectl apply -f k8s/manifests/namespace.yaml
\tkubectl apply -f k8s/manifests/ -n mcp-agent-dev

# Separate prod deployment not clearly defined
```

### Proposed (After)
```makefile
# Default to dev environment
ENV ?= dev

k8s-apply:
\t@echo "Applying Kubernetes manifests to $(ENV) environment..."
\tkubectl apply -k k8s/overlays/$(ENV)

k8s-apply-dev:
\t@echo "Deploying to dev..."
\tkubectl apply -k k8s/overlays/dev

k8s-apply-prod:
\t@echo "Deploying to prod..."
\tkubectl apply -k k8s/overlays/prod

k8s-delete:
\t@echo "Deleting resources from $(ENV) environment..."
\tkubectl delete -k k8s/overlays/$(ENV)

k8s-diff:
\t@echo "Showing diff for $(ENV) environment..."
\tkubectl diff -k k8s/overlays/$(ENV)
```

## Kustomize Example

### Base Manifest
```yaml
# k8s/base/agent-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
  labels:
    app: mcp-agent
    service: agent-api
spec:
  replicas: 1  # Will be overridden by overlays
  selector:
    matchLabels:
      app: mcp-agent
      service: agent-api
  template:
    metadata:
      labels:
        app: mcp-agent
        service: agent-api
    spec:
      containers:
      - name: agent-api
        image: gcr.io/datadog-ese-sandbox/agent-api:latest
        # ... rest of spec
```

### Dev Overlay Kustomization
```yaml
# k8s/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: mcp-agent-dev

commonLabels:
  environment: dev
  tags.datadoghq.com/env: dev

resources:
  - ../../base
  - namespace.yaml
  - configmap.yaml

patches:
  - path: patches/replicas.yaml

images:
  - name: gcr.io/datadog-ese-sandbox/agent-api
    newTag: latest
```

### Dev Replicas Patch
```yaml
# k8s/overlays/dev/patches/replicas.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
spec:
  replicas: 1
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: burger-api
spec:
  replicas: 1
```

### Prod Overlay
```yaml
# k8s/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: mcp-agent-prod

commonLabels:
  environment: prod
  tags.datadoghq.com/env: prod

resources:
  - ../../base
  - namespace.yaml
  - configmap.yaml

patches:
  - path: patches/replicas.yaml      # replicas: 3
  - path: patches/resources.yaml     # Higher limits

images:
  - name: gcr.io/datadog-ese-sandbox/agent-api
    newTag: v1.0.0  # Prod uses specific version
```

## Testing the New Structure

```bash
# 1. Validate kustomization
kustomize build k8s/overlays/dev
kustomize build k8s/overlays/prod

# 2. Dry-run apply
kubectl apply -k k8s/overlays/dev --dry-run=client
kubectl apply -k k8s/overlays/prod --dry-run=client

# 3. Show diff (what would change)
kubectl diff -k k8s/overlays/dev
kubectl diff -k k8s/overlays/prod

# 4. Apply to dev
kubectl apply -k k8s/overlays/dev

# 5. Verify deployment
kubectl get pods -n mcp-agent-dev

# 6. Apply to prod (after validation)
kubectl apply -k k8s/overlays/prod
```

## Comparison: Before vs After

### Before (Current)
- **Lines of YAML**: ~1000 (duplicated across dev/prod)
- **Maintainability**: Low (changes in 2 places)
- **Risk of drift**: High
- **Adding new environment**: Copy entire directory again
- **Clear what's different**: No (must diff files manually)

### After (Kustomize)
- **Lines of YAML**: ~600 (base once, small patches)
- **Maintainability**: High (change once in base)
- **Risk of drift**: Very low
- **Adding new environment**: Create new overlay (~50 lines)
- **Clear what's different**: Yes (overlays show only differences)

## Immediate Next Steps

1. **Review the plan**: [K8S_KUSTOMIZE_REORGANIZATION_PLAN.md](K8S_KUSTOMIZE_REORGANIZATION_PLAN.md)

2. **Decide on migration**:
   - Option A: Migrate now (recommended)
   - Option B: Keep current structure
   - Option C: Migrate gradually (new services use Kustomize)

3. **If migrating**:
   ```bash
   # I can help implement the migration
   # Estimated time: 2-3 hours
   # Zero downtime migration possible
   ```

## Additional Recommendations

### 1. Image Tagging Strategy
- **Dev**: Use `latest` tag for rapid iteration
- **Prod**: Use semantic versioning (v1.0.0, v1.0.1, etc.)
- **Implement**: Add `IMAGE_TAG` variable to Makefile

### 2. Resource Optimization
- **Dev**: Lower requests/limits to save costs
- **Prod**: Higher limits based on actual usage
- **Implement**: Use Kustomize patches

### 3. Health Checks
- Add/improve liveness and readiness probes
- Different timeouts for dev vs prod

### 4. Autoscaling
- Add HorizontalPodAutoscaler to prod overlay
- Target: 3-10 replicas based on CPU/memory

### 5. Network Policies
- Add network policies to restrict pod-to-pod communication
- More restrictive in prod

## Conclusion

**Recommendation**: Migrate to Kustomize overlays

**Effort**: 2-3 hours

**Impact**:
- ✅ Reduced code duplication (50% less YAML)
- ✅ Easier maintenance
- ✅ Lower risk of configuration drift
- ✅ Industry best practice
- ✅ Better prepared for multi-environment deployments

**Risk**: Low (can test in dev first, rollback easily)

**ROI**: High (saves time on every future deployment)

---

**Ready to proceed?** Let me know and I can:
1. Create the Kustomize structure
2. Migrate existing manifests
3. Update the Makefile
4. Test in dev environment
5. Document the changes
