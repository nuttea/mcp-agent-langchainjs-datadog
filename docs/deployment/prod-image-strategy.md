# Production Image Tag Strategy

## Problem Statement

When merging a PR to the `prod` branch, GitHub creates a new merge commit. This merge commit doesn't have pre-built container images, causing the workflow to rebuild all images unnecessarily.

## Solution: Use PR Source Commit Images

### How It Works

1. **PR Merge Detection**: When a PR is merged to `prod`, the workflow detects it's a merge commit
2. **Source Commit Extraction**: Extract the second parent of the merge commit (the tip of the merged branch)
3. **Reuse Existing Images**: Use container images tagged with the source commit SHA (already built from `main`)
4. **Skip Redundant Builds**: Only build new images if they don't exist

### Implementation

```bash
# Detect if current commit is a merge commit and get source commit
if git rev-parse HEAD^2 &>/dev/null; then
  # This is a merge commit - use the second parent (source branch)
  SOURCE_COMMIT=$(git rev-parse HEAD^2)
  SOURCE_SHA=$(echo ${SOURCE_COMMIT} | cut -c1-7)
  echo "Merge commit detected. Using source commit: ${SOURCE_SHA}"
  USE_EXISTING_IMAGES=true
else
  # Not a merge commit - use current commit
  SOURCE_SHA=$(echo ${{ github.sha }} | cut -c1-7)
  USE_EXISTING_IMAGES=false
fi
```

### Benefits

1. **Faster Deployments**: Skip 5-10 minutes of image building
2. **Cost Savings**: Reduce GCR storage and build compute costs
3. **Consistency**: Deploy exact same images that were tested in dev
4. **Traceability**: Clear mapping from PR → commit → container image

### Example Flow

```
main branch:
  commit abc1234 → builds images with tag :abc1234
  ↓
  PR #123 created
  ↓
prod branch:
  PR #123 merged → creates merge commit def5678
  ↓
  Workflow detects merge, extracts source commit abc1234
  ↓
  Deploys using existing images with tag :abc1234
```

### Fallback Strategy

If source commit images don't exist (rare edge case):
1. Build images with current merge commit SHA
2. Log warning about missing source images
3. Continue deployment with newly built images

## Related Files

- `.github/workflows/gke-deploy.yaml`: Main deployment workflow
- `k8s/overlays/prod/kustomization.yaml`: Production image configuration
