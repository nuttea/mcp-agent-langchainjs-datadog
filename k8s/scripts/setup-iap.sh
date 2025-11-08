#!/bin/bash
#
# IAP Setup Script
# This script helps set up Identity-Aware Proxy (IAP) for the MCP Agent Platform
#
# Prerequisites:
# - gcloud CLI installed and configured
# - kubectl configured with access to your GKE cluster
# - OAuth 2.0 credentials created in Google Cloud Console
#
# Documentation: /docs/deployment/iap-setup.md

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-mcp-agent-prod}"
PROJECT_ID="${PROJECT_ID:-datadog-ese-sandbox}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}IAP Setup Script for MCP Agent Platform${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check prerequisites
print_info "Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed. Please install it first."
    exit 1
fi

print_success "Prerequisites check passed"
echo ""

# Step 2: Enable IAP API
print_info "Enabling IAP API..."
gcloud services enable iap.googleapis.com --project="${PROJECT_ID}" || {
    print_warning "Failed to enable IAP API (it may already be enabled)"
}
print_success "IAP API enabled"
echo ""

# Step 3: Get OAuth credentials
print_info "OAuth 2.0 Credentials Setup"
echo ""
echo "Please provide your OAuth 2.0 credentials from Google Cloud Console."
echo "If you haven't created them yet, follow these steps:"
echo "  1. Go to https://console.cloud.google.com/apis/credentials"
echo "  2. Click 'Create Credentials' → 'OAuth client ID'"
echo "  3. Select 'Web application'"
echo "  4. Add authorized redirect URI: https://iap.googleapis.com/v1/oauth/clientIds/YOUR_CLIENT_ID:handleRedirect"
echo ""

read -p "Enter OAuth Client ID: " CLIENT_ID
read -sp "Enter OAuth Client Secret: " CLIENT_SECRET
echo ""

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    print_error "Client ID and Client Secret are required"
    exit 1
fi

print_success "OAuth credentials captured"
echo ""

# Step 4: Create Kubernetes secret
print_info "Creating Kubernetes secret 'oauth-client-secret' in namespace '${NAMESPACE}'..."
echo ""
print_warning "IMPORTANT: GCP IAP requires the secret to have exactly 1 key named 'key' containing ONLY the client secret."
print_warning "The Client ID will be specified in the GCPBackendPolicy YAML."
echo ""

# Check if namespace exists
if ! kubectl get namespace "${NAMESPACE}" &> /dev/null; then
    print_error "Namespace '${NAMESPACE}' does not exist"
    exit 1
fi

# Check if secret already exists
if kubectl get secret oauth-client-secret -n "${NAMESPACE}" &> /dev/null; then
    print_warning "Secret 'oauth-client-secret' already exists"
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Skipping secret creation"
    else
        kubectl delete secret oauth-client-secret -n "${NAMESPACE}"
        kubectl create secret generic oauth-client-secret \
            --from-literal=key="${CLIENT_SECRET}" \
            -n "${NAMESPACE}"
        print_success "Secret updated successfully (key=CLIENT_SECRET)"
    fi
else
    kubectl create secret generic oauth-client-secret \
        --from-literal=key="${CLIENT_SECRET}" \
        -n "${NAMESPACE}"
    print_success "Secret created successfully (key=CLIENT_SECRET)"
fi
echo ""

# Step 5: Update BackendPolicy with Client ID
print_info "Updating GCPBackendPolicy with Client ID..."

BACKEND_POLICY_FILE="$(dirname "$0")/../gateway/04-backendpolicy-iap.yaml"

if [ -f "$BACKEND_POLICY_FILE" ]; then
    # Check if the file needs updating
    if grep -q "REPLACE_WITH_YOUR_CLIENT_ID" "$BACKEND_POLICY_FILE"; then
        sed -i.bak "s|REPLACE_WITH_YOUR_CLIENT_ID|${CLIENT_ID}|g" "$BACKEND_POLICY_FILE"
        rm "${BACKEND_POLICY_FILE}.bak"
        print_success "BackendPolicy updated with Client ID"
    else
        print_warning "BackendPolicy already has a Client ID configured"
        echo "Current Client ID in file: $(grep 'clientID:' "$BACKEND_POLICY_FILE" | awk '{print $2}')"
        echo "Provided Client ID: ${CLIENT_ID}"
        read -p "Do you want to update it? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sed -i.bak "s|clientID: .*|clientID: ${CLIENT_ID}|g" "$BACKEND_POLICY_FILE"
            rm "${BACKEND_POLICY_FILE}.bak"
            print_success "BackendPolicy updated with new Client ID"
        fi
    fi
else
    print_error "BackendPolicy file not found at: ${BACKEND_POLICY_FILE}"
    exit 1
fi
echo ""

# Step 6: Apply the BackendPolicy
print_info "Applying GCPBackendPolicy to cluster..."
kubectl apply -f "$BACKEND_POLICY_FILE"
print_success "GCPBackendPolicy applied"
echo ""

# Step 7: Check BackendPolicy status
print_info "Checking GCPBackendPolicy status..."
kubectl get gcpbackendpolicy agent-webapp-iap-policy -n "${NAMESPACE}" -o yaml
echo ""

# Step 8: Configure IAM permissions
print_info "IAM Permission Configuration"
echo ""
echo "You need to grant IAP access to users who should access the application."
echo ""
echo "Option 1: Grant access to a specific user:"
echo "  gcloud iap web add-iam-policy-binding \\"
echo "    --resource-type=backend-services \\"
echo "    --service=BACKEND_SERVICE_NAME \\"
echo "    --member=user:email@example.com \\"
echo "    --role=roles/iap.httpsResourceAccessor"
echo ""
echo "Option 2: Grant access to a group:"
echo "  gcloud iap web add-iam-policy-binding \\"
echo "    --resource-type=backend-services \\"
echo "    --service=BACKEND_SERVICE_NAME \\"
echo "    --member=group:team@example.com \\"
echo "    --role=roles/iap.httpsResourceAccessor"
echo ""
echo "Option 3: Grant access to all users in your organization:"
echo "  gcloud iap web add-iam-policy-binding \\"
echo "    --resource-type=backend-services \\"
echo "    --service=BACKEND_SERVICE_NAME \\"
echo "    --member=domain:yourdomain.com \\"
echo "    --role=roles/iap.httpsResourceAccessor"
echo ""

read -p "Do you want to configure IAM permissions now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # List backend services
    print_info "Listing backend services..."
    gcloud compute backend-services list --project="${PROJECT_ID}"
    echo ""

    read -p "Enter backend service name (or 'skip' to skip): " BACKEND_SERVICE

    if [ "$BACKEND_SERVICE" != "skip" ]; then
        echo ""
        echo "Choose permission type:"
        echo "  1) Grant access to a specific user"
        echo "  2) Grant access to a group"
        echo "  3) Grant access to a domain"
        read -p "Enter choice (1-3): " -n 1 -r CHOICE
        echo ""

        case $CHOICE in
            1)
                read -p "Enter user email: " USER_EMAIL
                gcloud iap web add-iam-policy-binding \
                    --resource-type=backend-services \
                    --service="${BACKEND_SERVICE}" \
                    --member="user:${USER_EMAIL}" \
                    --role=roles/iap.httpsResourceAccessor \
                    --project="${PROJECT_ID}"
                print_success "IAM permission granted to user: ${USER_EMAIL}"
                ;;
            2)
                read -p "Enter group email: " GROUP_EMAIL
                gcloud iap web add-iam-policy-binding \
                    --resource-type=backend-services \
                    --service="${BACKEND_SERVICE}" \
                    --member="group:${GROUP_EMAIL}" \
                    --role=roles/iap.httpsResourceAccessor \
                    --project="${PROJECT_ID}"
                print_success "IAM permission granted to group: ${GROUP_EMAIL}"
                ;;
            3)
                read -p "Enter domain: " DOMAIN
                gcloud iap web add-iam-policy-binding \
                    --resource-type=backend-services \
                    --service="${BACKEND_SERVICE}" \
                    --member="domain:${DOMAIN}" \
                    --role=roles/iap.httpsResourceAccessor \
                    --project="${PROJECT_ID}"
                print_success "IAM permission granted to domain: ${DOMAIN}"
                ;;
            *)
                print_warning "Invalid choice, skipping IAM configuration"
                ;;
        esac
    fi
else
    print_info "Skipping IAM configuration"
    print_info "You can configure IAM permissions later using the gcloud commands shown above"
fi
echo ""

# Step 9: Summary
print_success "=========================================="
print_success "IAP Setup Complete!"
print_success "=========================================="
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo "  1. Deploy the updated configuration:"
echo "     ${BLUE}make deploy ENV=prod${NC}"
echo ""
echo "  2. Wait for the Gateway to update (may take 5-10 minutes)"
echo ""
echo "  3. Test IAP authentication by visiting:"
echo "     ${BLUE}https://www.platform-engineering-demo.dev${NC}"
echo ""
echo "  4. Monitor authentication in Datadog APM:"
echo "     - Check for 'iap.user.email' and 'iap.user.id' tags on traces"
echo "     - View user activity in Datadog dashboards"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  - IAP Setup Guide: ${BLUE}docs/deployment/iap-setup.md${NC}"
echo "  - Troubleshooting: Check the documentation for common issues"
echo ""
