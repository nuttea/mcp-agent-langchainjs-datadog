#!/bin/bash
# Setup Workload Identity Federation for GitHub Actions
# This script automates the setup of Workload Identity to allow GitHub Actions
# to authenticate to Google Cloud without service account keys

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not found. Please install it: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warn "jq not found. Installing jq for JSON parsing..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install jq
        else
            sudo apt-get install -y jq
        fi
    fi

    print_info "Prerequisites check passed!"
}

# Get user input
get_configuration() {
    print_info "=== Workload Identity Federation Setup ==="
    echo ""

    # Get project ID
    read -p "Enter your GCP Project ID: " PROJECT_ID
    if [[ -z "${PROJECT_ID}" ]]; then
        print_error "Project ID cannot be empty"
        exit 1
    fi

    # Get GitHub repository
    read -p "Enter your GitHub repository (format: owner/repo): " GITHUB_REPO
    if [[ -z "${GITHUB_REPO}" ]]; then
        print_error "GitHub repository cannot be empty"
        exit 1
    fi

    # Set default values or get custom values
    read -p "Workload Identity Pool name [github-actions-pool]: " POOL_NAME
    POOL_NAME=${POOL_NAME:-github-actions-pool}

    read -p "Provider name [github-provider]: " PROVIDER_NAME
    PROVIDER_NAME=${PROVIDER_NAME:-github-provider}

    read -p "Service Account name [github-actions-sa]: " SA_NAME
    SA_NAME=${SA_NAME:-github-actions-sa}

    # Derived values
    PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')
    SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

    echo ""
    print_info "Configuration Summary:"
    echo "  Project ID: ${PROJECT_ID}"
    echo "  Project Number: ${PROJECT_NUMBER}"
    echo "  GitHub Repo: ${GITHUB_REPO}"
    echo "  Pool Name: ${POOL_NAME}"
    echo "  Provider Name: ${PROVIDER_NAME}"
    echo "  Service Account: ${SA_EMAIL}"
    echo ""

    read -p "Continue with this configuration? (y/n): " CONFIRM
    if [[ "${CONFIRM}" != "y" ]]; then
        print_info "Setup cancelled"
        exit 0
    fi
}

# Enable required APIs
enable_apis() {
    print_info "Enabling required Google Cloud APIs..."

    gcloud services enable iamcredentials.googleapis.com \
        --project="${PROJECT_ID}" || true

    gcloud services enable cloudresourcemanager.googleapis.com \
        --project="${PROJECT_ID}" || true

    gcloud services enable sts.googleapis.com \
        --project="${PROJECT_ID}" || true

    gcloud services enable container.googleapis.com \
        --project="${PROJECT_ID}" || true

    gcloud services enable artifactregistry.googleapis.com \
        --project="${PROJECT_ID}" || true

    print_info "APIs enabled successfully!"
}

# Create Workload Identity Pool
create_pool() {
    print_info "Creating Workload Identity Pool..."

    if gcloud iam workload-identity-pools describe "${POOL_NAME}" \
        --project="${PROJECT_ID}" \
        --location="global" &>/dev/null; then
        print_warn "Workload Identity Pool '${POOL_NAME}' already exists, skipping creation"
    else
        gcloud iam workload-identity-pools create "${POOL_NAME}" \
            --project="${PROJECT_ID}" \
            --location="global" \
            --display-name="GitHub Actions Pool"
        print_info "Workload Identity Pool created!"
    fi
}

# Create Workload Identity Provider
create_provider() {
    print_info "Creating Workload Identity Provider..."

    GITHUB_OWNER="${GITHUB_REPO%%/*}"

    if gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
        --project="${PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" &>/dev/null; then
        print_warn "Provider '${PROVIDER_NAME}' already exists, skipping creation"
    else
        gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
            --project="${PROJECT_ID}" \
            --location="global" \
            --workload-identity-pool="${POOL_NAME}" \
            --display-name="GitHub Provider" \
            --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
            --attribute-condition="assertion.repository_owner == '${GITHUB_OWNER}'" \
            --issuer-uri="https://token.actions.githubusercontent.com"
        print_info "Workload Identity Provider created!"
    fi
}

# Create Service Account
create_service_account() {
    print_info "Creating Service Account..."

    if gcloud iam service-accounts describe "${SA_EMAIL}" \
        --project="${PROJECT_ID}" &>/dev/null; then
        print_warn "Service Account '${SA_EMAIL}' already exists, skipping creation"
    else
        gcloud iam service-accounts create "${SA_NAME}" \
            --project="${PROJECT_ID}" \
            --display-name="GitHub Actions Service Account"
        print_info "Service Account created!"
    fi
}

# Grant permissions
grant_permissions() {
    print_info "Granting permissions to Service Account..."

    # GKE permissions
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/container.developer" \
        --condition=None || true

    # Artifact Registry permissions
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/artifactregistry.writer" \
        --condition=None || true

    # Service Account User
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/iam.serviceAccountUser" \
        --condition=None || true

    print_info "Permissions granted!"
}

# Allow impersonation
allow_impersonation() {
    print_info "Configuring Workload Identity impersonation..."

    gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
        --project="${PROJECT_ID}" \
        --role="roles/iam.workloadIdentityUser" \
        --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

    print_info "Impersonation configured!"
}

# Get provider resource name
get_provider_name() {
    print_info "Getting Workload Identity Provider resource name..."

    WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
        --project="${PROJECT_ID}" \
        --location="global" \
        --workload-identity-pool="${POOL_NAME}" \
        --format="value(name)")

    print_info "Provider resource name: ${WIF_PROVIDER}"
}

# Create Artifact Registry repository
create_artifact_registry() {
    print_info "Creating Artifact Registry repository..."

    read -p "Artifact Registry location [us-central1]: " GAR_LOCATION
    GAR_LOCATION=${GAR_LOCATION:-us-central1}

    read -p "Repository name [mcp-agent]: " GAR_REPOSITORY
    GAR_REPOSITORY=${GAR_REPOSITORY:-mcp-agent}

    if gcloud artifacts repositories describe ${GAR_REPOSITORY} \
        --project=${PROJECT_ID} \
        --location=${GAR_LOCATION} &>/dev/null; then
        print_warn "Repository '${GAR_REPOSITORY}' already exists, skipping creation"
    else
        gcloud artifacts repositories create ${GAR_REPOSITORY} \
            --project=${PROJECT_ID} \
            --repository-format=docker \
            --location=${GAR_LOCATION} \
            --description="Docker images for MCP Agent"
        print_info "Artifact Registry repository created!"
    fi
}

# Generate secrets summary
generate_secrets_summary() {
    print_info "Generating GitHub Secrets summary..."

    cat > /tmp/github-secrets.txt << EOF
==============================================
GitHub Repository Secrets Configuration
==============================================

Add these secrets to your GitHub repository:
Settings → Secrets and variables → Actions → New repository secret

GCP Configuration:
------------------
GCP_PROJECT_ID: ${PROJECT_ID}
GKE_CLUSTER: <your-gke-cluster-name>
GKE_ZONE: <your-gke-cluster-zone>
GAR_LOCATION: ${GAR_LOCATION}
GAR_REPOSITORY: ${GAR_REPOSITORY}
WIF_PROVIDER: ${WIF_PROVIDER}
WIF_SERVICE_ACCOUNT: ${SA_EMAIL}

Application Secrets:
-------------------
OPENAI_API_KEY: <your-openai-api-key>
DD_API_KEY: <your-datadog-api-key>
POSTGRES_USER: burgerapp
POSTGRES_PASSWORD: <generate-secure-password>
POSTGRES_DB: burgerdb
JWT_SECRET: <generate-random-secret>

==============================================
Setup Complete!
==============================================

Next Steps:
1. Copy the secrets above to your GitHub repository
2. Update GKE_CLUSTER and GKE_ZONE with your actual values
3. Generate secure passwords for POSTGRES_PASSWORD and JWT_SECRET
4. Add your OPENAI_API_KEY and DD_API_KEY
5. Push to main branch to trigger deployment

For detailed instructions, see:
docs/deployment/GITHUB_ACTIONS_SETUP.md
EOF

    cat /tmp/github-secrets.txt
    print_info "Secrets summary saved to: /tmp/github-secrets.txt"
}

# Main execution
main() {
    echo ""
    print_info "=== GitHub Actions Workload Identity Setup ==="
    echo ""

    check_prerequisites
    get_configuration
    enable_apis
    create_pool
    create_provider
    create_service_account
    grant_permissions
    allow_impersonation
    get_provider_name
    create_artifact_registry
    generate_secrets_summary

    echo ""
    print_info "✅ Workload Identity Federation setup complete!"
    echo ""
}

# Run main function
main
