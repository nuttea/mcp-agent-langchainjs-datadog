# GitHub Actions CI/CD Setup for GKE

This guide explains how to set up automated CI/CD pipelines using GitHub Actions to deploy to Google Kubernetes Engine (GKE) using Workload Identity Federation (no service account keys required).

## Overview

The GitHub Actions workflow provides:

- **Intelligent Build**: Only builds Docker images for packages that have changed
- **Single Image per Commit**: Images are tagged with commit hash and reused across environments
- **Branch-based Deployment**:
  - `main` branch → Dev environment
  - `prod` branch → Production environment
- **Canary Deployment**: Production uses canary strategy for zero-downtime deployments
- **Workload Identity**: Secure authentication without service account keys

## Architecture

```
Push to main/prod → Detect Changes → Build Changed Packages → Deploy to Environment
                                           ↓
                              Tag images with commit hash
                                           ↓
                              Push to Google Artifact Registry
                                           ↓
                              Deploy to GKE (dev = rolling, prod = canary)
```

## Prerequisites

1. **Google Cloud Project** with:
   - GKE cluster running
   - Artifact Registry repository created
   - Billing enabled

2. **GitHub Repository** with:
   - Admin access to configure secrets
   - Branch protection rules (optional but recommended)

## Step 1: Configure Google Cloud Workload Identity Federation

Workload Identity Federation allows GitHub Actions to authenticate to Google Cloud without using service account keys.

### 1.1 Set Environment Variables

```bash
export PROJECT_ID="your-gcp-project-id"

# Get project number (numeric ID) - see docs/deployment/GCP_PROJECT_NUMBER.md for details
export PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

export GITHUB_REPO="your-github-username/your-repo-name"  # e.g., "octocat/mcp-agent"
export POOL_NAME="github-actions-pool"
export PROVIDER_NAME="github-provider"
export SA_NAME="github-actions-sa"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Verify project number
echo "Project ID: ${PROJECT_ID}"
echo "Project Number: ${PROJECT_NUMBER}"
```

> **Note**: The project number is a unique numeric identifier (e.g., `123456789012`) different from the project ID (string). It's required for Workload Identity Federation. See [GCP_PROJECT_NUMBER.md](GCP_PROJECT_NUMBER.md) for more ways to get it.

### 1.2 Enable Required APIs

```bash
gcloud services enable iamcredentials.googleapis.com \
  --project="${PROJECT_ID}"

gcloud services enable cloudresourcemanager.googleapis.com \
  --project="${PROJECT_ID}"

gcloud services enable sts.googleapis.com \
  --project="${PROJECT_ID}"
```

### 1.3 Create Workload Identity Pool

```bash
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

### 1.4 Create Workload Identity Provider

```bash
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_REPO%%/*}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 1.5 Create Service Account

```bash
gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Service Account"
```

### 1.6 Grant Permissions to Service Account

```bash
# GKE permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/container.developer"

# Artifact Registry permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Additional permissions for deployment
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

### 1.7 Allow GitHub to Impersonate Service Account

```bash
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"
```

### 1.8 Get Workload Identity Provider Resource Name

```bash
gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --format="value(name)"
```

**Save this output!** You'll need it for GitHub secrets. It looks like:
```
projects/123456789/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
```

## Step 2: Create Artifact Registry Repository

```bash
export GAR_LOCATION="us-central1"  # or your preferred region
export GAR_REPOSITORY="mcp-agent"

gcloud artifacts repositories create ${GAR_REPOSITORY} \
  --project=${PROJECT_ID} \
  --repository-format=docker \
  --location=${GAR_LOCATION} \
  --description="Docker images for MCP Agent"
```

## Step 3: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

### GCP Configuration

| Secret Name | Value | Description |
|------------|-------|-------------|
| `GCP_PROJECT_ID` | `your-project-id` | GCP Project ID |
| `GKE_CLUSTER` | `mcp-agent-cluster` | GKE cluster name |
| `GKE_ZONE` | `us-central1-a` | GKE cluster zone |
| `GAR_LOCATION` | `us-central1` | Artifact Registry location |
| `GAR_REPOSITORY` | `mcp-agent` | Artifact Registry repository name |
| `WIF_PROVIDER` | `projects/123.../providers/github-provider` | Workload Identity Provider (from step 1.8) |
| `WIF_SERVICE_ACCOUNT` | `github-actions-sa@project.iam.gserviceaccount.com` | Service Account email |

### Application Secrets

| Secret Name | Value | Description |
|------------|-------|-------------|
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key |
| `DD_API_KEY` | `...` | Datadog API key |
| `POSTGRES_USER` | `burgerapp` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `secure-password` | PostgreSQL password |
| `POSTGRES_DB` | `burgerdb` | PostgreSQL database name |
| `JWT_SECRET` | `random-secret` | JWT signing secret |

## Step 4: Configure GitHub Environments (Optional but Recommended)

GitHub Environments provide additional controls like required reviewers for production deployments.

1. Go to repository Settings → Environments
2. Create two environments: `dev` and `prod`
3. For `prod` environment:
   - Enable "Required reviewers" and add approvers
   - Enable "Wait timer" (optional, e.g., 5 minutes)
   - Add environment-specific secrets if needed

## Step 5: Create Production Branch

```bash
# Create prod branch from main
git checkout main
git pull origin main
git checkout -b prod
git push origin prod

# Set up branch protection for prod
# Go to Settings → Branches → Add branch protection rule
# Pattern: prod
# Enable:
# - Require pull request reviews before merging
# - Require status checks to pass before merging
# - Do not allow bypassing the above settings
```

## Workflow Features

### Intelligent Package Detection

The workflow automatically detects which packages have changed:

```yaml
- packages/agent-api/**     → Builds agent-api image
- packages/burger-api/**    → Builds burger-api image
- k8s/**                    → Deploys without rebuilding
```

### Image Tagging Strategy

Each image is tagged with multiple tags:

```bash
# Primary tag (used for deployment)
us-central1-docker.pkg.dev/project/repo/agent-api:abc1234

# Branch tag
us-central1-docker.pkg.dev/project/repo/agent-api:main

# Latest tag (main branch only)
us-central1-docker.pkg.dev/project/repo/agent-api:latest
```

### Canary Deployment Strategy (Production Only)

Production deployments use canary strategy:

1. **Create Canary**: Deploy 1 replica with new image
2. **Health Check**: Monitor canary for 30 seconds
3. **Validation**: Check if canary pods are healthy
4. **Rollout**: If healthy, update main deployment
5. **Cleanup**: Remove canary deployment
6. **Rollback**: If unhealthy, delete canary and abort

Dev deployments use standard Kubernetes rolling updates.

## Usage

### Deploy to Dev

Simply push to the `main` branch:

```bash
git checkout main
git add .
git commit -m "feat: add new feature"
git push origin main
```

The workflow will:
1. Detect changed packages
2. Build only changed Docker images
3. Deploy to dev environment
4. Run smoke tests

### Deploy to Prod

Merge or push to the `prod` branch:

```bash
# Option 1: Push directly (if allowed)
git checkout prod
git merge main
git push origin prod

# Option 2: Create Pull Request (recommended)
# 1. Create PR from main to prod on GitHub
# 2. Request reviews
# 3. Merge after approval
```

The workflow will:
1. Use existing images from main (tagged with commit hash)
2. Deploy to prod with canary strategy
3. Monitor canary deployment
4. Roll out to all replicas
5. Run smoke tests

### Manual Deployment

Trigger manual deployment via GitHub Actions UI:

1. Go to Actions → "Build and Deploy to GKE"
2. Click "Run workflow"
3. Select branch
4. Choose environment (dev/prod)
5. Optionally skip image build (use existing images)

## Monitoring Deployments

### View Workflow Runs

Go to your repository → Actions tab to see all workflow runs.

### Check Deployment Status

```bash
# View pods in dev
kubectl get pods -n mcp-agent-dev

# View pods in prod
kubectl get pods -n mcp-agent-prod

# View recent deployments
kubectl rollout history deployment/agent-api -n mcp-agent-prod

# Check rollout status
kubectl rollout status deployment/agent-api -n mcp-agent-prod
```

### View Logs

```bash
# GitHub Actions logs
# Go to Actions → Select workflow run → Select job → View logs

# Kubernetes logs
kubectl logs -n mcp-agent-dev deployment/agent-api --tail=50 -f
```

## Troubleshooting

### Workload Identity Authentication Failed

**Error**: `Failed to generate Google Cloud access token`

**Solution**:
1. Verify WIF_PROVIDER secret matches output from step 1.8
2. Check service account email is correct
3. Ensure attribute condition matches your repository owner
4. Verify service account has required permissions

```bash
# Test authentication locally
gcloud iam service-accounts get-iam-policy ${SA_EMAIL}
```

### Image Build Failed

**Error**: `failed to solve: failed to push`

**Solution**:
1. Verify GAR_LOCATION and GAR_REPOSITORY secrets
2. Check service account has `artifactregistry.writer` role
3. Ensure Artifact Registry repository exists

```bash
# List repositories
gcloud artifacts repositories list --project=${PROJECT_ID}

# Check permissions
gcloud artifacts repositories get-iam-policy ${GAR_REPOSITORY} \
  --location=${GAR_LOCATION}
```

### Canary Deployment Failed

**Error**: `Canary deployment failed health check`

**Solution**:
1. Check canary pod logs for errors
2. Verify new image is healthy
3. Check resource limits aren't too restrictive
4. Review startup probe configuration

```bash
# View canary pods
kubectl get pods -n mcp-agent-prod | grep canary

# Check canary logs
kubectl logs -n mcp-agent-prod deployment/agent-api-canary
```

### Deployment Timeout

**Error**: `deployment exceeded its progress deadline`

**Solution**:
1. Increase timeout in workflow (default 5m)
2. Check pod events for issues
3. Verify image pull is successful
4. Check resource availability in cluster

```bash
# Check pod events
kubectl describe pod <pod-name> -n mcp-agent-prod

# Check cluster resources
kubectl top nodes
kubectl describe node <node-name>
```

## Security Best Practices

1. **Use Workload Identity**: Never use service account keys
2. **Branch Protection**: Protect `main` and `prod` branches
3. **Environment Protection**: Require reviews for prod deployments
4. **Secret Rotation**: Rotate secrets regularly
5. **Least Privilege**: Grant minimum required permissions
6. **Audit Logs**: Enable GCP audit logging
7. **Image Scanning**: Enable Container Analysis API for vulnerability scanning

## Advanced Configuration

### Enable Vulnerability Scanning

```bash
gcloud services enable containerscanning.googleapis.com \
  --project=${PROJECT_ID}

# Automatic scanning on push to Artifact Registry
gcloud artifacts repositories update ${GAR_REPOSITORY} \
  --location=${GAR_LOCATION} \
  --enable-vulnerability-scanning
```

### Add Slack Notifications

Add this step to the workflow:

```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Deployment to ${{ matrix.environment }} ${{ job.status }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Deployment Status:* ${{ job.status }}\n*Environment:* ${{ matrix.environment }}\n*Commit:* ${{ github.sha }}"
            }
          }
        ]
      }
```

### Add Datadog Deployment Tracking

Add this step after successful deployment:

```yaml
- name: Track deployment in Datadog
  if: success()
  run: |
    curl -X POST "https://api.datadoghq.com/api/v1/events" \
      -H "Content-Type: application/json" \
      -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
      -d '{
        "title": "Deployment to ${{ matrix.environment }}",
        "text": "Deployed commit ${{ github.sha }} to ${{ matrix.environment }}",
        "tags": ["environment:${{ matrix.environment }}", "service:mcp-agent"]
      }'
```

## Cost Optimization

### Reduce Build Time

1. **Use Build Cache**: Workflow uses GitHub Actions cache
2. **Build Only Changed Packages**: Automatic detection
3. **Parallelize Builds**: Matrix strategy builds all packages in parallel

### Reduce Image Storage Costs

The workflow includes automatic cleanup:
- Keeps last 10 images per package
- Runs after successful deployment
- Deletes old images from Artifact Registry

### Optimize Deployment Time

1. **Dev Environment**: Uses standard rolling update (fast)
2. **Prod Environment**: Uses canary (slower but safer)
3. **Skip Build**: Use `skip_build` for config-only changes

## Migration from Azure

If migrating from the original Azure version:

1. **Remove Azure-specific workflows**: `.github/workflows/azure-dev.yaml`
2. **Update image references**: Change from ACR to GAR
3. **Update deployment scripts**: Use GKE instead of Azure Container Apps
4. **Migrate secrets**: Move from Azure Key Vault to GitHub Secrets

## Next Steps

1. Set up monitoring and alerting in Datadog
2. Configure log aggregation
3. Set up automated testing in workflow
4. Add performance testing
5. Implement automated rollback on errors

## References

- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions for GCP](https://github.com/google-github-actions)
- [Kubernetes Canary Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#canary-pattern)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
