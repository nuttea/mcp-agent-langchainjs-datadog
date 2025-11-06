#!/bin/bash
# Count GCP VM instances for Datadog CSM Pro pricing
# Requires: gcloud CLI installed and authenticated

set -euo pipefail

echo "Counting GCP VM instances..."

# Get list of all projects
PROJECTS=$(gcloud projects list --format="value(projectId)" 2>/dev/null)

TOTAL=0

for project in $PROJECTS; do
    # Count running instances in this project across all zones
    COUNT=$(gcloud compute instances list \
        --project="$project" \
        --filter="status=RUNNING" \
        --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))
done

echo "================================================"
echo "GCP Host Count: $TOTAL"
echo "================================================"
