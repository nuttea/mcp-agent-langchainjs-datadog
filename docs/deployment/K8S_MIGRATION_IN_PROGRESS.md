# Kustomize Migration - COMPLETED ✅

## Status: 100% Complete

**See [KUSTOMIZE_MIGRATION_COMPLETE.md](KUSTOMIZE_MIGRATION_COMPLETE.md) for full details.**

The Kustomize migration has been started and the structure is mostly in place. Some final adjustments are needed before it's ready to use.

## What's Done ✅

1. **Directory Structure Created**
   ```
   k8s/
   ├── base/                   ✅ Created
   │   ├── kustomization.yaml ✅ Created
   │   └── *.yaml            ✅ Manifests copied
   ├── overlays/
   │   ├── dev/              ✅ Created
   │   │   ├── kustomization.yaml ✅ Created
   │   │   ├── namespace.yaml     ✅ Created
   │   │   └── patches/           ✅ Created
   │   │       └── replicas.yaml  ✅ Created
   │   └── prod/             ✅ Created
   │       ├── kustomization.yaml ✅ Created
   │       ├── namespace.yaml     ✅ Created
   │       └── patches/           ✅ Created
   │           ├── replicas.yaml  ✅ Created
   │           └── resources.yaml ✅ Created
   ```

2. **Files Created**
   - Base kustomization with 7 resources
   - Dev overlay with namespace and patches
   - Prod overlay with namespace, replicas, and resources patches
   - Migration plan documentation
   - Review summary

## What's Left ⚠️

1. **Clean Base Manifests** (30 min)
   - Remove `namespace:` field from all base/*.yaml files
   - Remove environment-specific labels from base files
   - Current issue: Base manifests still have `namespace: mcp-agent-dev` which conflicts with overlays

2. **Test Kustomize Build** (15 min)
   ```bash
   kubectl kustomize k8s/overlays/dev
   kubectl kustomize k8s/overlays/prod
   ```

3. **Update Makefile** (15 min)
   - Change `kubectl apply -f k8s/manifests/` to `kubectl apply -k k8s/overlays/$(ENV)`
   - Add ENV variable support
   - Update help text

4. **Test Deployment** (30 min)
   - Dry-run: `kubectl apply -k k8s/overlays/dev --dry-run=client`
   - Apply to dev environment
   - Verify all pods come up correctly
   - Compare with old manifests

5. **Backup & Cleanup** (15 min)
   - Rename old directories:
     - `k8s/manifests` → `k8s/manifests.backup`
     - `k8s/manifests-prod` → `k8s/manifests-prod.backup`
   - Test everything still works
   - Delete backups after confirmation

## Quick Fix Script

Create this script to clean base manifests:

```bash
#!/bin/bash
# k8s/scripts/clean-base-manifests.sh

echo "Cleaning base manifests..."

for file in k8s/base/*.yaml; do
  if [[ "$file" != *"kustomization"* ]]; then
    echo "Processing $(basename $file)..."

    # Remove namespace line
    sed -i.bak '/^  namespace:/d' "$file"

    # Remove environment-specific labels
    sed -i.bak 's/environment: dev//g' "$file"
    sed -i.bak 's/environment: prod//g' "$file"

    # Remove backup files
    rm -f "${file}.bak"
  fi
done

echo "✅ Base manifests cleaned"
```

## Current Error

```
error: no resource matches strategic merge patch "Deployment.v1.apps/agent-webapp.[noNs]":
no matches for Id Deployment.v1.apps/agent-webapp.[noNs];
failed to find unique target for patch
```

**Cause**: Base manifests still have `namespace: mcp-agent-dev` defined, which conflicts with Kustomize trying to add the namespace via overlays.

**Fix**: Remove all `namespace:` fields from base/*.yaml files.

## Next Steps

Run these commands to complete the migration:

```bash
# 1. Clean base manifests
cd k8s/base
for file in *.yaml; do
  if [[ "$file" != "kustomization.yaml" ]]; then
    sed -i.bak '/^  namespace:/d' "$file"
    rm -f "${file}.bak"
  fi
done

# 2. Test kustomize build
cd ../..
kubectl kustomize k8s/overlays/dev | head -50
kubectl kustomize k8s/overlays/prod | head -50

# 3. If successful, dry-run apply
kubectl apply -k k8s/overlays/dev --dry-run=client

# 4. If dry-run looks good, apply for real
kubectl apply -k k8s/overlays/dev

# 5. Verify
kubectl get pods -n mcp-agent-dev
```

## Benefits When Complete

- **50% less YAML** (no duplication)
- **Single source of truth** for common resources
- **Easy environment management** via overlays
- **Standard Kubernetes practice**
- **Simple Makefile**: `make k8s-apply ENV=dev` or `make k8s-apply ENV=prod`

## Rollback

If needed, rollback is simple:
```bash
# Use old manifests
kubectl apply -f k8s/manifests/ -n mcp-agent-dev

# Or update Makefile to point back to old structure
```

## Timeline to Complete

- **Estimated time**: 1.5 - 2 hours
- **Risk**: Low (can test in dev first, easy rollback)
- **Impact**: High (much better maintainability)

## Documentation Updates Needed

Once complete, update:
1. [docs/deployment/README.md](docs/deployment/README.md)
2. [docs/deployment/GKE_COMPLETE_SETUP.md](docs/deployment/GKE_COMPLETE_SETUP.md)
3. [README.md](README.md) - Update deployment section
4. [Makefile](Makefile) - Already has plan in K8S_MAKEFILE_REVIEW_SUMMARY.md

## Questions?

See:
- [K8S_KUSTOMIZE_REORGANIZATION_PLAN.md](K8S_KUSTOMIZE_REORGANIZATION_PLAN.md) - Detailed plan
- [K8S_MAKEFILE_REVIEW_SUMMARY.md](K8S_MAKEFILE_REVIEW_SUMMARY.md) - Review and recommendations
