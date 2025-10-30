# Branch-Based Deployment Guide

This guide explains how to deploy the MCP Agent application to different environments using git branches.

## Overview

The deployment system automatically maps git branches to Kubernetes namespaces and environments:

| Git Branch | Environment | Namespace | Image Tag | Replicas |
|------------|-------------|-----------|-----------|----------|
| `main` | dev | `mcp-agent-dev` | `dev-latest` | 2 |
| `prod` | prod | `mcp-agent-prod` | `prod-latest` | 3 |
| `staging` | staging | `mcp-agent-staging` | `staging-latest` | 2 |
| `feature/*` | dev | `mcp-agent-dev` | `dev-{branch-name}` | 1 |

## Quick Start

### Deploy from Main Branch (Dev Environment)

```bash
# On main branch
git checkout main

# Build and push images
./k8s/scripts/build-and-push.sh

# Deploy to dev
./k8s/scripts/deploy.sh
```

This will deploy to:
- **Namespace**: `mcp-agent-dev`
- **Environment**: `dev`
- **Image Tag**: `dev-latest`

### Deploy to Production

```bash
# Switch to prod branch
git checkout prod

# Build and push prod images
./k8s/scripts/build-and-push.sh

# Deploy to prod (requires confirmation)
./k8s/scripts/deploy.sh
```

This will deploy to:
- **Namespace**: `mcp-agent-prod`
- **Environment**: `prod`
- **Image Tag**: `prod-latest`

## How It Works

### 1. Environment Configuration

The [k8s/config/environments.sh](config/environments.sh) file defines the mapping:

```bash
case "$branch_name" in
  main)
    ENVIRONMENT="dev"
    NAMESPACE="mcp-agent-dev"
    IMAGE_TAG="dev-latest"
    ;;
  prod)
    ENVIRONMENT="prod"
    NAMESPACE="mcp-agent-prod"
    IMAGE_TAG="prod-latest"
    ;;
  # ... more mappings
esac
```

### 2. Build Script

[k8s/scripts/build-and-push.sh](scripts/build-and-push.sh):
- Auto-detects current git branch
- Loads environment configuration
- Builds Docker images with appropriate tags
- Pushes to Google Container Registry

### 3. Deploy Script

[k8s/scripts/deploy.sh](scripts/deploy.sh):
- Auto-detects current git branch
- Creates/updates namespace
- Generates secrets for the environment
- Deploys all services with correct configuration
- Shows deployment status

## Deployment Workflows

### Development Workflow (Main Branch)

```bash
# 1. Make changes on main branch
git checkout main
git pull origin main

# 2. Build images
./k8s/scripts/build-and-push.sh
# Output: Images tagged as dev-latest

# 3. Deploy to dev
./k8s/scripts/deploy.sh
# Output: Deployed to mcp-agent-dev namespace

# 4. Test
kubectl get pods -n mcp-agent-dev
```

### Production Workflow (Prod Branch)

```bash
# 1. Merge main into prod
git checkout prod
git merge main

# 2. Build production images (with confirmation)
./k8s/scripts/build-and-push.sh
# Prompt: "⚠️  WARNING: You are about to build and push PRODUCTION images!"
# Type: yes

# 3. Deploy to production (with confirmation)
./k8s/scripts/deploy.sh
# Prompt: "⚠️  WARNING: You are about to deploy to PRODUCTION!"
# Type: yes

# 4. Verify
kubectl get pods -n mcp-agent-prod
```

### Feature Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes and test locally

# 3. Build with feature tag
./k8s/scripts/build-and-push.sh
# Output: Images tagged as dev-feature-my-new-feature

# 4. Deploy to dev namespace
./k8s/scripts/deploy.sh
# Note: Shares dev namespace but with different image tag
```

## Manual Branch Specification

You can override auto-detection by specifying the branch:

```bash
# Build for a specific branch
./k8s/scripts/build-and-push.sh prod

# Deploy as if on a specific branch
./k8s/scripts/deploy.sh prod
```

## Environment-Specific Secrets

Secrets are namespace-specific. Set different environment variables for each environment:

### Development Secrets

```bash
export DD_API_KEY='dev-datadog-key'
export OPENAI_API_KEY='dev-openai-key'
./k8s/scripts/generate-secrets.sh
```

### Production Secrets

```bash
export DD_API_KEY='prod-datadog-key'
export OPENAI_API_KEY='prod-openai-key'
NAMESPACE=mcp-agent-prod ./k8s/scripts/generate-secrets.sh
```

Or use separate environment variables:

```bash
# In ~/.zshrc or ~/.bashrc
export DEV_DD_API_KEY='dev-key'
export DEV_OPENAI_API_KEY='dev-key'

export PROD_DD_API_KEY='prod-key'
export PROD_OPENAI_API_KEY='prod-key'
```

## Namespace Isolation

Each environment runs in its own namespace with isolated resources:

```bash
# View dev environment
kubectl get all -n mcp-agent-dev

# View prod environment
kubectl get all -n mcp-agent-prod

# Switch context between environments
kubectl config set-context --current --namespace=mcp-agent-dev
kubectl config set-context --current --namespace=mcp-agent-prod
```

## Production Safety Features

### Build Script Protections

- **Confirmation Required**: Production builds require typing "yes"
- **Clear Warnings**: Red warning messages for production operations
- **Branch Display**: Shows which branch you're building from

### Deploy Script Protections

- **Confirmation Required**: Production deployments require typing "yes"
- **Namespace Verification**: Shows target namespace before proceeding
- **Environment Display**: Clear indication of target environment

### Example Production Prompt

```
⚠️  WARNING: You are about to deploy to PRODUCTION!
   Namespace: mcp-agent-prod
   Branch: prod

Are you sure you want to continue? (yes/no)
```

## Viewing Deployment Status

### Check Current Environment

```bash
# Auto-detect from current branch
./k8s/scripts/deploy.sh --dry-run  # (not implemented, shows config)

# Or manually check
git branch --show-current
# main -> deploys to mcp-agent-dev
# prod -> deploys to mcp-agent-prod
```

### Check Pods by Environment

```bash
# Development
kubectl get pods -n mcp-agent-dev

# Production
kubectl get pods -n mcp-agent-prod

# All namespaces
kubectl get pods --all-namespaces | grep mcp-agent
```

### Check Services by Environment

```bash
# Development
kubectl get services -n mcp-agent-dev

# Production
kubectl get services -n mcp-agent-prod
```

### View Logs

```bash
# Dev logs
kubectl logs -f deployment/agent-api -n mcp-agent-dev

# Prod logs
kubectl logs -f deployment/agent-api -n mcp-agent-prod
```

## Troubleshooting

### Wrong Namespace

**Problem**: Deployed to wrong namespace

**Solution**:
```bash
# Check current branch
git branch --show-current

# Ensure you're on the correct branch
git checkout main  # or prod

# Re-deploy
./k8s/scripts/deploy.sh
```

### Image Tag Mismatch

**Problem**: Pods pulling wrong image version

**Solution**:
```bash
# Rebuild and push correct images
./k8s/scripts/build-and-push.sh

# Restart deployments to pull new images
kubectl rollout restart deployment -n mcp-agent-dev --all
```

### Secrets Not Found

**Problem**: `Secret 'app-secrets' not found`

**Solution**:
```bash
# Generate secrets for the namespace
NAMESPACE=mcp-agent-dev ./k8s/scripts/generate-secrets.sh

# Apply to cluster
kubectl apply -f k8s/config/secrets.yaml
```

### Multiple Environments Running

**Problem**: Want to clean up old environments

**Solution**:
```bash
# Delete specific namespace (removes everything)
kubectl delete namespace mcp-agent-dev

# Or keep namespace but delete deployments
kubectl delete deployments --all -n mcp-agent-dev
```

## Advanced: Adding New Environments

To add a new environment (e.g., `staging`):

### 1. Update environments.sh

Edit [k8s/config/environments.sh](config/environments.sh):

```bash
staging)
  export ENVIRONMENT="staging"
  export NAMESPACE="mcp-agent-staging"
  export IMAGE_TAG="staging-latest"
  export REPLICAS="2"
  ;;
```

### 2. Create Namespace Manifest (Optional)

Create `k8s/manifests/namespace-staging.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-agent-staging
  labels:
    app: mcp-agent
    environment: staging
```

### 3. Create Branch

```bash
git checkout -b staging
git push -u origin staging
```

### 4. Deploy

```bash
git checkout staging
./k8s/scripts/build-and-push.sh
./k8s/scripts/deploy.sh
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to GKE

on:
  push:
    branches: [main, prod, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: datadog-ese-sandbox

      - name: Build and Push
        run: |
          ./k8s/scripts/build-and-push.sh

      - name: Deploy
        run: |
          ./k8s/scripts/deploy.sh
```

### GitLab CI Example

```yaml
deploy:
  image: google/cloud-sdk:alpine
  script:
    - gcloud auth activate-service-account --key-file=$GCP_KEY
    - ./k8s/scripts/build-and-push.sh
    - ./k8s/scripts/deploy.sh
  only:
    - main
    - prod
    - staging
```

## Best Practices

### 1. Branch Protection

- Protect `main` and `prod` branches
- Require pull requests for changes
- Require approvals before merging to prod

### 2. Deployment Process

1. Develop on feature branches
2. Merge to `main` for dev deployment
3. Test thoroughly in dev
4. Merge `main` to `prod` for production deployment
5. Monitor production carefully

### 3. Rollback Strategy

```bash
# Quick rollback in prod
kubectl rollout undo deployment/agent-api -n mcp-agent-prod

# Or redeploy previous version
git checkout prod
git reset --hard <previous-commit>
./k8s/scripts/deploy.sh
```

### 4. Resource Limits

Production has higher replica counts:
- Dev: 2 replicas per service
- Prod: 3 replicas per service
- Feature branches: 1 replica

## Summary Commands

```bash
# Check current setup
git branch --show-current
kubectl config current-context
kubectl get namespaces | grep mcp-agent

# Full deployment flow
git checkout main  # or prod
./k8s/scripts/build-and-push.sh
./k8s/scripts/deploy.sh

# Verify deployment
kubectl get pods -n mcp-agent-dev  # or mcp-agent-prod
kubectl get services -n mcp-agent-dev
kubectl logs -f deployment/agent-api -n mcp-agent-dev

# Clean up
kubectl delete namespace mcp-agent-dev  # nuclear option
```

## Reference

- **Environment Config**: [k8s/config/environments.sh](config/environments.sh)
- **Build Script**: [k8s/scripts/build-and-push.sh](scripts/build-and-push.sh)
- **Deploy Script**: [k8s/scripts/deploy.sh](scripts/deploy.sh)
- **Secrets Guide**: [../SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md)
- **Main README**: [k8s/README.md](README.md)
