# Troubleshooting Workload Identity Federation

## Error: "Gaia id not found for email github-actions-sa@..."

### Error Message
```
ERROR: (gcloud.auth.docker-helper) There was a problem refreshing your current auth tokens:
('Unable to acquire impersonated credentials',
'{\n  "error": {\n    "code": 404,\n
"message": "Not found; Gaia id not found for email github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com",\n
"status": "NOT_FOUND"\n  }\n}\n')
```

### Root Cause
The service account `github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com` does not exist in your GCP project.

### Solution: Verify and Create Service Account

#### Step 1: Check if Service Account Exists

```bash
# Set your project
export PROJECT_ID="datadog-ese-sandbox"

# List all service accounts
gcloud iam service-accounts list --project=${PROJECT_ID}

# Look for: github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com
```

#### Step 2: Create Service Account (if missing)

```bash
export PROJECT_ID="datadog-ese-sandbox"
export SA_NAME="github-actions-sa"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Create service account
gcloud iam service-accounts create ${SA_NAME} \
  --project=${PROJECT_ID} \
  --display-name="GitHub Actions Service Account" \
  --description="Service account for GitHub Actions CI/CD"

# Verify creation
gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID}
```

#### Step 3: Grant Required Permissions

```bash
export PROJECT_ID="datadog-ese-sandbox"
export SA_EMAIL="github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# GKE permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/container.developer"

# Artifact Registry permissions
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Service Account User (needed for impersonation)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

#### Step 4: Configure Workload Identity Binding

```bash
export PROJECT_ID="datadog-ese-sandbox"
export PROJECT_NUMBER="449012790678"
export SA_EMAIL="github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com"
export GITHUB_REPO="your-github-username/mcp-agent-langchainjs-datadog"
export POOL_NAME="github-actions-pool"

# Allow GitHub Actions to impersonate this service account
gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \
  --project=${PROJECT_ID} \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"
```

#### Step 5: Verify Workload Identity Pool and Provider

```bash
export PROJECT_ID="datadog-ese-sandbox"
export POOL_NAME="github-actions-pool"
export PROVIDER_NAME="github-provider"

# Check pool exists
gcloud iam workload-identity-pools describe ${POOL_NAME} \
  --project=${PROJECT_ID} \
  --location=global

# Check provider exists
gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
  --project=${PROJECT_ID} \
  --location=global \
  --workload-identity-pool=${POOL_NAME}
```

### Quick Fix: Run Setup Script

The easiest way to fix this is to run the setup script:

```bash
./scripts/setup-workload-identity.sh
```

When prompted:
- **Project ID**: `datadog-ese-sandbox`
- **GitHub Repo**: `your-username/your-repo-name`
- **Pool Name**: `github-actions-pool` (default)
- **Provider Name**: `github-provider` (default)
- **Service Account**: `github-actions-sa` (default)

### Verification

#### 1. Verify Service Account

```bash
# Check service account exists
gcloud iam service-accounts describe \
  github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com \
  --project=datadog-ese-sandbox

# Should output:
# email: github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com
# name: projects/datadog-ese-sandbox/serviceAccounts/github-actions-sa@...
```

#### 2. Verify Permissions

```bash
# Check IAM policy for service account
gcloud projects get-iam-policy datadog-ese-sandbox \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com"

# Should show roles:
# - roles/container.developer
# - roles/artifactregistry.writer
# - roles/iam.serviceAccountUser
```

#### 3. Verify Workload Identity Binding

```bash
# Check service account IAM policy
gcloud iam service-accounts get-iam-policy \
  github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com \
  --project=datadog-ese-sandbox

# Should show:
# - role: roles/iam.workloadIdentityUser
# - members: principalSet://iam.googleapis.com/projects/449012790678/...
```

#### 4. Update GitHub Variable

Make sure your GitHub Variable matches the actual service account:

```bash
# Get the exact service account email
gcloud iam service-accounts list \
  --project=datadog-ese-sandbox \
  --filter="email:github-actions-sa*" \
  --format="value(email)"
```

Then update GitHub Variable:
- Go to: **Settings → Secrets and variables → Actions → Variables**
- Update `WIF_SERVICE_ACCOUNT` with exact email from above

### Common Issues

#### Issue 1: Service Account Name Mismatch

**Problem**: Variable has wrong service account name

**Check**:
```bash
# In GitHub: WIF_SERVICE_ACCOUNT = github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com
# In GCP: Service account might have different name

# List all service accounts
gcloud iam service-accounts list --project=datadog-ese-sandbox
```

**Fix**: Update GitHub Variable to match actual service account email

#### Issue 2: Wrong Project ID

**Problem**: Service account created in different project

**Check**:
```bash
# Current project
gcloud config get-value project

# Service accounts in current project
gcloud iam service-accounts list
```

**Fix**: Ensure you're working in `datadog-ese-sandbox` project

#### Issue 3: Workload Identity Pool Not Found

**Problem**: Pool or provider doesn't exist

**Check**:
```bash
gcloud iam workload-identity-pools list \
  --project=datadog-ese-sandbox \
  --location=global
```

**Fix**: Run `./scripts/setup-workload-identity.sh`

#### Issue 4: Missing Permissions

**Problem**: Service account lacks required roles

**Check**:
```bash
gcloud projects get-iam-policy datadog-ese-sandbox \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com" \
  --format="table(bindings.role)"
```

**Fix**: Grant missing roles (see Step 3 above)

### Complete Setup Script

Save this as `fix-wif.sh`:

```bash
#!/bin/bash
set -e

PROJECT_ID="datadog-ese-sandbox"
PROJECT_NUMBER="449012790678"
SA_NAME="github-actions-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"
GITHUB_REPO="YOUR_USERNAME/YOUR_REPO"  # Update this!

echo "Setting up Workload Identity for ${PROJECT_ID}..."

# 1. Create service account (if doesn't exist)
if ! gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID} &>/dev/null; then
  echo "Creating service account..."
  gcloud iam service-accounts create ${SA_NAME} \
    --project=${PROJECT_ID} \
    --display-name="GitHub Actions Service Account"
else
  echo "Service account already exists"
fi

# 2. Grant permissions
echo "Granting permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/container.developer" \
  --condition=None

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --condition=None

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None

# 3. Configure Workload Identity
echo "Configuring Workload Identity..."
gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \
  --project=${PROJECT_ID} \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

echo "✅ Setup complete!"
echo ""
echo "Service Account: ${SA_EMAIL}"
echo ""
echo "Update GitHub Variable:"
echo "WIF_SERVICE_ACCOUNT=${SA_EMAIL}"
```

Usage:
```bash
chmod +x fix-wif.sh
./fix-wif.sh
```

### Testing the Fix

After fixing, test with GitHub Actions:

1. **Trigger workflow manually**:
   - Go to Actions → Build and Deploy to GKE
   - Click "Run workflow"
   - Select branch and environment

2. **Check authentication step**:
   ```
   Run google-github-actions/auth@v2
   ✓ Successfully authenticated with Workload Identity
   ```

3. **Check image push**:
   ```
   #19 pushing layers
   ✓ Successfully pushed to us-central1-docker.pkg.dev/...
   ```

### Related Documentation

- [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) - Complete setup guide
- [GCP Project Number](GCP_PROJECT_NUMBER.md) - How to get project number
- [GitHub Secrets vs Variables](GITHUB_SECRETS_VS_VARIABLES.md) - Configuration guide

## Summary

The error means the service account doesn't exist. To fix:

1. **Quick fix**: Run `./scripts/setup-workload-identity.sh`
2. **Manual fix**: Follow steps 1-4 above
3. **Verify**: Check service account exists and has correct permissions
4. **Update GitHub**: Ensure `WIF_SERVICE_ACCOUNT` variable matches exactly

The service account email should be:
```
github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com
```
