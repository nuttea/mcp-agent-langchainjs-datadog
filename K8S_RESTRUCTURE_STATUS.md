# Kubernetes Restructuring Status

## ✅ COMPLETED WORK

### 1. Directory Structure Created ✅
```
k8s/base/
├── deployments/         ← NEW: All Deployment resources
├── services/           ← NEW: All Service resources
├── infrastructure/     ← NEW: ConfigMaps, HPAs, PDBs, StatefulSet
└── kustomization.yaml  ← UPDATED: References subdirectories
```

### 2. Files Split and Organized ✅

**Deployments/** (5 files):
- agent-api.yaml (121 lines)
- agent-webapp.yaml (86 lines)
- burger-api.yaml (112 lines)
- burger-mcp.yaml (103 lines)
- burger-webapp.yaml (86 lines)

**Services/** (6 files):
- agent-api.yaml (17 lines)
- agent-webapp.yaml (19 lines)
- burger-api.yaml (19 lines)
- burger-mcp.yaml (26 lines)
- burger-webapp.yaml (19 lines)
- postgres.yaml (15 lines)

**Infrastructure/** (7 files):
- configmap.yaml
- hpa-agent-api.yaml
- hpa-burger-api.yaml
- hpa-burger-mcp.yaml
- pod-disruption-budgets.yaml
- postgres-init-job.yaml
- postgres-statefulset.yaml (Secret + StatefulSet)

### 3. Kustomization Files Created ✅

**k8s/base/deployments/kustomization.yaml**:
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

**k8s/base/services/kustomization.yaml**:
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

**k8s/base/infrastructure/kustomization.yaml**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - configmap.yaml
  - hpa-agent-api.yaml
  - hpa-burger-api.yaml
  - hpa-burger-mcp.yaml
  - pod-disruption-budgets.yaml
  - postgres-init-job.yaml
  - postgres-statefulset.yaml
```

**k8s/base/kustomization.yaml** (UPDATED):
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Reference subdirectories
# This allows phased deployment: infrastructure → services → deployments
resources:
  - infrastructure
  - services
  - deployments

labels:
  - pairs:
      app: mcp-agent
```

### 4. Kustomize Build Tested ✅
```bash
kubectl kustomize k8s/overlays/dev
```
**Result**: ✅ SUCCESS - All resources generated correctly

## 🚧 REMAINING WORK

### Step 1: Remove Old Files

**Files to remove** (now split into subdirectories):
```bash
cd k8s/base
rm -f agent-api.yaml agent-webapp.yaml burger-api.yaml burger-mcp.yaml burger-webapp.yaml
rm -f postgres-statefulset.yaml
rm -f burger-webapp.yaml.backup  # Also remove backup file
```

### Step 2: Update GitHub Actions Workflow

**File**: `.github/workflows/gke-deploy.yaml`

**Current (WRONG) - Line 390**:
```yaml
# Apply base infrastructure (ConfigMaps, Services, etc.)
kubectl apply -k k8s/overlays/${ENV}
```

**New (CORRECT)**:
```yaml
# Phase 1: Infrastructure & Services (before canaries)
echo "=== Phase 1: Deploying infrastructure ==="
kubectl apply -k k8s/overlays/${ENV}/infrastructure

echo "=== Phase 2: Deploying services ==="
kubectl apply -k k8s/overlays/${ENV}/services

# Phase 2-3: Canary deployments and health checks
# ... existing canary logic stays the same ...

# Phase 4: Datadog Deployment Gate
# ... existing gate logic stays the same ...

# Phase 5: Deploy main deployments (ONLY after gate passes)
# This happens in "Continue Full Rollout" step (line 534-580)
# REMOVE the kubectl apply command there, replace with:
echo "=== Phase 6: Deploying main deployments (after gate passed) ==="
kubectl apply -k k8s/overlays/${ENV}/deployments
```

**Specific Changes Needed**:

1. **Line 389-390** - Replace:
```yaml
# Apply base infrastructure (ConfigMaps, Services, etc.)
kubectl apply -k k8s/overlays/${ENV}
```

With:
```yaml
# Phase 1: Apply infrastructure and services (NOT deployments yet)
echo "=== Phase 1: Deploying infrastructure ==="
kubectl apply -k k8s/overlays/${ENV}/infrastructure

echo "=== Phase 2: Deploying services ==="
kubectl apply -k k8s/overlays/${ENV}/services
```

2. **Line 534-558** - In "Continue Full Rollout" step, BEFORE the `kubectl set image` commands, ADD:
```yaml
# Deploy main deployments now that gate has passed
echo "=== Applying main deployments (after Datadog gate passed) ==="
kubectl apply -k k8s/overlays/${ENV}/deployments
echo ""
```

### Step 3: Test in Dev Environment

```bash
# Test the complete flow
kubectl delete namespace mcp-agent-dev
# Push code and trigger workflow
# Watch deployment proceed through phases
```

### Step 4: Commit Changes

```bash
git status
git add k8s/
git add .github/workflows/gke-deploy.yaml
git add K8S_RESTRUCTURE_*.md

git commit -m "refactor: restructure k8s for proper canary deployment flow

Split Kubernetes resources into phased directories to enable proper
canary deployment strategy where Datadog Deployment Gate is evaluated
BEFORE updating main production deployments.

New Structure:
- k8s/base/infrastructure/ - ConfigMaps, HPAs, PDBs, StatefulSet
- k8s/base/services/ - All Service resources
- k8s/base/deployments/ - All Deployment resources

Deployment Flow (Correct):
1. Apply infrastructure and services
2. Create canary deployments
3. Monitor canary health
4. **Evaluate Datadog Deployment Gate**
5. **ONLY if gate passes**: Apply main deployments
6. Cleanup canaries

Previous Flow (Broken):
- All resources applied at once (line 390)
- Main deployments updated immediately
- Datadog gate evaluated too late (useless)

This fixes the critical issue where production deployments were
updated before canary validation, defeating the purpose of the gate.

Files Changed:
- Split 5 combined YAML files into 15+ separate files
- Created 3 kustomization.yaml files for subdirectories
- Updated base kustomization.yaml to reference subdirectories
- Updated workflow to deploy in correct phases

Testing:
- kubectl kustomize k8s/overlays/dev ✅ SUCCESS
- All resources generate correctly
- Ready for workflow testing

See K8S_RESTRUCTURE_PLAN.md and K8S_RESTRUCTURE_STATUS.md for details.
"
```

## 📋 Complete Workflow Changes

### Before (BROKEN):
```
Line 390: kubectl apply -k k8s/overlays/${ENV}  ← Updates EVERYTHING
Lines 409-493: Create canaries (from already-updated deployments)
Lines 500-512: Datadog gate (too late!)
Lines 534-580: Update main deployments (already updated!)
```

### After (CORRECT):
```
Line 390-395: kubectl apply -k k8s/overlays/${ENV}/infrastructure
              kubectl apply -k k8s/overlays/${ENV}/services
Lines 409-493: Create canaries (from stable deployments)
Lines 500-512: Datadog gate (validates canaries)
Lines 534-540: kubectl apply -k k8s/overlays/${ENV}/deployments  ← NEW!
Lines 541-580: Update main deployments (with new images)
```

## 🎯 Benefits

1. **Proper Canary Flow**: Infrastructure → Services → Test Canaries → Gate → Deploy Main
2. **Gate Actually Works**: Main deployments only updated after validation
3. **Clear Separation**: Each phase has its own directory
4. **Selective Apply**: Can deploy specific resource types independently
5. **Better GitOps**: Changes to deployment configs don't trigger service updates
6. **Easy to Understand**: File organization matches deployment phases

## ⚠️ Important Notes

- **Old files still exist** in k8s/base/ - need to be removed after verification
- **Overlays unchanged** - dev/prod overlays work transparently with new structure
- **Patches still work** - kustomize patches target resources regardless of file location
- **Rollback easy** - git history provides complete rollback if needed

## 🧪 Testing Checklist

- [x] Directory structure created
- [x] Files split correctly
- [x] Kustomization files created
- [x] Base kustomization updated
- [x] Kustomize build works
- [ ] Old files removed
- [ ] Workflow updated
- [ ] Deployed to dev
- [ ] Verified phased deployment
- [ ] Canary flow tested
- [ ] Datadog gate validated
- [ ] Committed to git

## 📚 Documentation Created

1. **K8S_RESTRUCTURE_PLAN.md** - Complete implementation plan
2. **K8S_RESTRUCTURE_STATUS.md** - This file (current status)
3. **Workflow comments** - Inline documentation in gke-deploy.yaml

## 🔄 Next Session

If continuing in a new session, start here:
1. Remove old files (listed above)
2. Update workflow (specific line numbers provided)
3. Test in dev
4. Commit with provided message

All the hard work is done - just cleanup and workflow updates remain!
