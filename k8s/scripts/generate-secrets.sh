#!/bin/bash

# generate-secrets.sh
# Generates Kubernetes secrets for both dev and prod environments
# DO NOT commit the generated secrets files!
#
# Usage:
#   ./k8s/scripts/generate-secrets.sh dev   # Generate for dev environment
#   ./k8s/scripts/generate-secrets.sh prod  # Generate for prod environment
#   ./k8s/scripts/generate-secrets.sh all   # Generate for both environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse environment argument
ENV="${1:-dev}"

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" && "$ENV" != "all" ]]; then
  echo -e "${RED}ERROR: Invalid environment '${ENV}'${NC}"
  echo "Usage: $0 [dev|prod|all]"
  echo "  dev  - Generate secrets for dev environment (default)"
  echo "  prod - Generate secrets for prod environment"
  echo "  all  - Generate secrets for both environments"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Kubernetes Secrets Generator${NC}                           ${BLUE}║${NC}"
echo -e "${BLUE}║${NC}  Environment: ${YELLOW}${ENV}${NC}                                       ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check and report environment variables
check_env_vars() {
  local missing_vars=()

  echo -e "${BLUE}Checking required environment variables...${NC}"

  if [ -z "$DD_API_KEY" ]; then
    missing_vars+=("DD_API_KEY")
    echo -e "  ${RED}✗${NC} DD_API_KEY"
  else
    echo -e "  ${GREEN}✓${NC} DD_API_KEY"
  fi

  if [ -z "$OPENAI_API_KEY" ]; then
    missing_vars+=("OPENAI_API_KEY")
    echo -e "  ${RED}✗${NC} OPENAI_API_KEY"
  else
    echo -e "  ${GREEN}✓${NC} OPENAI_API_KEY"
  fi

  # Check Google OAuth variables (required for app-level authentication)
  if [ -z "$GOOGLE_CLIENT_ID" ]; then
    missing_vars+=("GOOGLE_CLIENT_ID")
    echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_ID"
  else
    echo -e "  ${GREEN}✓${NC} GOOGLE_CLIENT_ID"
  fi

  if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    missing_vars+=("GOOGLE_CLIENT_SECRET")
    echo -e "  ${RED}✗${NC} GOOGLE_CLIENT_SECRET"
  else
    echo -e "  ${GREEN}✓${NC} GOOGLE_CLIENT_SECRET"
  fi

  if [ -z "$JWT_SECRET" ]; then
    missing_vars+=("JWT_SECRET")
    echo -e "  ${RED}✗${NC} JWT_SECRET"
  else
    echo -e "  ${GREEN}✓${NC} JWT_SECRET"
  fi

  # Check Datadog Postgres credentials
  if [ -z "$DATADOG_POSTGRES_PASSWORD" ]; then
    missing_vars+=("DATADOG_POSTGRES_PASSWORD")
    echo -e "  ${RED}✗${NC} DATADOG_POSTGRES_PASSWORD"
  else
    echo -e "  ${GREEN}✓${NC} DATADOG_POSTGRES_PASSWORD"
  fi

  # Check optional variables
  if [ -n "$VERTEX_AI_KEY" ]; then
    echo -e "  ${GREEN}✓${NC} VERTEX_AI_KEY (optional)"
  else
    echo -e "  ${YELLOW}ℹ${NC} VERTEX_AI_KEY not set (optional)"
  fi

  if [ -n "$GCP_SA_KEY_FILE" ] && [ -f "$GCP_SA_KEY_FILE" ]; then
    echo -e "  ${GREEN}✓${NC} GCP_SA_KEY_FILE (optional)"
  elif [ -n "$GCP_SA_KEY_JSON" ]; then
    echo -e "  ${GREEN}✓${NC} GCP_SA_KEY_JSON (optional)"
  else
    echo -e "  ${YELLOW}ℹ${NC} GCP Service Account Key not set (optional)"
  fi

  echo ""

  # Report missing variables
  if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}ERROR: Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
      echo -e "  ${RED}✗${NC} $var"
    done
    echo ""
    echo -e "${YELLOW}Please set these variables before running this script:${NC}"
    echo "  export DD_API_KEY='your-datadog-api-key'"
    echo "  export OPENAI_API_KEY='your-openai-api-key'"
    echo ""
    return 1
  fi

  return 0
}

# Function to generate secrets for a specific environment
generate_secrets_for_env() {
  local target_env=$1
  local namespace="mcp-agent-${target_env}"
  local output_file="k8s/overlays/${target_env}/secrets.yaml"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}Generating secrets for ${YELLOW}${target_env}${GREEN} environment${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Create overlays directory if it doesn't exist
  mkdir -p "k8s/overlays/${target_env}"

  # Base64 encode the secrets (required for Kubernetes secrets)
  # Note: Use tr -d '\n' to remove newlines that macOS base64 adds for long strings
  local dd_api_key_b64=$(echo -n "$DD_API_KEY" | base64 | tr -d '\n')
  local openai_api_key_b64=$(echo -n "$OPENAI_API_KEY" | base64 | tr -d '\n')

  # Google OAuth credentials (required for app-level authentication)
  local google_client_id_b64=$(echo -n "$GOOGLE_CLIENT_ID" | base64 | tr -d '\n')
  local google_client_secret_b64=$(echo -n "$GOOGLE_CLIENT_SECRET" | base64 | tr -d '\n')
  local jwt_secret_b64=$(echo -n "$JWT_SECRET" | base64 | tr -d '\n')

  # Datadog Postgres credentials (required for DBM)
  local datadog_postgres_password_b64=$(echo -n "$DATADOG_POSTGRES_PASSWORD" | base64 | tr -d '\n')

  # Optional: Vertex AI key
  local vertex_ai_key_b64=""
  if [ -n "$VERTEX_AI_KEY" ]; then
    vertex_ai_key_b64=$(echo -n "$VERTEX_AI_KEY" | base64 | tr -d '\n')
  fi

  # Optional: GCP Service Account Key
  local gcp_sa_key_b64=""
  if [ -n "$GCP_SA_KEY_FILE" ] && [ -f "$GCP_SA_KEY_FILE" ]; then
    gcp_sa_key_b64=$(base64 < "$GCP_SA_KEY_FILE" | tr -d '\n')
  elif [ -n "$GCP_SA_KEY_JSON" ]; then
    gcp_sa_key_b64=$(echo -n "$GCP_SA_KEY_JSON" | base64 | tr -d '\n')
  fi

  echo -e "${GREEN}Writing secrets to: ${YELLOW}${output_file}${NC}"

  # Generate the secrets.yaml file
  cat > "$output_file" <<EOF
# AUTO-GENERATED FILE - DO NOT COMMIT TO VERSION CONTROL
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Generated by: k8s/scripts/generate-secrets.sh
# Environment: ${target_env}
#
# This file contains base64-encoded secrets.
# To regenerate: ./k8s/scripts/generate-secrets.sh ${target_env}

apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: ${namespace}
  labels:
    app: mcp-agent
    environment: ${target_env}
    managed-by: script
type: Opaque
data:
  # Datadog API Key (base64 encoded)
  datadog-api-key: ${dd_api_key_b64}

  # OpenAI API Key (base64 encoded)
  openai-api-key: ${openai_api_key_b64}

  # PostgreSQL password (base64 encoded - references postgres-secret)
  # Note: This duplicates the value from postgres-secret for compatibility
  postgres-password: $(echo -n "changeme123" | base64)

  # Google OAuth Credentials (base64 encoded)
  # Used for application-level Google authentication (cloud-agnostic)
  google-client-id: ${google_client_id_b64}
  google-client-secret: ${google_client_secret_b64}

  # JWT Secret for session token signing (base64 encoded)
  jwt-secret: ${jwt_secret_b64}
EOF

  # Add optional secrets if they exist
  if [ -n "$vertex_ai_key_b64" ]; then
    cat >> "$output_file" <<EOF

  # Vertex AI Key (base64 encoded)
  vertex-ai-key: ${vertex_ai_key_b64}
EOF
  fi

  if [ -n "$gcp_sa_key_b64" ]; then
    cat >> "$output_file" <<EOF

  # GCP Service Account Key JSON (base64 encoded)
  gcp-sa-key: ${gcp_sa_key_b64}
EOF
  fi

  # Add final newline
  echo "" >> "$output_file"

  # Generate separate datadog-postgres-credentials secret
  cat >> "$output_file" <<EOF
---
# Datadog DBM Credentials
# Used by Datadog agent to monitor PostgreSQL database
apiVersion: v1
kind: Secret
metadata:
  name: datadog-postgres-credentials
  namespace: ${namespace}
  labels:
    app: mcp-agent
    environment: ${target_env}
    managed-by: script
type: Opaque
data:
  # Datadog user password for PostgreSQL monitoring (base64 encoded)
  password: ${datadog_postgres_password_b64}
EOF

  echo "" >> "$output_file"

  echo -e "${GREEN}✓${NC} Secrets file generated successfully!"
  echo -e "  File: ${YELLOW}${output_file}${NC}"
  echo -e "  Namespace: ${YELLOW}${namespace}${NC}"
  echo -e "  Includes:"
  echo -e "    - app-secrets (API keys, OAuth, JWT)"
  echo -e "    - datadog-postgres-credentials (DBM monitoring)"
  echo ""
}

# Check environment variables first
check_env_vars || exit 1

# Generate secrets based on ENV parameter
if [ "$ENV" = "all" ]; then
  echo -e "${BLUE}Generating secrets for ALL environments...${NC}"
  echo ""

  generate_secrets_for_env "dev"
  echo ""
  generate_secrets_for_env "prod"

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}All secrets generated successfully!${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  generate_secrets_for_env "$ENV"
fi

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC}  ${RED}IMPORTANT SECURITY NOTES${NC}                               ${YELLOW}║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "  1. The generated files contain ${RED}REAL SECRETS${NC}"
echo -e "  2. These files are in ${GREEN}.gitignore${NC} and will NOT be committed"
echo -e "  3. ${RED}DO NOT${NC} manually add these files to git"
echo -e "  4. Each team member should generate their own secrets files"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}NEXT STEPS${NC}                                             ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

if [ "$ENV" = "all" ]; then
  echo -e "${GREEN}Apply secrets to dev:${NC}"
  echo -e "  ${YELLOW}kubectl apply -f k8s/overlays/dev/secrets.yaml${NC}"
  echo ""
  echo -e "${GREEN}Apply secrets to prod:${NC}"
  echo -e "  ${YELLOW}kubectl apply -f k8s/overlays/prod/secrets.yaml${NC}"
else
  echo -e "${GREEN}Apply secrets to ${ENV}:${NC}"
  echo -e "  ${YELLOW}kubectl apply -f k8s/overlays/${ENV}/secrets.yaml${NC}"
fi

echo ""
echo -e "${GREEN}Or use Kustomize:${NC}"
if [ "$ENV" = "all" ]; then
  echo -e "  ${YELLOW}make k8s-apply ENV=dev${NC}"
  echo -e "  ${YELLOW}make k8s-apply ENV=prod${NC}"
else
  echo -e "  ${YELLOW}make k8s-apply ENV=${ENV}${NC}"
fi
echo ""
