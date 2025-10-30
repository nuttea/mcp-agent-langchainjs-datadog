# Secrets Quick Start Guide

This is a quick reference for managing secrets securely for GKE deployment.

## TL;DR - Quick Setup

```bash
# 1. Set your environment variables (add to ~/.zshrc or ~/.bashrc)
export DD_API_KEY='your-datadog-api-key'
export OPENAI_API_KEY='your-openai-api-key'

# 2. Reload shell
source ~/.zshrc

# 3. Generate secrets file
./k8s/scripts/generate-secrets.sh

# 4. Deploy (includes secrets)
./k8s/scripts/deploy.sh
```

That's it! The secrets are generated locally and never committed to git.

## File Security Overview

### ✅ Safe to Commit (Already in Git)
- `k8s/config/secrets.example.yaml` - Template only
- `k8s/scripts/generate-secrets.sh` - Generation script
- `.gitignore` - Blocks real secrets

### ❌ Never Commit (Automatically Ignored)
- `k8s/config/secrets.yaml` - Contains real secrets
- Any file matching `**/secrets.yaml` or `secrets.*.yaml`

## Verification

Check that secrets.yaml is ignored:
```bash
git status
# Should NOT show k8s/config/secrets.yaml

# Double check .gitignore contains:
grep secrets .gitignore
```

## What Each Tool Does

| Tool | Purpose |
|------|---------|
| [generate-secrets.sh](scripts/generate-secrets.sh) | Reads env vars → Creates secrets.yaml |
| [deploy.sh](scripts/deploy.sh) | Auto-generates secrets if needed → Deploys to GKE |
| [.gitignore](../.gitignore) | Prevents accidental commits |

## Environment Variables Required

| Variable | Required | Used By | Purpose |
|----------|----------|---------|---------|
| `DD_API_KEY` | ✅ Yes | All services | Datadog monitoring |
| `OPENAI_API_KEY` | ✅ Yes | agent-api | LLM integration |
| `VERTEX_AI_KEY` | ❌ Optional | agent-api | Alternative to OpenAI |
| `GCP_SA_KEY_FILE` | ❌ Optional | All services | GCP authentication |

## Common Commands

### Generate secrets manually
```bash
./k8s/scripts/generate-secrets.sh
```

### Apply secrets to cluster
```bash
kubectl apply -f k8s/config/secrets.yaml
```

### View secrets in cluster (base64 encoded)
```bash
kubectl get secret app-secrets -n mcp-agent-dev -o yaml
```

### Decode a secret value
```bash
kubectl get secret app-secrets -n mcp-agent-dev \
  -o jsonpath='{.data.datadog-api-key}' | base64 -d
```

### Update existing secrets
```bash
# Regenerate
./k8s/scripts/generate-secrets.sh

# Apply changes
kubectl apply -f k8s/config/secrets.yaml

# Restart pods to pick up changes
kubectl rollout restart deployment/agent-api -n mcp-agent-dev
kubectl rollout restart deployment/burger-api -n mcp-agent-dev
```

### Delete secrets
```bash
kubectl delete secret app-secrets -n mcp-agent-dev
```

## Troubleshooting

### "Missing required environment variables"
```bash
# Check if variables are set
echo $DD_API_KEY
echo $OPENAI_API_KEY

# If empty, export them
export DD_API_KEY='your-key'
export OPENAI_API_KEY='your-key'

# Make permanent by adding to ~/.zshrc or ~/.bashrc
```

### "Pods not picking up secrets"
```bash
# Check secret exists
kubectl get secret app-secrets -n mcp-agent-dev

# Check pod has access
kubectl describe pod <pod-name> -n mcp-agent-dev | grep -A5 "Environment"

# Restart deployment
kubectl rollout restart deployment/<deployment-name> -n mcp-agent-dev
```

### "Accidentally committed secrets"
1. **IMMEDIATELY** rotate the exposed secrets (get new keys)
2. Remove from git history (see [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md))
3. Never push the bad commit

## Security Reminders

- ❌ **NEVER** commit `secrets.yaml` to git
- ❌ **NEVER** share secrets via Slack/email/chat
- ✅ **ALWAYS** use environment variables for local secrets
- ✅ **ALWAYS** rotate secrets regularly
- ✅ **ALWAYS** use different secrets for dev/prod

## Full Documentation

For detailed information, see [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md)

## Need Help?

1. Check `.gitignore` includes secrets patterns
2. Verify environment variables are set: `env | grep -E "DD_API_KEY|OPENAI_API_KEY"`
3. Test script: `./k8s/scripts/generate-secrets.sh`
4. Check deployment: `./k8s/scripts/deploy.sh`
