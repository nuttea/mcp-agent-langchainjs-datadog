#!/bin/bash
# Setup GitHub Secrets from .env file
# This script reads secrets from .env and helps you add them to GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}===${NC} $1 ${BLUE}===${NC}\n"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v gh &> /dev/null; then
        print_warn "GitHub CLI (gh) not found. Install it for automatic secret setup:"
        echo "  macOS: brew install gh"
        echo "  Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
        echo ""
        echo "Or manually add secrets via GitHub web UI."
        return 1
    fi

    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        print_warn "Not authenticated to GitHub. Run: gh auth login"
        return 1
    fi

    return 0
}

# Load .env file
load_env_file() {
    local env_file="${1:-.env}"

    if [[ ! -f "${env_file}" ]]; then
        print_error "File ${env_file} not found!"
        echo ""
        echo "Create a .env file with your secrets:"
        cat << 'EOF'
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GKE_CLUSTER=mcp-agent-cluster
GKE_ZONE=us-central1-a
GAR_LOCATION=us-central1
GAR_REPOSITORY=mcp-agent
WIF_PROVIDER=projects/123.../providers/github-provider
WIF_SERVICE_ACCOUNT=github-actions-sa@project.iam.gserviceaccount.com

# Application Secrets
OPENAI_API_KEY=sk-...
DD_API_KEY=...
POSTGRES_USER=burgerapp
POSTGRES_PASSWORD=generate-secure-password
POSTGRES_DB=burgerdb
JWT_SECRET=generate-random-secret
EOF
        exit 1
    fi

    print_info "Loading secrets from ${env_file}..."

    # Export variables from .env
    set -a
    source "${env_file}"
    set +a

    print_info "Loaded environment variables from ${env_file}"
}

# Validate required secrets
validate_secrets() {
    local missing=()

    # GCP secrets
    [[ -z "${GCP_PROJECT_ID}" ]] && missing+=("GCP_PROJECT_ID")
    [[ -z "${GKE_CLUSTER}" ]] && missing+=("GKE_CLUSTER")
    [[ -z "${GKE_ZONE}" ]] && missing+=("GKE_ZONE")
    [[ -z "${GAR_LOCATION}" ]] && missing+=("GAR_LOCATION")
    [[ -z "${GAR_REPOSITORY}" ]] && missing+=("GAR_REPOSITORY")
    [[ -z "${WIF_PROVIDER}" ]] && missing+=("WIF_PROVIDER")
    [[ -z "${WIF_SERVICE_ACCOUNT}" ]] && missing+=("WIF_SERVICE_ACCOUNT")

    # Application secrets
    [[ -z "${OPENAI_API_KEY}" ]] && missing+=("OPENAI_API_KEY")
    [[ -z "${DD_API_KEY}" ]] && missing+=("DD_API_KEY")
    [[ -z "${POSTGRES_USER}" ]] && missing+=("POSTGRES_USER")
    [[ -z "${POSTGRES_PASSWORD}" ]] && missing+=("POSTGRES_PASSWORD")
    [[ -z "${POSTGRES_DB}" ]] && missing+=("POSTGRES_DB")
    [[ -z "${JWT_SECRET}" ]] && missing+=("JWT_SECRET")

    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required secrets in .env file:"
        for secret in "${missing[@]}"; do
            echo "  - ${secret}"
        done
        exit 1
    fi

    print_info "All required secrets are present!"
}

# Display secrets summary
display_secrets() {
    print_section "Secrets Summary"

    echo "GCP Configuration:"
    echo "  GCP_PROJECT_ID: ${GCP_PROJECT_ID}"
    echo "  GKE_CLUSTER: ${GKE_CLUSTER}"
    echo "  GKE_ZONE: ${GKE_ZONE}"
    echo "  GAR_LOCATION: ${GAR_LOCATION}"
    echo "  GAR_REPOSITORY: ${GAR_REPOSITORY}"
    echo "  WIF_PROVIDER: ${WIF_PROVIDER:0:50}..."
    echo "  WIF_SERVICE_ACCOUNT: ${WIF_SERVICE_ACCOUNT}"
    echo ""
    echo "Application Secrets:"
    echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}... (${#OPENAI_API_KEY} chars)"
    echo "  DD_API_KEY: ${DD_API_KEY:0:10}... (${#DD_API_KEY} chars)"
    echo "  POSTGRES_USER: ${POSTGRES_USER}"
    echo "  POSTGRES_PASSWORD: ********** (${#POSTGRES_PASSWORD} chars)"
    echo "  POSTGRES_DB: ${POSTGRES_DB}"
    echo "  JWT_SECRET: ********** (${#JWT_SECRET} chars)"
    echo ""
}

# Set secrets via GitHub CLI
set_secrets_with_gh() {
    local repo="${1}"

    if [[ -z "${repo}" ]]; then
        # Try to detect repo from git remote
        if git remote get-url origin &> /dev/null; then
            repo=$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')
            print_info "Detected repository: ${repo}"
        else
            print_error "Could not detect repository. Please specify: $0 --repo owner/repo"
            exit 1
        fi
    fi

    print_section "Setting GitHub Secrets for ${repo}"

    local secrets=(
        "GCP_PROJECT_ID:${GCP_PROJECT_ID}"
        "GKE_CLUSTER:${GKE_CLUSTER}"
        "GKE_ZONE:${GKE_ZONE}"
        "GAR_LOCATION:${GAR_LOCATION}"
        "GAR_REPOSITORY:${GAR_REPOSITORY}"
        "WIF_PROVIDER:${WIF_PROVIDER}"
        "WIF_SERVICE_ACCOUNT:${WIF_SERVICE_ACCOUNT}"
        "OPENAI_API_KEY:${OPENAI_API_KEY}"
        "DD_API_KEY:${DD_API_KEY}"
        "POSTGRES_USER:${POSTGRES_USER}"
        "POSTGRES_PASSWORD:${POSTGRES_PASSWORD}"
        "POSTGRES_DB:${POSTGRES_DB}"
        "JWT_SECRET:${JWT_SECRET}"
    )

    for secret_pair in "${secrets[@]}"; do
        local name="${secret_pair%%:*}"
        local value="${secret_pair#*:}"

        echo -n "Setting ${name}... "
        if echo "${value}" | gh secret set "${name}" --repo="${repo}"; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    done

    print_info "GitHub secrets setup complete!"
}

# Generate instructions for manual setup
generate_manual_instructions() {
    print_section "Manual Setup Instructions"

    cat << EOF
Go to your GitHub repository:
https://github.com/YOUR_USER/YOUR_REPO/settings/secrets/actions

Click "New repository secret" and add each of the following:

$(cat << SECRETS
GCP_PROJECT_ID=${GCP_PROJECT_ID}
GKE_CLUSTER=${GKE_CLUSTER}
GKE_ZONE=${GKE_ZONE}
GAR_LOCATION=${GAR_LOCATION}
GAR_REPOSITORY=${GAR_REPOSITORY}
WIF_PROVIDER=${WIF_PROVIDER}
WIF_SERVICE_ACCOUNT=${WIF_SERVICE_ACCOUNT}
OPENAI_API_KEY=${OPENAI_API_KEY}
DD_API_KEY=${DD_API_KEY}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
JWT_SECRET=${JWT_SECRET}
SECRETS
)

Copy and paste each secret individually into GitHub.
EOF
}

# Generate secure passwords
generate_passwords() {
    print_section "Generate Secure Passwords"

    echo "Use these generated values if you haven't set them yet:"
    echo ""

    # Generate POSTGRES_PASSWORD
    local pg_pass=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    echo "POSTGRES_PASSWORD=${pg_pass}"

    # Generate JWT_SECRET
    local jwt_secret=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-50)
    echo "JWT_SECRET=${jwt_secret}"

    echo ""
    echo "Add these to your .env file if needed."
}

# Main function
main() {
    local env_file=".env"
    local repo=""
    local auto_mode=false
    local generate_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env-file)
                env_file="$2"
                shift 2
                ;;
            --repo)
                repo="$2"
                shift 2
                ;;
            --auto)
                auto_mode=true
                shift
                ;;
            --generate)
                generate_only=true
                shift
                ;;
            --help)
                cat << EOF
Usage: $0 [OPTIONS]

Setup GitHub secrets from .env file

Options:
  --env-file FILE   Path to .env file (default: .env)
  --repo OWNER/REPO GitHub repository (auto-detected if not specified)
  --auto            Automatically set secrets via GitHub CLI
  --generate        Generate secure passwords only
  --help            Show this help message

Examples:
  # Generate secure passwords
  $0 --generate

  # Load from .env and show manual instructions
  $0

  # Load from custom file
  $0 --env-file .env.production

  # Automatically set secrets via GitHub CLI
  $0 --auto

  # Specify repository explicitly
  $0 --auto --repo myuser/myrepo

Prerequisites:
  - Create .env file with your secrets
  - Install GitHub CLI: brew install gh (for --auto mode)
  - Authenticate: gh auth login (for --auto mode)
EOF
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    print_section "GitHub Secrets Setup"

    # Generate passwords only
    if [[ "${generate_only}" == "true" ]]; then
        generate_passwords
        exit 0
    fi

    # Load and validate
    load_env_file "${env_file}"
    validate_secrets
    display_secrets

    echo ""
    read -p "Do you want to proceed? (y/n): " CONFIRM
    if [[ "${CONFIRM}" != "y" ]]; then
        print_info "Setup cancelled"
        exit 0
    fi

    # Auto mode with GitHub CLI
    if [[ "${auto_mode}" == "true" ]]; then
        if check_prerequisites; then
            set_secrets_with_gh "${repo}"
        else
            print_warn "GitHub CLI not available. Showing manual instructions..."
            generate_manual_instructions
        fi
    else
        # Manual mode
        generate_manual_instructions
    fi

    print_section "Next Steps"
    cat << EOF
1. ✓ Secrets are ready to be added to GitHub
2. Create prod branch: git checkout -b prod && git push origin prod
3. Push to main: git push origin main
4. Check Actions tab for deployment status

For detailed instructions, see:
docs/deployment/CICD_QUICKSTART.md
EOF
}

# Run main
main "$@"
