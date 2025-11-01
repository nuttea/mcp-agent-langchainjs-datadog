# Kubernetes Kustomize Reorganization Plan

## Current Structure Issues

1. **Duplicate manifests**: `manifests/` and `manifests-prod/` contain nearly identical files with only namespace/environment differences
2. **No Kustomize**: Not using Kustomize overlays, leading to duplication
3. **Makefile hardcoded**: Makefile references `k8s/manifests/` directly instead of using Kustomize
4. **Manual namespace management**: Namespace changes require editing multiple files

## Proposed Kustomize Structure

```
k8s/
├── base/                           # Common resources
│   ├── kustomization.yaml         # Base kustomization
│   ├── agent-api.yaml             # Without namespace/env labels
│   ├── agent-webapp.yaml
│   ├── burger-api.yaml
│   ├── burger-webapp.yaml
│   ├── burger-mcp.yaml
│   ├── postgres-statefulset.yaml
│   └── postgres-init-job.yaml
│
├── overlays/
│   ├── dev/                       # Dev environment
│   │   ├── kustomization.yaml    # Dev overlay
│   │   ├── namespace.yaml        # mcp-agent-dev namespace
│   │   ├── configmap.yaml        # Dev config
│   │   └── patches/              # Dev-specific patches
│   │       ├── replicas.yaml     # Set replicas to 1
│   │       └── resources.yaml    # Lower resource limits
│   │
│   └── prod/                      # Prod environment
│       ├── kustomization.yaml    # Prod overlay
│       ├── namespace.yaml        # mcp-agent-prod namespace
│       ├── configmap.yaml        # Prod config
│       └── patches/              # Prod-specific patches
│           ├── replicas.yaml     # Set replicas to 3
│           └── resources.yaml    # Higher resource limits
│
├── config/                        # Shared configs
│   └── secrets.yaml              # Template secrets
│
└── scripts/                       # Deployment scripts
    ├── build-and-push.sh
    └── deploy-datadog.sh
```

## Benefits

1. **DRY Principle**: Single source of truth for common resources
2. **Environment Management**: Easy to add new environments (staging, qa, etc.)
3. **Patch-based Customization**: Override only what's different per environment
4. **Standard Tool**: Using industry-standard Kustomize
5. **Better Makefile**: Simplified commands using `kubectl apply -k`

## Migration Steps

### Step 1: Create Base Resources

Copy manifests to `base/` and remove environment-specific values:
- Remove `namespace:` field (will be added by overlays)
- Remove environment-specific labels (`environment: dev/prod`)
- Keep common labels and configurations

### Step 2: Create Dev Overlay

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
  - path: patches/resources.yaml

images:
  - name: gcr.io/datadog-ese-sandbox/agent-api
    newTag: latest
  - name: gcr.io/datadog-ese-sandbox/agent-webapp
    newTag: latest
  - name: gcr.io/datadog-ese-sandbox/burger-api
    newTag: latest
  - name: gcr.io/datadog-ese-sandbox/burger-webapp
    newTag: latest
  - name: gcr.io/datadog-ese-sandbox/burger-mcp
    newTag: latest
```

### Step 3: Create Prod Overlay

Similar to dev but with:
- `namespace: mcp-agent-prod`
- `environment: prod` labels
- Higher replicas (3 instead of 1)
- Higher resource limits

### Step 4: Update Makefile

Replace:
```makefile
k8s-apply:
\t@echo "Applying Kubernetes manifests to dev environment..."
\tkubectl apply -f k8s/manifests/namespace.yaml
\tkubectl apply -f k8s/manifests/ -n mcp-agent-dev
```

With:
```makefile
k8s-apply:
\t@echo "Applying Kubernetes manifests to $(ENV) environment..."
\tkubectl apply -k k8s/overlays/$(ENV)

k8s-apply-dev:
\tkubectl apply -k k8s/overlays/dev

k8s-apply-prod:
\tkubectl apply -k k8s/overlays/prod
```

### Step 5: Test Commands

```bash
# Test kustomize build (dry-run)
kustomize build k8s/overlays/dev
kustomize build k8s/overlays/prod

# Apply to dev
kubectl apply -k k8s/overlays/dev

# Apply to prod
kubectl apply -k k8s/overlays/prod

# Or via Makefile
make k8s-apply ENV=dev
make k8s-apply ENV=prod
```

## Kustomize Patches Examples

### Replicas Patch (Dev)
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

### Replicas Patch (Prod)
```yaml
# k8s/overlays/prod/patches/replicas.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
spec:
  replicas: 3
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: burger-api
spec:
  replicas: 3
```

### Resources Patch (Prod)
```yaml
# k8s/overlays/prod/patches/resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-api
spec:
  template:
    spec:
      containers:
        - name: agent-api
          resources:
            requests:
              memory: "1Gi"
              cpu: "1000m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
```

## Cleanup After Migration

Once tested and working:

1. **Remove old directories**:
   ```bash
   rm -rf k8s/manifests
   rm -rf k8s/manifests-prod
   ```

2. **Update documentation**:
   - Update [docs/deployment/](docs/deployment/) guides
   - Update README.md deployment section
   - Update [docs/deployment/GKE_COMPLETE_SETUP.md](docs/deployment/GKE_COMPLETE_SETUP.md)

3. **Update CI/CD** (if applicable):
   - Change deployment commands to use `kubectl apply -k`

## Testing Checklist

- [ ] `kustomize build k8s/overlays/dev` succeeds
- [ ] `kustomize build k8s/overlays/prod` succeeds
- [ ] Dev deployment works: `kubectl apply -k k8s/overlays/dev`
- [ ] Prod deployment works: `kubectl apply -k k8s/overlays/prod`
- [ ] All pods start successfully in both environments
- [ ] Services are accessible
- [ ] Environment-specific configs are correct (replicas, resources)
- [ ] Datadog tags show correct environment
- [ ] Makefile commands work with new structure

## Rollback Plan

If issues arise:
1. Revert Makefile changes
2. Use old `manifests/` and `manifests-prod/` directories
3. Keep new structure in parallel until fully tested

## Timeline

- **Phase 1** (1-2 hours): Create base/ and overlays structure
- **Phase 2** (30 min): Update Makefile
- **Phase 3** (1 hour): Test in dev environment
- **Phase 4** (1 hour): Test in prod environment
- **Phase 5** (30 min): Update documentation
- **Phase 6** (15 min): Cleanup old directories

## Additional Enhancements

After basic migration, consider:

1. **Add staging environment**: Create `k8s/overlays/staging/`
2. **Secret management**: Use sealed-secrets or external-secrets operator
3. **HPA**: Add HorizontalPodAutoscaler to overlays
4. **Network policies**: Add network policies to base or overlays
5. **Service mesh**: Consider Istio/Linkerd integration
6. **GitOps**: Set up ArgoCD or Flux for automated deployments

## References

- [Kustomize Documentation](https://kustomize.io/)
- [Kubernetes Kustomize Tutorial](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Kustomize Best Practices](https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/)
