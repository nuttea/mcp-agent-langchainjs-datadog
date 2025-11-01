# GitHub Secrets vs Variables Configuration

GitHub Actions supports two types of configuration: **Secrets** (encrypted, sensitive) and **Variables** (plain text, non-sensitive). This guide explains which values should go where.

## Quick Reference

### Variables (Non-Sensitive Configuration)
Use **Settings → Secrets and variables → Actions → Variables** for:

```bash
# GCP Configuration (non-sensitive)
GCP_PROJECT_ID=datadog-ese-sandbox
GKE_CLUSTER=nuttee-cluster-1
GKE_ZONE=asia-southeast1-b
GAR_LOCATION=us-central1
GAR_REPOSITORY=mcp-agent

# Workload Identity (non-sensitive, but long)
WIF_PROVIDER=projects/449012790678/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
WIF_SERVICE_ACCOUNT=github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com

# PostgreSQL Configuration (non-sensitive)
POSTGRES_USER=burgerapp
POSTGRES_DB=burgerdb
```

### Secrets (Sensitive Data)
Use **Settings → Secrets and variables → Actions → Secrets** for:

```bash
# API Keys (SENSITIVE)
OPENAI_API_KEY=sk-proj-...
DD_API_KEY=...

# Passwords (SENSITIVE)
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-random-secret
```

## Why This Distinction?

### Variables (Plain Text)
- ✅ **Visible** in workflow logs and UI
- ✅ **Easier to debug** configuration issues
- ✅ **Can be referenced** in workflow conditions
- ✅ **Not encrypted** - suitable for non-sensitive data
- ✅ **Version controlled** (can see history)

### Secrets (Encrypted)
- ✅ **Encrypted at rest** and in transit
- ✅ **Redacted** in logs (shows ***)
- ✅ **Cannot be read** back via API
- ✅ **Limited visibility** for security
- ⚠️ **Harder to debug** if misconfigured

## Workflow Usage

### Using Variables
```yaml
env:
  GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  GKE_CLUSTER: ${{ vars.GKE_CLUSTER }}
  POSTGRES_USER: ${{ vars.POSTGRES_USER }}
```

### Using Secrets
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  DD_API_KEY: ${{ secrets.DD_API_KEY }}
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
```

## Complete Configuration

### Repository Variables
Go to: **Repository → Settings → Secrets and variables → Actions → Variables tab**

| Variable | Value | Description |
|----------|-------|-------------|
| `GCP_PROJECT_ID` | `datadog-ese-sandbox` | GCP Project ID |
| `GKE_CLUSTER` | `nuttee-cluster-1` | GKE cluster name |
| `GKE_ZONE` | `asia-southeast1-b` | GKE cluster zone |
| `GAR_LOCATION` | `us-central1` | Artifact Registry location |
| `GAR_REPOSITORY` | `mcp-agent` | Artifact Registry repo name |
| `WIF_PROVIDER` | `projects/449012790678/locations/global/...` | Workload Identity Provider |
| `WIF_SERVICE_ACCOUNT` | `github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com` | Service Account email |
| `POSTGRES_USER` | `burgerapp` | PostgreSQL username |
| `POSTGRES_DB` | `burgerdb` | PostgreSQL database name |

### Repository Secrets
Go to: **Repository → Settings → Secrets and variables → Actions → Secrets tab**

| Secret | Description | How to Get |
|--------|-------------|------------|
| `OPENAI_API_KEY` | OpenAI API key | https://platform.openai.com/api-keys |
| `DD_API_KEY` | Datadog API key | https://app.datadoghq.com/organization-settings/api-keys |
| `POSTGRES_PASSWORD` | PostgreSQL password | Generate: `openssl rand -base64 25` |
| `JWT_SECRET` | JWT signing secret | Generate: `openssl rand -base64 50` |

## Setting Up Variables

### Via GitHub CLI
```bash
# Set variables (non-sensitive)
gh variable set GCP_PROJECT_ID --body "datadog-ese-sandbox"
gh variable set GKE_CLUSTER --body "nuttee-cluster-1"
gh variable set GKE_ZONE --body "asia-southeast1-b"
gh variable set GAR_LOCATION --body "us-central1"
gh variable set GAR_REPOSITORY --body "mcp-agent"
gh variable set WIF_PROVIDER --body "projects/449012790678/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
gh variable set WIF_SERVICE_ACCOUNT --body "github-actions-sa@datadog-ese-sandbox.iam.gserviceaccount.com"
gh variable set POSTGRES_USER --body "burgerapp"
gh variable set POSTGRES_DB --body "burgerdb"

# Set secrets (sensitive)
gh secret set OPENAI_API_KEY
gh secret set DD_API_KEY
gh secret set POSTGRES_PASSWORD
gh secret set JWT_SECRET
```

### Via Web UI
1. Go to repository **Settings**
2. Navigate to **Secrets and variables → Actions**
3. Use **Variables** tab for non-sensitive data
4. Use **Secrets** tab for sensitive data
5. Click **New repository variable/secret**

## Migration from All-Secrets Setup

If you previously had everything as secrets:

### Step 1: Add Variables
Add the 9 non-sensitive values as Variables (see table above)

### Step 2: Workflow Already Updated
The workflow has been updated to use `vars.*` for non-sensitive values:
```yaml
env:
  GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}        # Changed from secrets
  GKE_CLUSTER: ${{ vars.GKE_CLUSTER }}              # Changed from secrets
  GKE_ZONE: ${{ vars.GKE_ZONE }}                    # Changed from secrets
  GAR_LOCATION: ${{ vars.GAR_LOCATION }}            # Changed from secrets
  GAR_REPOSITORY: ${{ vars.GAR_REPOSITORY }}        # Changed from secrets
```

### Step 3: Keep Secrets
Keep these as secrets (they're already correct):
- `OPENAI_API_KEY`
- `DD_API_KEY`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`

### Step 4: Optional Cleanup
You can delete the old secret versions of non-sensitive values, but it's not required. Variables take precedence.

## Benefits of This Approach

### Better Security
- ✅ Only sensitive data is encrypted
- ✅ Clear separation of concerns
- ✅ Follows principle of least privilege
- ✅ Easier to audit sensitive vs non-sensitive

### Better Developer Experience
- ✅ Configuration visible in logs for debugging
- ✅ Can see variable values without admin access
- ✅ Easier to spot configuration errors
- ✅ Better documentation (variables show in UI)

### Better Maintainability
- ✅ Clear which values are sensitive
- ✅ Easier to update non-sensitive config
- ✅ Version history for variables
- ✅ Reduced secret sprawl

## Security Best Practices

### What Should Be Secrets
- ✅ API keys and tokens
- ✅ Passwords and passphrases
- ✅ Private keys and certificates
- ✅ Database credentials
- ✅ OAuth client secrets
- ✅ Signing secrets and salts

### What Can Be Variables
- ✅ Project IDs and names
- ✅ Resource names (clusters, repositories)
- ✅ Region and zone identifiers
- ✅ Non-sensitive configuration
- ✅ Service account emails (public)
- ✅ Workload Identity providers (public)
- ✅ Usernames (without passwords)
- ✅ Database names (without credentials)

## Troubleshooting

### Variable Not Found
```
Error: Unrecognized named-value: 'vars'
```
**Solution**: Variables are available in GitHub Actions since 2023. Ensure your repository has access.

### Secret Shows as Empty
```
Error: Required secret OPENAI_API_KEY not set
```
**Solution**: Check that the secret is set in the correct repository (not organization level).

### Wrong Context
```yaml
# ❌ Wrong - using secret for non-sensitive data
GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}

# ✅ Correct - using variable
GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
```

## Updating setup-github-secrets.sh

The setup script can be enhanced to support both secrets and variables:

```bash
# Set variables (non-sensitive)
echo "${GCP_PROJECT_ID}" | gh variable set GCP_PROJECT_ID
echo "${GKE_CLUSTER}" | gh variable set GKE_CLUSTER
echo "${GKE_ZONE}" | gh variable set GKE_ZONE
echo "${GAR_LOCATION}" | gh variable set GAR_LOCATION
echo "${GAR_REPOSITORY}" | gh variable set GAR_REPOSITORY
echo "${WIF_PROVIDER}" | gh variable set WIF_PROVIDER
echo "${WIF_SERVICE_ACCOUNT}" | gh variable set WIF_SERVICE_ACCOUNT
echo "${POSTGRES_USER}" | gh variable set POSTGRES_USER
echo "${POSTGRES_DB}" | gh variable set POSTGRES_DB

# Set secrets (sensitive)
echo "${OPENAI_API_KEY}" | gh secret set OPENAI_API_KEY
echo "${DD_API_KEY}" | gh secret set DD_API_KEY
echo "${POSTGRES_PASSWORD}" | gh secret set POSTGRES_PASSWORD
echo "${JWT_SECRET}" | gh secret set JWT_SECRET
```

## Verification

Check that everything is set correctly:

```bash
# List variables
gh variable list

# List secrets (names only, values are hidden)
gh secret list

# Test in workflow
# Variables will show their values in logs
# Secrets will show as ***
```

## References

- [GitHub Actions - Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions - Variables](https://docs.github.com/en/actions/learn-github-actions/variables)
- [GitHub CLI - gh variable](https://cli.github.com/manual/gh_variable)
- [GitHub CLI - gh secret](https://cli.github.com/manual/gh_secret)
