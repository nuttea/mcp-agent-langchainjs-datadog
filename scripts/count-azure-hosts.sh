#!/bin/bash
# Count Azure VMs for Datadog CSM Pro pricing
# Requires: Azure CLI (az) installed and authenticated

set -euo pipefail

echo "Counting Azure VMs..."

# Count all running VMs across all subscriptions
TOTAL=$(az vm list --query "[?powerState=='VM running'] | length(@)" --output tsv 2>/dev/null || echo "0")

echo "================================================"
echo "Azure Host Count: $TOTAL"
echo "================================================"
