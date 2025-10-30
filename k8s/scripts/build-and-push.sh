#!/bin/bash

# Build and push all Docker images to GCR based on current git branch
# Usage: ./build-and-push.sh [branch-name]
#
# Branch to Environment Mapping:
#   main   -> dev   (tag: dev-latest)
#   prod   -> prod  (tag: prod-latest)
#   staging -> staging (tag: staging-latest)
#   other  -> dev   (tag: dev-{branch-name})

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
echo -e "${GREEN}Branch-Based Docker Build & Push${NC}"
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

# Confirmation for production build
if [ "$ENVIRONMENT" = "prod" ]; then
  echo -e "${RED}⚠️  WARNING: You are about to build and push PRODUCTION images!${NC}"
  echo -e "${RED}   Tag: $IMAGE_TAG${NC}"
  echo -e "${RED}   Branch: $CURRENT_BRANCH${NC}"
  echo ""
  read -p "Are you sure you want to continue? (yes/no) " -r
  echo
  if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Production build cancelled${NC}"
    exit 1
  fi
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Configure Docker to use gcloud as a credential helper
echo -e "${YELLOW}Configuring Docker authentication...${NC}"
gcloud auth configure-docker gcr.io --quiet

# Setup Docker buildx for multi-platform builds
echo -e "${YELLOW}Setting up Docker buildx for multi-platform builds...${NC}"
if ! docker buildx inspect multiplatform-builder &> /dev/null; then
    docker buildx create --name multiplatform-builder --use
else
    docker buildx use multiplatform-builder
fi

# Services to build
SERVICES=("burger-api" "burger-mcp" "burger-webapp" "agent-api" "agent-webapp")

# Build and push each service
for service in "${SERVICES[@]}"; do
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Building $service${NC}"
    echo -e "${GREEN}========================================${NC}"

    SERVICE_DIR="$ROOT_DIR/packages/$service"
    IMAGE_NAME="$REGISTRY/$service"
    FULL_IMAGE="$IMAGE_NAME:$IMAGE_TAG"

    if [ ! -d "$SERVICE_DIR" ]; then
        echo -e "${RED}Error: Service directory not found: $SERVICE_DIR${NC}"
        continue
    fi

    if [ ! -f "$SERVICE_DIR/Dockerfile" ]; then
        echo -e "${YELLOW}Warning: Dockerfile not found for $service, skipping...${NC}"
        continue
    fi

    echo -e "${YELLOW}Building image: $FULL_IMAGE${NC}"

    # Build from root directory for monorepo support
    # Use -f to specify Dockerfile location and . for context at root
    # Use buildx with --platform for multi-architecture support (linux/amd64 for GKE)
    # Use --push to push directly (buildx requirement) and --load to also keep locally
    docker buildx build \
        --platform linux/amd64 \
        -f "$SERVICE_DIR/Dockerfile" \
        -t "$FULL_IMAGE" \
        -t "$IMAGE_NAME:latest" \
        --push \
        "$ROOT_DIR"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Build and push successful for $service${NC}"
        echo -e "${GREEN}  - Pushed: $FULL_IMAGE${NC}"
        echo -e "${GREEN}  - Pushed: $IMAGE_NAME:latest${NC}"
    else
        echo -e "${RED}✗ Build and push failed for $service${NC}"
    fi
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All Done!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${CYAN}Images built and pushed:${NC}"
for service in "${SERVICES[@]}"; do
    echo -e "  ${BLUE}$REGISTRY/$service:$IMAGE_TAG${NC}"
    echo -e "  ${BLUE}$REGISTRY/$service:latest${NC}"
done

echo -e "\n${CYAN}Environment Details:${NC}"
echo -e "  ${BLUE}Branch:${NC}      $CURRENT_BRANCH"
echo -e "  ${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "  ${BLUE}Namespace:${NC}   $NAMESPACE"
echo -e "  ${BLUE}Image Tag:${NC}   $IMAGE_TAG"
echo -e "  ${BLUE}Registry:${NC}    $REGISTRY"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  Deploy services:"
echo -e "    ${BLUE}./k8s/scripts/deploy.sh${NC}"
echo -e ""
echo -e "  Or manually:"
echo -e "    ${BLUE}kubectl apply -f k8s/manifests/ -n $NAMESPACE${NC}"
echo ""
