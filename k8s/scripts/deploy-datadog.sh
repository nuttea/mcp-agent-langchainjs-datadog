#!/bin/bash

# Deploy Datadog Agent to GKE cluster
# Usage: ./deploy-datadog.sh [CLUSTER_NAME]
# Example: ./deploy-datadog.sh mcp-agent-gke
#
# This script installs the Datadog Agent with:
# - Container logs collection
# - Metrics collection
# - APM with Single Step Instrumentation (SSI)
# - Application Security Management (ASM)
# - Network Performance Monitoring
# - Process monitoring
# - SBOM collection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Datadog Agent Deployment for GKE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Load CLUSTER_NAME from .env if not provided as argument
if [ -z "$1" ] && [ -z "$CLUSTER_NAME" ]; then
    if [ -f "$ROOT_DIR/.env" ]; then
        echo -e "${YELLOW}Loading CLUSTER_NAME from .env file...${NC}"
        export $(grep -E "^CLUSTER_NAME=" "$ROOT_DIR/.env" | xargs)
    fi
fi

# Get cluster name from argument, environment, or prompt
if [ -n "$1" ]; then
    CLUSTER_NAME="$1"
elif [ -z "$CLUSTER_NAME" ]; then
    read -p "Enter cluster name (e.g., mcp-agent-gke): " CLUSTER_NAME
fi

if [ -z "$CLUSTER_NAME" ]; then
    echo -e "${RED}Error: Cluster name is required${NC}"
    echo "Set it in .env file (CLUSTER_NAME=...) or pass as argument"
    exit 1
fi

echo -e "${GREEN}✓ Cluster name: ${CLUSTER_NAME}${NC}"
echo ""

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: Helm is not installed${NC}"
    echo "Install Helm: https://helm.sh/docs/intro/install/"
    exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: kubectl is not configured or cluster is not accessible${NC}"
    exit 1
fi

# Load DD_API_KEY from .env if not set
if [ -z "$DD_API_KEY" ]; then
    if [ -f "$ROOT_DIR/.env" ]; then
        echo -e "${YELLOW}Loading credentials from .env file...${NC}"
        export $(grep -E "^DD_API_KEY=" "$ROOT_DIR/.env" | xargs)
    fi
fi

# Verify API key is set
if [ -z "$DD_API_KEY" ]; then
    echo -e "${RED}Error: DD_API_KEY is not set${NC}"
    echo "Set it in .env file or export DD_API_KEY=<your-api-key>"
    exit 1
fi

echo -e "${GREEN}✓ Datadog API key loaded${NC}"
echo ""

# Add Datadog Helm repository
echo -e "${YELLOW}Adding Datadog Helm repository...${NC}"
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create namespace if it doesn't exist
echo -e "${YELLOW}Checking Datadog namespace...${NC}"
if ! kubectl get namespace datadog &> /dev/null; then
    kubectl create namespace datadog
    echo -e "${GREEN}✓ Created datadog namespace${NC}"
else
    echo -e "${GREEN}✓ Datadog namespace already exists${NC}"
fi

# Create Kubernetes secret for Datadog API key
echo -e "${YELLOW}Creating Datadog API key secret...${NC}"
kubectl create secret generic datadog-secret \
    --from-literal=api-key="$DD_API_KEY" \
    --namespace datadog \
    --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Datadog secret created/updated${NC}"
echo ""

# Check if Datadog Agent is already installed
if helm list -n datadog | grep -q datadog-agent; then
    echo ""
    echo -e "${YELLOW}Datadog Agent is already installed${NC}"
    read -p "Do you want to upgrade it? (yes/no) " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${YELLOW}Skipping Datadog Agent installation${NC}"
        exit 0
    fi
    HELM_ACTION="upgrade"
else
    HELM_ACTION="install"
fi

# Install or upgrade Datadog Agent
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installing Datadog Agent with Helm${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Cluster Name: ${CLUSTER_NAME}"
echo -e "  Registry: gcr.io/datadoghq"
echo ""
echo -e "${BLUE}Features enabled:${NC}"
echo -e "  ✓ Container logs collection"
echo -e "  ✓ Metrics collection (pods, nodes, cluster)"
echo -e "  ✓ APM with Single Step Instrumentation (SSI)"
echo -e "  ✓ Application Security Management (ASM)"
echo -e "  ✓ Network Performance Monitoring"
echo -e "  ✓ Process monitoring"
echo -e "  ✓ SBOM collection"
echo -e "  ✓ Service Monitoring (USM)"
echo ""
echo -e "${BLUE}SSI enabled for namespaces:${NC}"
echo -e "  - mcp-agent-dev"
echo -e "  - mcp-agent-prod"
echo ""

helm $HELM_ACTION datadog-agent \
    -f "$ROOT_DIR/k8s/datadog/datadog-values.yaml" \
    --set datadog.clusterName="$CLUSTER_NAME" \
    --namespace datadog \
    --create-namespace \
    datadog/datadog

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Datadog Agent deployed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    # Wait for Datadog Agent to be ready
    echo -e "${YELLOW}Waiting for Datadog Agent pods to be ready...${NC}"
    kubectl wait --for=condition=ready pod \
        -l app=datadog-agent \
        -n datadog \
        --timeout=300s || true

    echo ""
    echo -e "${GREEN}Current Datadog Agent status:${NC}"
    kubectl get pods -n datadog

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Next Steps${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}1. Verify Datadog Agent is running:${NC}"
    echo -e "   make datadog-status"
    echo -e "   # or: kubectl get pods -n datadog"
    echo ""
    echo -e "${YELLOW}2. Check Datadog Agent logs:${NC}"
    echo -e "   make datadog-logs"
    echo -e "   # or: kubectl logs -l app=datadog-agent -n datadog"
    echo ""
    echo -e "${YELLOW}3. Restart your application pods to inject APM:${NC}"
    echo -e "   kubectl rollout restart deployment -n mcp-agent-dev"
    echo -e "   kubectl rollout restart deployment -n mcp-agent-prod"
    echo ""
    echo -e "${YELLOW}4. View your data in Datadog:${NC}"
    echo -e "   Infrastructure: https://app.datadoghq.com/infrastructure/map"
    echo -e "   APM Services:   https://app.datadoghq.com/apm/services"
    echo -e "   Service Map:    https://app.datadoghq.com/apm/map"
    echo -e "   Logs:           https://app.datadoghq.com/logs"
    echo -e "   Security:       https://app.datadoghq.com/security"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Failed to deploy Datadog Agent${NC}"
    exit 1
fi
