# CI/CD Quick Start Guide

Get your GitHub Actions CI/CD pipeline up and running in minutes.

## Prerequisites

- Google Cloud Project with billing enabled
- GKE cluster running
- GitHub repository with admin access
- `gcloud` CLI installed and authenticated

## Quick Setup (5 minutes)

### Step 1: Run Workload Identity Setup

```bash
# Make script executable
chmod +x scripts/setup-workload-identity.sh

# Run the setup script
./scripts/setup-workload-identity.sh
```

The script will:
1. ✅ Create Workload Identity Pool
2. ✅ Create Workload Identity Provider
3. ✅ Create Service Account with required permissions
4. ✅ Configure impersonation
5. ✅ Create Artifact Registry repository
6. ✅ Generate GitHub secrets summary

### Step 2: Configure Secrets

**Option A: Automated Setup with .env file (Recommended)**

```bash
# 1. Copy the example file
cp .env.github.example .env.github

# 2. Edit .env.github with your values
vim .env.github  # or use your preferred editor

# 3. Generate secure passwords
./scripts/setup-github-secrets.sh --generate

# 4. Copy generated passwords to .env.github

# 5. Setup GitHub secrets automatically (requires GitHub CLI)
gh auth login  # if not already authenticated
./scripts/setup-github-secrets.sh --auto --env-file .env.github

# OR manually via web UI
./scripts/setup-github-secrets.sh --env-file .env.github
```

**Option B: Manual Setup**

Copy secrets to: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

Required secrets:
```bash
GCP_PROJECT_ID=your-project-id
GKE_CLUSTER=mcp-agent-cluster
GKE_ZONE=us-central1-a
GAR_LOCATION=us-central1
GAR_REPOSITORY=mcp-agent
WIF_PROVIDER=projects/.../providers/github-provider
WIF_SERVICE_ACCOUNT=github-actions-sa@project.iam.gserviceaccount.com
OPENAI_API_KEY=sk-...
DD_API_KEY=...
POSTGRES_USER=burgerapp
POSTGRES_PASSWORD=<generate-secure>
POSTGRES_DB=burgerdb
JWT_SECRET=<generate-random>
```

### Step 3: Create Production Branch

```bash
git checkout -b prod
git push origin prod
```

### Step 4: Push to Main

```bash
git checkout main
git add .
git commit -m "feat: add CI/CD pipeline"
git push origin main
```

GitHub Actions will automatically:
1. Detect changed packages
2. Build Docker images
3. Push to Artifact Registry
4. Deploy to dev environment

## Usage

### Deploy to Dev
```bash
# Push to main branch
git push origin main
```

### Deploy to Prod
```bash
# Merge main to prod
git checkout prod
git merge main
git push origin prod
```

### Manual Deployment
Go to **Actions → Build and Deploy to GKE → Run workflow**

## Monitoring

### View Deployment Status
```bash
# Check workflow runs
# Go to: https://github.com/YOUR_USER/YOUR_REPO/actions

# Check pods
kubectl get pods -n mcp-agent-dev
kubectl get pods -n mcp-agent-prod
```

### View Logs
```bash
# GitHub Actions logs
# Go to Actions → Select run → Select job

# Kubernetes logs
kubectl logs -n mcp-agent-dev deployment/agent-api -f
```

## Workflow Features

### 🎯 Intelligent Build
- Only builds packages that changed
- Matrix strategy builds all in parallel
- Docker layer caching for speed

### 🏷️ Image Tagging
- Commit hash: `image:abc1234` (primary)
- Branch: `image:main` or `image:prod`
- Latest: `image:latest` (main only)

### 🚀 Deployment Strategy
- **Dev**: Rolling update (fast)
- **Prod**: Canary deployment (safe)
  - Deploy 1 canary replica
  - Monitor for 30 seconds
  - Roll out to all replicas
  - Auto-rollback on failure

### 🧹 Auto Cleanup
- Keeps last 10 images per package
- Runs after successful deployment
- Reduces storage costs

## Troubleshooting

### Authentication Failed
```bash
# Verify Workload Identity setup
gcloud iam workload-identity-pools providers describe github-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-actions-pool
```

### Build Failed
```bash
# Check Artifact Registry permissions
gcloud artifacts repositories get-iam-policy REPO_NAME \
  --location=LOCATION
```

### Deployment Failed
```bash
# Check pod events
kubectl describe pod POD_NAME -n NAMESPACE

# Check logs
kubectl logs POD_NAME -n NAMESPACE
```

## Next Steps

- ✅ Set up branch protection rules
- ✅ Configure environment protection (require reviews for prod)
- ✅ Add Slack notifications
- ✅ Set up automated testing
- ✅ Enable vulnerability scanning

## Full Documentation

For complete setup instructions and advanced configuration:
- [GitHub Actions Setup Guide](GITHUB_ACTIONS_SETUP.md)
- [Workload Identity Documentation](https://cloud.google.com/iam/docs/workload-identity-federation)

## Security Notes

✅ **Workload Identity**: No service account keys needed
✅ **Branch Protection**: Protect main and prod branches
✅ **Environment Protection**: Require reviews for prod
✅ **Secret Rotation**: Rotate secrets regularly
✅ **Least Privilege**: Minimal required permissions
