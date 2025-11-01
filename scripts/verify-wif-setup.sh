#!/bin/bash
# Verify and Fix Workload Identity Federation Setup
# This script checks if all WIF components are properly configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_check() { echo -e "${BLUE}[CHECK]${NC} $1"; }

# Configuration
PROJECT_ID="datadog-ese-sandbox"
PROJECT_NUMBER="449012790678"
SA_NAME="github-actions-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"

echo ""
print_info "=== Workload Identity Federation Verification ==="
echo ""
print_info "Project ID: ${PROJECT_ID}"
print_info "Project Number: ${PROJECT_NUMBER}"
print_info "Service Account: ${SA_EMAIL}"
echo ""

# Check 1: Service Account Exists
print_check "Checking if service account exists..."
if gcloud iam service-accounts describe ${SA_EMAIL} --project=${PROJECT_ID} &>/dev/null; then
    print_info "✓ Service account exists"
else
    print_error "✗ Service account NOT found!"
    echo ""
    echo "To create service account:"
    echo "  gcloud iam service-accounts create ${SA_NAME} \\"
    echo "    --project=${PROJECT_ID} \\"
    echo "    --display-name=\"GitHub Actions Service Account\""
    echo ""
    exit 1
fi

# Check 2: Service Account Permissions
print_check "Checking service account permissions..."
REQUIRED_ROLES=(
    "roles/container.developer"
    "roles/artifactregistry.writer"
    "roles/iam.serviceAccountUser"
)

MISSING_ROLES=()
for ROLE in "${REQUIRED_ROLES[@]}"; do
    if gcloud projects get-iam-policy ${PROJECT_ID} \
        --flatten="bindings[].members" \
        --filter="bindings.members:serviceAccount:${SA_EMAIL} AND bindings.role:${ROLE}" \
        --format="value(bindings.role)" | grep -q "${ROLE}"; then
        print_info "✓ Has ${ROLE}"
    else
        print_error "✗ Missing ${ROLE}"
        MISSING_ROLES+=("${ROLE}")
    fi
done

if [ ${#MISSING_ROLES[@]} -gt 0 ]; then
    echo ""
    echo "To grant missing roles:"
    for ROLE in "${MISSING_ROLES[@]}"; do
        echo "  gcloud projects add-iam-policy-binding ${PROJECT_ID} \\"
        echo "    --member=\"serviceAccount:${SA_EMAIL}\" \\"
        echo "    --role=\"${ROLE}\""
    done
    echo ""
fi

# Check 3: Workload Identity Pool
print_check "Checking Workload Identity Pool..."
if gcloud iam workload-identity-pools describe ${POOL_NAME} \
    --project=${PROJECT_ID} \
    --location=global &>/dev/null; then
    print_info "✓ Workload Identity Pool exists"
else
    print_error "✗ Workload Identity Pool NOT found!"
    echo ""
    echo "To create pool:"
    echo "  gcloud iam workload-identity-pools create ${POOL_NAME} \\"
    echo "    --project=${PROJECT_ID} \\"
    echo "    --location=global \\"
    echo "    --display-name=\"GitHub Actions Pool\""
    echo ""
    exit 1
fi

# Check 4: Workload Identity Provider
print_check "Checking Workload Identity Provider..."
if gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
    --project=${PROJECT_ID} \
    --location=global \
    --workload-identity-pool=${POOL_NAME} &>/dev/null; then
    print_info "✓ Workload Identity Provider exists"

    # Get provider details
    PROVIDER_PATH=$(gcloud iam workload-identity-pools providers describe ${PROVIDER_NAME} \
        --project=${PROJECT_ID} \
        --location=global \
        --workload-identity-pool=${POOL_NAME} \
        --format="value(name)")
    print_info "  Provider: ${PROVIDER_PATH}"
else
    print_error "✗ Workload Identity Provider NOT found!"
    echo ""
    echo "To create provider, run: ./scripts/setup-workload-identity.sh"
    echo ""
    exit 1
fi

# Check 5: Workload Identity Binding
print_check "Checking Workload Identity binding..."
if gcloud iam service-accounts get-iam-policy ${SA_EMAIL} \
    --project=${PROJECT_ID} \
    --flatten="bindings[].members" \
    --filter="bindings.role:roles/iam.workloadIdentityUser" \
    --format="value(bindings.members[])" | grep -q "principalSet"; then
    print_info "✓ Workload Identity binding exists"
else
    print_error "✗ Workload Identity binding NOT found!"
    echo ""
    echo "To create binding (replace YOUR_REPO):"
    echo "  gcloud iam service-accounts add-iam-policy-binding ${SA_EMAIL} \\"
    echo "    --project=${PROJECT_ID} \\"
    echo "    --role=\"roles/iam.workloadIdentityUser\" \\"
    echo "    --member=\"principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/YOUR_GITHUB_USER/YOUR_REPO\""
    echo ""
fi

# Check 6: Artifact Registry
print_check "Checking Artifact Registry repository..."
if gcloud artifacts repositories describe mcp-agent \
    --project=${PROJECT_ID} \
    --location=us-central1 &>/dev/null; then
    print_info "✓ Artifact Registry repository exists"
else
    print_warn "✗ Artifact Registry repository NOT found!"
    echo ""
    echo "To create repository:"
    echo "  gcloud artifacts repositories create mcp-agent \\"
    echo "    --project=${PROJECT_ID} \\"
    echo "    --repository-format=docker \\"
    echo "    --location=us-central1 \\"
    echo "    --description=\"Docker images for MCP Agent\""
    echo ""
fi

# Summary
echo ""
print_info "=== Summary ==="
echo ""

if [ ${#MISSING_ROLES[@]} -eq 0 ]; then
    print_info "✓ All required permissions are configured"
    print_info "✓ Workload Identity is properly set up"
    echo ""
    print_info "GitHub Variables should be:"
    echo "  WIF_PROVIDER=${PROVIDER_PATH}"
    echo "  WIF_SERVICE_ACCOUNT=${SA_EMAIL}"
    echo ""
    print_info "Next steps:"
    echo "  1. Verify GitHub Variables match above"
    echo "  2. Re-run GitHub Actions workflow"
    echo ""
else
    print_error "⚠ Missing permissions detected"
    echo ""
    print_info "Run this command to fix all permissions:"
    echo ""
    echo "for role in ${REQUIRED_ROLES[@]}; do"
    echo "  gcloud projects add-iam-policy-binding ${PROJECT_ID} \\"
    echo "    --member=\"serviceAccount:${SA_EMAIL}\" \\"
    echo "    --role=\"\${role}\""
    echo "done"
    echo ""
fi
