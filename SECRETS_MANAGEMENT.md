# Secrets Management Guide

This document explains how to securely manage secrets for the MCP Agent application when deploying to GKE.

## Overview

This project uses a **script-based approach** to generate Kubernetes secrets from local environment variables. This ensures:
- ✅ Real secrets are NEVER committed to git
- ✅ Each developer maintains their own secrets locally
- ✅ Easy rotation and updates of secrets
- ✅ Consistent secret structure across environments

## Quick Start

### 1. Set Your Environment Variables

Add these to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
# Required secrets
export DD_API_KEY='your-datadog-api-key-here'
export OPENAI_API_KEY='your-openai-api-key-here'

# Optional secrets (if using GCP Vertex AI)
export VERTEX_AI_KEY='your-vertex-ai-key-here'
export GCP_SA_KEY_FILE='/path/to/service-account-key.json'
# OR
export GCP_SA_KEY_JSON='{"type":"service_account",...}'
```

Reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

### 2. Generate Secrets File

Run the generation script:

```bash
./k8s/scripts/generate-secrets.sh
```

This creates `k8s/config/secrets.yaml` with base64-encoded secrets from your environment variables.

### 3. Verify (Don't Commit!)

Check the generated file:
```bash
# View the file (be careful not to expose in shared screens!)
cat k8s/config/secrets.yaml

# Verify it's in .gitignore
git status  # should NOT show secrets.yaml
```

### 4. Apply to Cluster

```bash
kubectl apply -f k8s/config/secrets.yaml
```

Or use the deployment script which handles this automatically:
```bash
./k8s/scripts/deploy.sh
```

## Files Overview

### Git-Tracked Files (Safe to Commit)

| File | Purpose |
|------|---------|
| `k8s/config/secrets.example.yaml` | Template showing secret structure |
| `k8s/scripts/generate-secrets.sh` | Script to generate secrets from env vars |
| `.gitignore` | Ensures real secrets are never committed |

### Git-Ignored Files (NEVER Commit)

| File | Purpose |
|------|---------|
| `k8s/config/secrets.yaml` | Generated file with real secrets |

## How It Works

1. **Environment Variables**: Store your secrets as environment variables on your local machine
2. **Generation Script**: Reads env vars and generates a Kubernetes Secret manifest
3. **Base64 Encoding**: Automatically encodes secrets in base64 (required by Kubernetes)
4. **Git Protection**: `.gitignore` ensures the generated file is never committed

## Security Best Practices

### ✅ DO

- ✅ Store secrets in environment variables or a password manager
- ✅ Generate `secrets.yaml` locally before each deployment
- ✅ Rotate secrets regularly
- ✅ Use different secrets for different environments (dev/staging/prod)
- ✅ Delete local `secrets.yaml` after deployment if not needed
- ✅ Use GCP Secret Manager or similar for production environments

### ❌ DON'T

- ❌ Commit `secrets.yaml` to git (even temporarily!)
- ❌ Share secrets via chat, email, or Slack
- ❌ Hard-code secrets in application code
- ❌ Use the same secrets across all environments
- ❌ Push secrets to public registries or logs

## Environment-Specific Secrets

For different environments (dev/staging/prod), you can:

### Option 1: Environment Variables with Prefix

```bash
# Dev environment
export DEV_DD_API_KEY='dev-key'
export DEV_OPENAI_API_KEY='dev-key'

# Prod environment
export PROD_DD_API_KEY='prod-key'
export PROD_OPENAI_API_KEY='prod-key'
```

Then modify the generation script to use the appropriate prefix.

### Option 2: Multiple Secret Files

```bash
# Generate dev secrets
NAMESPACE=mcp-agent-dev OUTPUT_FILE=k8s/config/secrets.dev.yaml ./k8s/scripts/generate-secrets.sh

# Generate prod secrets
NAMESPACE=mcp-agent-prod OUTPUT_FILE=k8s/config/secrets.prod.yaml ./k8s/scripts/generate-secrets.sh
```

## Troubleshooting

### Missing Environment Variables

**Error**: `Missing required environment variables: DD_API_KEY`

**Solution**: Export the required environment variables:
```bash
export DD_API_KEY='your-key'
export OPENAI_API_KEY='your-key'
./k8s/scripts/generate-secrets.sh
```

### Secrets Not Applied to Cluster

**Check secret exists**:
```bash
kubectl get secrets -n mcp-agent-dev
```

**View secret details** (base64 encoded):
```bash
kubectl get secret app-secrets -n mcp-agent-dev -o yaml
```

**Decode a secret value**:
```bash
kubectl get secret app-secrets -n mcp-agent-dev -o jsonpath='{.data.datadog-api-key}' | base64 -d
```

### Pods Not Picking Up Secrets

**Restart deployments** after updating secrets:
```bash
kubectl rollout restart deployment/agent-api -n mcp-agent-dev
kubectl rollout restart deployment/burger-api -n mcp-agent-dev
```

### Accidentally Committed Secrets

**If you accidentally committed secrets to git**:

1. **Immediately rotate the exposed secrets** (get new API keys)
2. Remove the file from git history:
```bash
# Remove from current commit
git rm k8s/config/secrets.yaml
git commit --amend

# If already pushed, use git-filter-branch or BFG Repo-Cleaner
# See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
```

3. Update `.gitignore` to prevent future commits

## Using GCP Secret Manager (Recommended for Production)

For production environments, consider using GCP Secret Manager with External Secrets Operator:

### 1. Store Secrets in GCP Secret Manager

```bash
# Create secrets in GCP
echo -n "your-dd-key" | gcloud secrets create dd-api-key --data-file=-
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
```

### 2. Install External Secrets Operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

### 3. Configure External Secret

Create `k8s/manifests/external-secret.yaml`:
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: mcp-agent-dev
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcpsm-secret-store
    kind: SecretStore
  target:
    name: app-secrets
  data:
  - secretKey: datadog-api-key
    remoteRef:
      key: dd-api-key
  - secretKey: openai-api-key
    remoteRef:
      key: openai-api-key
```

## Reference: Secret Keys Used in Deployments

The following secret keys are referenced in the Kubernetes manifests:

| Secret Key | Used By | Environment Variable |
|------------|---------|---------------------|
| `datadog-api-key` | All services | `DD_API_KEY` |
| `openai-api-key` | agent-api | `OPENAI_API_KEY` |
| `vertex-ai-key` | agent-api | `VERTEX_AI_KEY` (optional) |
| `gcp-sa-key` | All services | `GCP_SA_KEY_FILE` (optional) |

## Getting Help

- Check if secrets are properly formatted: `kubectl get secret app-secrets -n mcp-agent-dev -o yaml`
- Verify pods can access secrets: `kubectl exec -it <pod-name> -n mcp-agent-dev -- env | grep API_KEY`
- Review deployment logs: `kubectl logs deployment/agent-api -n mcp-agent-dev`

## Additional Resources

- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
- [External Secrets Operator](https://external-secrets.io/)
- [12-Factor App: Config](https://12factor.net/config)
