# Kubernetes Structure Restructuring Plan

## Objective
Separate Kubernetes resource types into different directories to enable proper canary deployment strategy where:
1. Infrastructure (ConfigMaps, Secrets, etc.) is deployed first
2. Services are deployed second
3. Canary Deployments are created and validated
4. **Only after Datadog Deployment Gate passes**, main Deployments are updated

## Current Structure Problem

**Current `k8s/base/` structure:**
```
k8s/base/
├── agent-api.yaml           # Contains: Deployment + Service
├── agent-webapp.yaml         # Contains: Deployment + Service
├── burger-api.yaml           # Contains: Deployment + Service
├── burger-mcp.yaml           # Contains: Deployment + Service
├── burger-webapp.yaml        # Contains: Deployment + Service
├── configmap.yaml
├── postgres-statefulset.yaml # Contains: StatefulSet + Service
├── postgres-init-job.yaml    # Contains: Job + ConfigMap
├── hpa-agent-api.yaml
├── hpa-burger-api.yaml
├── hpa-burger-mcp.yaml
├── pod-disruption-budgets.yaml
└── kustomization.yaml
```

**Problem**: When running `kubectl apply -k k8s/overlays/prod`:
- ALL resources are applied at once
- Deployments are updated immediately
- Can't do proper canary testing before updating main deployments
- Datadog Deployment Gate is useless (main deployments already updated)

## New Structure

```
k8s/base/
├── deployments/
│   ├── agent-api.yaml
│   ├── agent-webapp.yaml
│   ├── burger-api.yaml
│   ├── burger-mcp.yaml
│   ├── burger-webapp.yaml
│   └── kustomization.yaml
├── services/
│   ├── agent-api.yaml
│   ├── agent-webapp.yaml
│   ├── burger-api.yaml
│   ├── burger-mcp.yaml
│   ├── burger-webapp.yaml
│   ├── postgres.yaml
│   └── kustomization.yaml
├── infrastructure/
│   ├── configmap.yaml
│   ├── postgres-statefulset.yaml
│   ├── postgres-init-job.yaml
│   ├── hpa-agent-api.yaml
│   ├── hpa-burger-api.yaml
│   ├── hpa-burger-mcp.yaml
│   ├── pod-disruption-budgets.yaml
│   └── kustomization.yaml
└── kustomization.yaml  # References subdirectories
```

## Migration Steps

### Step 1: Create Directory Structure ✅ DONE
```bash
mkdir -p k8s/base/{deployments,services,infrastructure}
```

### Step 2: Split Combined YAML Files

For each service (agent-api, agent-webapp, burger-api, burger-mcp, burger-webapp):

**Extract Deployment** (lines before `---`):
```bash
SERVICE=agent-api
sed -n '1,/^---$/p' k8s/base/${SERVICE}.yaml | head -n -1 > k8s/base/deployments/${SERVICE}.yaml
```

**Extract Service** (lines after `---`):
```bash
SERVICE=agent-api
sed -n '/^---$/,$p' k8s/base/${SERVICE}.yaml | tail -n +2 > k8s/base/services/${SERVICE}.yaml
```

### Step 3: Handle postgres-statefulset.yaml

This file contains StatefulSet + Service. Split into:
- `infrastructure/postgres-statefulset.yaml` (StatefulSet only)
- `services/postgres.yaml` (Service only)

### Step 4: Move Infrastructure Files

Move these files as-is to `infrastructure/`:
- `configmap.yaml`
- `postgres-init-job.yaml`
- `hpa-*.yaml` (3 files)
- `pod-disruption-budgets.yaml`

### Step 5: Create Kustomization Files

**`k8s/base/deployments/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - agent-api.yaml
  - agent-webapp.yaml
  - burger-api.yaml
  - burger-mcp.yaml
  - burger-webapp.yaml
```

**`k8s/base/services/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - agent-api.yaml
  - agent-webapp.yaml
  - burger-api.yaml
  - burger-mcp.yaml
  - burger-webapp.yaml
  - postgres.yaml
```

**`k8s/base/infrastructure/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - configmap.yaml
  - postgres-statefulset.yaml
  - postgres-init-job.yaml
  - hpa-agent-api.yaml
  - hpa-burger-api.yaml
  - hpa-burger-mcp.yaml
  - pod-disruption-budgets.yaml
```

**Update `k8s/base/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Reference subdirectories
resources:
  - infrastructure
  - services
  - deployments
```

### Step 6: Update Overlays

Each overlay (dev, prod) will inherit the base structure automatically.

Overlays can still apply patches as before using paths like:
```yaml
patches:
  - path: patches/replicas.yaml
    target:
      kind: Deployment
      name: agent-api
```

The patches will work the same way regardless of file location.

### Step 7: Update GitHub Actions Workflow

**Current (WRONG)**:
```yaml
# Line 390 - Applies everything at once
kubectl apply -k k8s/overlays/${ENV}
```

**New (CORRECT)**:
```yaml
# Phase 1: Infrastructure & Services (before canaries)
echo "=== Phase 1: Deploying infrastructure and services ==="
kubectl apply -k k8s/overlays/${ENV}/infrastructure
kubectl apply -k k8s/overlays/${ENV}/services

# Phase 2: Create canary deployments
# ... existing canary creation logic ...

# Phase 3: Datadog Deployment Gate
# ... existing gate evaluation ...

# Phase 4: Deploy main deployments (ONLY after gate passes)
if [[ "${GATE_PASSED}" == "true" ]]; then
  echo "=== Phase 4: Deploying main deployments ==="
  kubectl apply -k k8s/overlays/${ENV}/deployments
fi
```

### Step 8: Update Overlay Kustomization Files

**`k8s/overlays/dev/kustomization.yaml`**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Include base (which includes subdirectories)
resources:
  - ../../base

# Namespace
namespace: mcp-agent-dev

# Patches still work the same
patches:
  - path: patches/replicas.yaml
  - path: patches/version-labels.yaml
  - path: patches/hpa.yaml
```

No changes needed to overlay structure! The subdirectory organization is transparent to overlays.

## Benefits

1. **Clear Separation**: Each phase has its own directory
2. **Proper Canary Flow**: Infrastructure → Services → Test Canaries → Gate → Deploy Main
3. **Easy to Understand**: File organization matches deployment phases
4. **Selective Apply**: Can deploy specific resource types independently
5. **Better GitOps**: Changes to deployment configs don't trigger service updates

## Testing Plan

1. Test in dev environment first
2. Verify all resources are created correctly
3. Confirm canary deployment flow works
4. Validate Datadog Deployment Gate integration
5. Roll out to prod

## Rollback Plan

If issues occur:
- Keep old YAML files as backup
- Can switch back by updating kustomization.yaml to point to old files
- Git history provides complete rollback capability

## Files to Create

### New Files:
- `k8s/base/deployments/*.yaml` (5 files)
- `k8s/base/services/*.yaml` (6 files)
- `k8s/base/infrastructure/*.yaml` (7 files moved)
- `k8s/base/deployments/kustomization.yaml`
- `k8s/base/services/kustomization.yaml`
- `k8s/base/infrastructure/kustomization.yaml`

### Files to Update:
- `k8s/base/kustomization.yaml`
- `.github/workflows/gke-deploy.yaml`

### Files to Remove (after verification):
- `k8s/base/agent-api.yaml`
- `k8s/base/agent-webapp.yaml`
- `k8s/base/burger-api.yaml`
- `k8s/base/burger-mcp.yaml`
- `k8s/base/burger-webapp.yaml`
- `k8s/base/postgres-statefulset.yaml` (replaced by split version)

## Implementation Checklist

- [x] Create directory structure
- [ ] Split service YAML files
- [ ] Move infrastructure files
- [ ] Create kustomization.yaml for each subdirectory
- [ ] Update base kustomization.yaml
- [ ] Test with `kubectl kustomize k8s/overlays/dev`
- [ ] Update GitHub Actions workflow
- [ ] Test deployment in dev
- [ ] Document changes
- [ ] Clean up old files
- [ ] Commit and push
