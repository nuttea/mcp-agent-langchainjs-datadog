#!/bin/bash
# Get GCP Project Number from Project ID
# Usage: ./get-project-number.sh [PROJECT_ID]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project ID from argument or gcloud config
PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"

if [[ -z "${PROJECT_ID}" ]]; then
    echo -e "${RED}Error: No project ID specified${NC}"
    echo ""
    echo "Usage: $0 [PROJECT_ID]"
    echo ""
    echo "Options:"
    echo "  1. Pass project ID as argument: $0 my-project-id"
    echo "  2. Set default project: gcloud config set project PROJECT_ID"
    echo "  3. Set PROJECT_ID env var: export PROJECT_ID=my-project-id"
    echo ""
    exit 1
fi

# Get project number
echo -e "${YELLOW}Getting project number for: ${PROJECT_ID}${NC}" >&2

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)' 2>/dev/null)

if [[ -z "${PROJECT_NUMBER}" ]]; then
    echo -e "${RED}Error: Could not retrieve project number for '${PROJECT_ID}'${NC}" >&2
    echo "" >&2
    echo "Possible reasons:" >&2
    echo "  - Project does not exist" >&2
    echo "  - You don't have access to the project" >&2
    echo "  - Project ID is incorrect" >&2
    echo "" >&2
    echo "Verify with: gcloud projects list | grep ${PROJECT_ID}" >&2
    exit 1
fi

# Output project number (to stdout)
echo "${PROJECT_NUMBER}"

# Output summary (to stderr so it doesn't interfere with variable assignment)
echo -e "${GREEN}✓ Project ID: ${PROJECT_ID}${NC}" >&2
echo -e "${GREEN}✓ Project Number: ${PROJECT_NUMBER}${NC}" >&2
