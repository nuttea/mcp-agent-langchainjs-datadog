#!/bin/bash

# Environment Configuration
# Maps git branches to Kubernetes namespaces and environments

# Function to get environment config based on branch name
get_environment_config() {
  local branch_name=$1

  case "$branch_name" in
    main)
      export ENVIRONMENT="dev"
      export NAMESPACE="mcp-agent-dev"
      export IMAGE_TAG="dev-latest"
      export REPLICAS="2"
      ;;
    prod)
      export ENVIRONMENT="prod"
      export NAMESPACE="mcp-agent-prod"
      export IMAGE_TAG="prod-latest"
      export REPLICAS="3"
      ;;
    staging)
      export ENVIRONMENT="staging"
      export NAMESPACE="mcp-agent-staging"
      export IMAGE_TAG="staging-latest"
      export REPLICAS="2"
      ;;
    *)
      # Default to dev for feature branches
      export ENVIRONMENT="dev"
      export NAMESPACE="mcp-agent-dev"
      export IMAGE_TAG="dev-${branch_name}"
      export REPLICAS="1"
      ;;
  esac

  # Common configuration
  export PROJECT_ID="datadog-ese-sandbox"
  export CLUSTER_NAME="nuttee-cluster-1"
  export REGION="asia-southeast1-b"
  export REGISTRY="gcr.io/${PROJECT_ID}"
}

# Function to display current environment config
display_environment_config() {
  echo "Environment Configuration:"
  echo "  Branch:      $CURRENT_BRANCH"
  echo "  Environment: $ENVIRONMENT"
  echo "  Namespace:   $NAMESPACE"
  echo "  Image Tag:   $IMAGE_TAG"
  echo "  Replicas:    $REPLICAS"
  echo "  Project:     $PROJECT_ID"
  echo "  Cluster:     $CLUSTER_NAME"
  echo "  Region:      $REGION"
  echo "  Registry:    $REGISTRY"
}

# Export functions for use in other scripts
export -f get_environment_config
export -f display_environment_config
