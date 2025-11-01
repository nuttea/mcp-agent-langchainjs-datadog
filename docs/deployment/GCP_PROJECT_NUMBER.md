# Getting GCP Project Number from Project ID

The GCP **Project Number** is a unique numeric identifier that's different from the **Project ID** (string identifier). The project number is required for Workload Identity Federation and some IAM configurations.

## Quick Commands

### Method 1: Using gcloud (Recommended)

```bash
# Get project number for current project
gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)'

# Get project number for specific project
gcloud projects describe YOUR-PROJECT-ID --format='value(projectNumber)'

# Get both project ID and number
gcloud projects describe YOUR-PROJECT-ID --format='value(projectId,projectNumber)'

# Store in variable
PROJECT_ID="your-project-id"
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
echo "Project ID: ${PROJECT_ID}"
echo "Project Number: ${PROJECT_NUMBER}"
```

### Method 2: Using gcloud with jq

```bash
# Get all project info as JSON
gcloud projects describe YOUR-PROJECT-ID --format=json | jq -r '.projectNumber'

# Or get full details
gcloud projects describe YOUR-PROJECT-ID --format=json | jq '{id: .projectId, number: .projectNumber, name: .name}'
```

### Method 3: List all your projects

```bash
# List all projects with their numbers
gcloud projects list --format='table(projectId,projectNumber,name)'

# Filter for specific project
gcloud projects list --filter="projectId:YOUR-PROJECT-ID" --format='value(projectNumber)'
```

### Method 4: Using Google Cloud Console (Web UI)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project selector at the top
3. The project number is shown next to each project name
4. Or go to: **IAM & Admin → Settings**
5. Project number is displayed at the top

### Method 5: Using curl with gcloud auth

```bash
# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Query Cloud Resource Manager API
curl -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://cloudresourcemanager.googleapis.com/v1/projects/YOUR-PROJECT-ID" | jq -r '.projectNumber'
```

## Example Output

```bash
$ gcloud projects describe datadog-ese-sandbox --format='value(projectNumber)'
123456789012

$ gcloud projects describe datadog-ese-sandbox --format='table(projectId,projectNumber,name)'
PROJECT_ID            PROJECT_NUMBER  NAME
datadog-ese-sandbox   123456789012    Datadog ESE Sandbox
```

## Using in Scripts

### Automated Script

```bash
#!/bin/bash

# Get project number automatically
PROJECT_ID="${1:-$(gcloud config get-value project)}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo "Error: No project ID specified and no default project configured"
    exit 1
fi

echo "Getting project number for: ${PROJECT_ID}"
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

if [[ -z "${PROJECT_NUMBER}" ]]; then
    echo "Error: Could not get project number. Check if project exists and you have access."
    exit 1
fi

echo "Project ID: ${PROJECT_ID}"
echo "Project Number: ${PROJECT_NUMBER}"

# Export for use in other commands
export PROJECT_ID
export PROJECT_NUMBER
```

### In Workload Identity Setup

```bash
# Example from setup-workload-identity.sh
PROJECT_ID="your-project-id"
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')

# Use in Workload Identity Provider configuration
WORKLOAD_IDENTITY_POOL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions-pool"
```

## Common Use Cases

### 1. Workload Identity Federation

```bash
# Full WIF provider path requires project number
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NAME/providers/PROVIDER_NAME
```

### 2. Service Account Principal

```bash
# Allow specific principal to impersonate service account
principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NAME/attribute.repository/REPO
```

### 3. IAM Policy Bindings

```bash
# Some IAM policies require project number
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/..." \
  --role="roles/iam.workloadIdentityUser"
```

## Troubleshooting

### Error: Project not found

```bash
# Check if project exists and you have access
gcloud projects list | grep YOUR-PROJECT-ID

# Check current authenticated account
gcloud auth list

# Ensure you have the right permissions
gcloud projects get-iam-policy YOUR-PROJECT-ID
```

### Error: Permission denied

```bash
# You need at least resourcemanager.projects.get permission
# This is included in these roles:
# - roles/viewer
# - roles/editor
# - roles/owner
# - roles/resourcemanager.projectIamAdmin
```

### Error: gcloud not configured

```bash
# Set default project
gcloud config set project YOUR-PROJECT-ID

# Or authenticate
gcloud auth login
```

## Project ID vs Project Number

| Attribute | Project ID | Project Number |
|-----------|-----------|----------------|
| **Format** | String (lowercase, numbers, hyphens) | Numeric only |
| **Example** | `my-project-123` | `123456789012` |
| **User-defined** | Yes (at creation) | No (auto-generated) |
| **Mutable** | No (permanent) | No (permanent) |
| **Used in** | Most gcloud commands, URLs | Workload Identity, some IAM policies |
| **Display in Console** | Prominently shown | Shown in parentheses |

## Quick Reference Script

Save this as `get-project-number.sh`:

```bash
#!/bin/bash
# Get GCP Project Number
# Usage: ./get-project-number.sh [PROJECT_ID]

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo "Usage: $0 [PROJECT_ID]"
    echo "Or set default project: gcloud config set project PROJECT_ID"
    exit 1
fi

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)' 2>/dev/null)

if [[ -z "${PROJECT_NUMBER}" ]]; then
    echo "Error: Could not retrieve project number for '${PROJECT_ID}'"
    echo "Possible reasons:"
    echo "  - Project does not exist"
    echo "  - You don't have access to the project"
    echo "  - Project ID is incorrect"
    exit 1
fi

echo "${PROJECT_NUMBER}"
```

Make it executable and use:

```bash
chmod +x get-project-number.sh

# Get for current project
./get-project-number.sh

# Get for specific project
./get-project-number.sh my-project-id

# Store in variable
PROJECT_NUMBER=$(./get-project-number.sh my-project-id)
```

## Integration with Existing Scripts

Our `setup-workload-identity.sh` already does this automatically:

```bash
# From setup-workload-identity.sh
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
```

The script uses the project number to construct the Workload Identity Provider path and configure impersonation.

## Related Documentation

- [GCP Project Documentation](https://cloud.google.com/resource-manager/docs/creating-managing-projects)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [gcloud projects describe](https://cloud.google.com/sdk/gcloud/reference/projects/describe)
