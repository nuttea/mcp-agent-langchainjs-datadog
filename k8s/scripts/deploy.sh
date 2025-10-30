#!/bin/bash

# Deploy all services to GKE based on current git branch
# Usage: ./deploy.sh [branch-name]
#
# Branch to Environment Mapping:
#   main   -> dev   (namespace: mcp-agent-dev)
#   prod   -> prod  (namespace: mcp-agent-prod)
#   staging -> staging (namespace: mcp-agent-staging)
#   other  -> dev   (namespace: mcp-agent-dev)

set -e

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source environment configuration
source "$ROOT_DIR/k8s/config/environments.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Branch-Based Deployment to GKE${NC}"
echo -e "${GREEN}========================================${NC}"

# Detect current branch
if [ -n "$1" ]; then
  CURRENT_BRANCH="$1"
  echo -e "${YELLOW}Using specified branch: $CURRENT_BRANCH${NC}"
else
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  echo -e "${YELLOW}Auto-detected branch: $CURRENT_BRANCH${NC}"
fi

# Load environment configuration based on branch
get_environment_config "$CURRENT_BRANCH"

echo ""
echo -e "${CYAN}========================================${NC}"
display_environment_config
echo -e "${CYAN}========================================${NC}"
echo ""

# Confirmation for production deployment
if [ "$ENVIRONMENT" = "prod" ]; then
  echo -e "${RED}⚠️  WARNING: You are about to deploy to PRODUCTION!${NC}"
  echo -e "${RED}   Namespace: $NAMESPACE${NC}"
  echo -e "${RED}   Branch: $CURRENT_BRANCH${NC}"
  echo ""
  read -p "Are you sure you want to continue? (yes/no) " -r
  echo
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Production deployment cancelled${NC}"
    exit 1
  fi
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Configure kubectl
echo -e "\n${YELLOW}Configuring kubectl for cluster $CLUSTER_NAME...${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME \
  --project=$PROJECT_ID \
  --region=$REGION

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to configure kubectl${NC}"
    exit 1
fi

# Create namespace
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Step 1: Creating namespace${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if namespace manifest exists, or create namespace directly
if [ -f "$ROOT_DIR/k8s/manifests/namespace.yaml" ]; then
  # Update namespace in the manifest dynamically
  cat "$ROOT_DIR/k8s/manifests/namespace.yaml" | \
    sed "s/name: mcp-agent-dev/name: $NAMESPACE/" | \
    sed "s/environment: dev/environment: $ENVIRONMENT/" | \
    kubectl apply -f -
else
  # Create namespace directly
  kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
  kubectl label namespace $NAMESPACE app=mcp-agent environment=$ENVIRONMENT --overwrite
fi

# Create ConfigMap
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Step 2: Creating ConfigMap${NC}"
echo -e "${GREEN}========================================${NC}"

if [ -f "$ROOT_DIR/k8s/config/configmap.yaml" ]; then
  cat "$ROOT_DIR/k8s/config/configmap.yaml" | \
    sed "s/namespace: mcp-agent-dev/namespace: $NAMESPACE/" | \
    sed "s/environment: dev/environment: $ENVIRONMENT/" | \
    kubectl apply -f -
else
  echo -e "${YELLOW}No configmap.yaml found, skipping...${NC}"
fi

# Generate and apply secrets
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Step 3: Managing secrets${NC}"
echo -e "${GREEN}========================================${NC}"

SECRETS_FILE="$ROOT_DIR/k8s/config/secrets.yaml"
GENERATE_SECRETS_SCRIPT="$ROOT_DIR/k8s/scripts/generate-secrets.sh"

if kubectl get secret app-secrets -n $NAMESPACE &> /dev/null; then
    echo -e "${YELLOW}Secret 'app-secrets' already exists in namespace $NAMESPACE${NC}"
    echo ""
    read -p "Do you want to update it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "$SECRETS_FILE" ]; then
            echo -e "${YELLOW}Applying existing secrets file...${NC}"
            cat "$SECRETS_FILE" | \
              sed "s/namespace: mcp-agent-dev/namespace: $NAMESPACE/" | \
              sed "s/environment: dev/environment: $ENVIRONMENT/" | \
              kubectl apply -f -
        elif [ -f "$GENERATE_SECRETS_SCRIPT" ]; then
            echo -e "${YELLOW}Generating secrets from environment variables...${NC}"
            NAMESPACE=$NAMESPACE bash "$GENERATE_SECRETS_SCRIPT"
            if [ -f "$SECRETS_FILE" ]; then
                kubectl apply -f "$SECRETS_FILE"
            else
                echo -e "${RED}Failed to generate secrets${NC}"
                exit 1
            fi
        else
            echo -e "${RED}Cannot find secrets file or generation script${NC}"
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Secret 'app-secrets' not found in namespace $NAMESPACE${NC}"

    # Try to find or generate secrets
    if [ -f "$SECRETS_FILE" ]; then
        echo -e "${YELLOW}Found secrets file at $SECRETS_FILE${NC}"
        echo -e "${YELLOW}Applying secrets...${NC}"
        cat "$SECRETS_FILE" | \
          sed "s/namespace: mcp-agent-dev/namespace: $NAMESPACE/" | \
          sed "s/environment: dev/environment: $ENVIRONMENT/" | \
          kubectl apply -f -
    elif [ -f "$GENERATE_SECRETS_SCRIPT" ]; then
        echo -e "${YELLOW}Generating secrets from environment variables...${NC}"
        NAMESPACE=$NAMESPACE bash "$GENERATE_SECRETS_SCRIPT"
        if [ -f "$SECRETS_FILE" ]; then
            kubectl apply -f "$SECRETS_FILE"
            echo -e "${GREEN}✓ Secrets created successfully${NC}"
        else
            echo -e "${RED}Failed to generate secrets${NC}"
            echo -e "${YELLOW}Please set required environment variables:${NC}"
            echo -e "  export DD_API_KEY='your-datadog-api-key'"
            echo -e "  export OPENAI_API_KEY='your-openai-api-key'"
            echo ""
            read -p "Do you want to continue without secrets? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${RED}Deployment cancelled${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${RED}Cannot find secrets file or generation script${NC}"
        echo -e "${YELLOW}Please create secrets manually:${NC}"
        echo -e "  kubectl create secret generic app-secrets --namespace=$NAMESPACE \\"
        echo -e "    --from-literal=openai-api-key=YOUR_KEY \\"
        echo -e "    --from-literal=datadog-api-key=YOUR_DD_KEY"
        echo ""
        read -p "Do you want to continue without secrets? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Deployment cancelled${NC}"
            exit 1
        fi
    fi
fi

# Deploy services
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Step 4: Deploying services${NC}"
echo -e "${GREEN}========================================${NC}"

MANIFESTS=(
    "burger-api.yaml"
    "burger-mcp.yaml"
    "burger-webapp.yaml"
    "agent-api.yaml"
    "agent-webapp.yaml"
)

for manifest in "${MANIFESTS[@]}"; do
    manifest_path="$ROOT_DIR/k8s/manifests/$manifest"

    if [ ! -f "$manifest_path" ]; then
        echo -e "${YELLOW}⚠ Manifest $manifest not found, skipping...${NC}"
        continue
    fi

    echo -e "\n${YELLOW}Deploying $manifest...${NC}"

    # Apply manifest with namespace and environment substitution
    cat "$manifest_path" | \
      sed "s/namespace: mcp-agent-dev/namespace: $NAMESPACE/" | \
      sed "s/environment: dev/environment: $ENVIRONMENT/" | \
      sed "s|image: gcr.io/datadog-ese-sandbox/\([^:]*\):.*|image: $REGISTRY/\1:$IMAGE_TAG|" | \
      kubectl apply -f -

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Deployed $manifest${NC}"
    else
        echo -e "${RED}✗ Failed to deploy $manifest${NC}"
    fi
done

# Wait for pods to be ready
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Step 5: Waiting for pods to be ready${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Waiting for deployments to be ready (timeout: 5 minutes)...${NC}"
kubectl wait --for=condition=available --timeout=300s \
  deployment --all -n $NAMESPACE || true

# Show status
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Status${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Pods:${NC}"
kubectl get pods -n $NAMESPACE

echo -e "\n${YELLOW}Services:${NC}"
kubectl get services -n $NAMESPACE

echo -e "\n${YELLOW}Deployments:${NC}"
kubectl get deployments -n $NAMESPACE

# Get external IPs
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Service URLs${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Fetching external IPs (this may take a few minutes)...${NC}"
kubectl get services -n $NAMESPACE -o wide

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${CYAN}Environment Details:${NC}"
echo -e "  ${BLUE}Branch:${NC}      $CURRENT_BRANCH"
echo -e "  ${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "  ${BLUE}Namespace:${NC}   $NAMESPACE"
echo -e "  ${BLUE}Image Tag:${NC}   $IMAGE_TAG"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "  View logs:        ${BLUE}kubectl logs -f deployment/burger-mcp -n $NAMESPACE${NC}"
echo -e "  Describe pod:     ${BLUE}kubectl describe pod <pod-name> -n $NAMESPACE${NC}"
echo -e "  Execute command:  ${BLUE}kubectl exec -it <pod-name> -n $NAMESPACE -- sh${NC}"
echo -e "  Port forward:     ${BLUE}kubectl port-forward svc/burger-mcp 3000:3000 -n $NAMESPACE${NC}"
echo -e "  Delete all:       ${BLUE}kubectl delete namespace $NAMESPACE${NC}"
echo ""
