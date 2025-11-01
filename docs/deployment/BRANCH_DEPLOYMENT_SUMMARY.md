# Branch-Based Deployment Summary

## Quick Reference

Your deployment system now automatically maps git branches to environments!

| Branch | Environment | Namespace | Image Tag |
|--------|-------------|-----------|-----------|
| **main** | dev | `mcp-agent-dev` | `dev-latest` |
| **prod** | prod | `mcp-agent-prod` | `prod-latest` |

## Simple Deployment

### Deploy to Dev (main branch)

```bash
git checkout main
./k8s/scripts/build-and-push.sh
./k8s/scripts/deploy.sh
```

### Deploy to Prod (prod branch)

```bash
git checkout prod
./k8s/scripts/build-and-push.sh  # Requires "yes" confirmation
./k8s/scripts/deploy.sh          # Requires "yes" confirmation
```

## What Changed

### 1. Environment Configuration

**New file**: [k8s/config/environments.sh](k8s/config/environments.sh)
- Defines branch → environment mapping
- Sets namespace, image tags, and replica counts automatically

### 2. Updated Build Script

**Updated**: [k8s/scripts/build-and-push.sh](k8s/scripts/build-and-push.sh)
- Auto-detects git branch
- Tags images appropriately (`dev-latest`, `prod-latest`)
- Requires confirmation for production builds

### 3. Updated Deploy Script

**Updated**: [k8s/scripts/deploy.sh](k8s/scripts/deploy.sh)
- Auto-detects git branch
- Deploys to correct namespace
- Uses environment-specific configuration
- Requires confirmation for production deployments

### 4. Namespace Manifests

**New files**:
- [k8s/manifests/namespace.yaml](k8s/manifests/namespace.yaml) - Dev namespace
- [k8s/manifests/namespace-prod.yaml](k8s/manifests/namespace-prod.yaml) - Prod namespace

## Branch → Environment Mapping

```
main branch
    ↓
Auto-detects: main
    ↓
Configures:
  - ENVIRONMENT=dev
  - NAMESPACE=mcp-agent-dev
  - IMAGE_TAG=dev-latest
  - REPLICAS=2
    ↓
Deploys to mcp-agent-dev namespace
```

```
prod branch
    ↓
Auto-detects: prod
    ↓
Configures:
  - ENVIRONMENT=prod
  - NAMESPACE=mcp-agent-prod
  - IMAGE_TAG=prod-latest
  - REPLICAS=3
    ↓
Requires "yes" confirmation
    ↓
Deploys to mcp-agent-prod namespace
```

## Safety Features

### Production Protections

When building or deploying to prod branch:

```
⚠️  WARNING: You are about to deploy to PRODUCTION!
   Namespace: mcp-agent-prod
   Branch: prod

Are you sure you want to continue? (yes/no)
```

Must type `yes` (not just `y`) to proceed.

### Environment Isolation

- **Dev** and **Prod** run in separate namespaces
- No resource sharing between environments
- Independent scaling (dev: 2 replicas, prod: 3 replicas)
- Separate secrets per namespace

## Workflow Examples

### Development Flow

```bash
# 1. Work on main branch
git checkout main
git pull origin main

# 2. Make changes, commit, push
git add .
git commit -m "feat: new feature"
git push origin main

# 3. Build and deploy to dev
./k8s/scripts/build-and-push.sh
./k8s/scripts/deploy.sh

# 4. Test in dev
kubectl get pods -n mcp-agent-dev
```

### Production Release Flow

```bash
# 1. Merge main to prod
git checkout prod
git merge main
git push origin prod

# 2. Build prod images (requires confirmation)
./k8s/scripts/build-and-push.sh
# Type: yes

# 3. Deploy to prod (requires confirmation)
./k8s/scripts/deploy.sh
# Type: yes

# 4. Verify prod deployment
kubectl get pods -n mcp-agent-prod
```

## Environment Variables for Secrets

Set different secrets for each environment:

### Option 1: Switch Environment Variables

```bash
# For dev deployment
export DD_API_KEY='dev-datadog-key'
export OPENAI_API_KEY='dev-openai-key'
./k8s/scripts/generate-secrets.sh

# For prod deployment
export DD_API_KEY='prod-datadog-key'
export OPENAI_API_KEY='prod-openai-key'
NAMESPACE=mcp-agent-prod ./k8s/scripts/generate-secrets.sh
```

### Option 2: Environment-Prefixed Variables

```bash
# In ~/.zshrc or ~/.bashrc
export DEV_DD_API_KEY='dev-key'
export DEV_OPENAI_API_KEY='dev-key'
export PROD_DD_API_KEY='prod-key'
export PROD_OPENAI_API_KEY='prod-key'
```

Then modify generate-secrets.sh to use prefixed variables.

## Viewing Deployments

### Check All Environments

```bash
# List all mcp-agent namespaces
kubectl get namespaces | grep mcp-agent

# View resources in all namespaces
kubectl get all --all-namespaces | grep mcp-agent
```

### Check Specific Environment

```bash
# Dev environment
kubectl get all -n mcp-agent-dev

# Prod environment
kubectl get all -n mcp-agent-prod
```

### View Logs

```bash
# Dev logs
kubectl logs -f deployment/agent-api -n mcp-agent-dev

# Prod logs
kubectl logs -f deployment/agent-api -n mcp-agent-prod
```

## Common Commands

```bash
# Check current branch
git branch --show-current

# Build for current branch
./k8s/scripts/build-and-push.sh

# Deploy current branch
./k8s/scripts/deploy.sh

# Override branch detection
./k8s/scripts/deploy.sh prod

# Delete environment
kubectl delete namespace mcp-agent-dev  # or mcp-agent-prod
```

## Files Structure

```
k8s/
├── config/
│   ├── environments.sh          # ✨ NEW: Branch→Environment mapping
│   ├── configmap.yaml
│   └── secrets.example.yaml
├── manifests/
│   ├── namespace.yaml           # Dev namespace
│   ├── namespace-prod.yaml      # ✨ NEW: Prod namespace
│   ├── burger-api.yaml
│   ├── burger-mcp.yaml
│   ├── burger-webapp.yaml
│   ├── agent-api.yaml
│   └── agent-webapp.yaml
└── scripts/
    ├── build-and-push.sh        # ✨ UPDATED: Branch-aware
    ├── deploy.sh                # ✨ UPDATED: Branch-aware
    └── generate-secrets.sh
```

## Documentation

- **Full Guide**: [k8s/BRANCH_DEPLOYMENT_GUIDE.md](k8s/BRANCH_DEPLOYMENT_GUIDE.md)
- **Secrets Management**: [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md)
- **Quick Start**: [k8s/SECRETS_QUICKSTART.md](k8s/SECRETS_QUICKSTART.md)

## Benefits

1. **Automatic Environment Selection**: No manual configuration needed
2. **Safety First**: Production requires explicit confirmation
3. **Clear Separation**: Dev and prod completely isolated
4. **Simple Workflow**: Just switch branches and deploy
5. **No Configuration Files**: Environment determined by git branch
6. **Scalable**: Easy to add new environments (staging, qa, etc.)

## Next Steps

1. **Set up prod branch** (if not exists):
   ```bash
   git checkout -b prod
   git push -u origin prod
   ```

2. **Test dev deployment**:
   ```bash
   git checkout main
   ./k8s/scripts/build-and-push.sh
   ./k8s/scripts/deploy.sh
   ```

3. **Set up environment-specific secrets**:
   ```bash
   # Dev
   export DD_API_KEY='dev-key'
   export OPENAI_API_KEY='dev-key'
   ./k8s/scripts/generate-secrets.sh

   # Prod
   export DD_API_KEY='prod-key'
   export OPENAI_API_KEY='prod-key'
   NAMESPACE=mcp-agent-prod ./k8s/scripts/generate-secrets.sh
   ```

4. **Deploy to both environments**:
   ```bash
   # Deploy dev
   git checkout main
   ./k8s/scripts/deploy.sh

   # Deploy prod
   git checkout prod
   ./k8s/scripts/deploy.sh
   ```

You're all set! Your deployment system now automatically handles environment configuration based on git branches. 🚀
