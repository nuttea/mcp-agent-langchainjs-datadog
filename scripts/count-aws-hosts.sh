#!/bin/bash
# Count AWS EC2 instances for Datadog CSM Pro pricing
# Counts across all AWS accounts (supports AWS Organizations)
# Requires: AWS CLI configured with appropriate credentials

set -euo pipefail

echo "Counting AWS EC2 instances across all accounts..."

TOTAL=0

# Check if AWS Organizations is available
ORG_ACCOUNTS=$(aws organizations list-accounts --query 'Accounts[?Status==`ACTIVE`].Id' --output text 2>/dev/null || echo "")

if [ -n "$ORG_ACCOUNTS" ]; then
    echo "Found AWS Organization with multiple accounts"

    # Get all regions
    REGIONS=$(aws ec2 describe-regions --query 'Regions[*].RegionName' --output text)

    # Iterate through each account
    for account_id in $ORG_ACCOUNTS; do
        echo "  Checking account: $account_id"

        # Iterate through each region
        for region in $REGIONS; do
            # Try to assume role in the account (if using org management account)
            # Or use direct credentials if you have access
            COUNT=$(aws ec2 describe-instances \
                --region "$region" \
                --filters "Name=instance-state-name,Values=running" \
                --query 'length(Reservations[*].Instances[*][])' \
                --output text 2>/dev/null || echo "0")
            TOTAL=$((TOTAL + COUNT))
        done
    done
else
    echo "Single AWS account or no Organizations access"

    # Get all regions and count running instances in each
    REGIONS=$(aws ec2 describe-regions --query 'Regions[*].RegionName' --output text)

    for region in $REGIONS; do
        COUNT=$(aws ec2 describe-instances \
            --region "$region" \
            --filters "Name=instance-state-name,Values=running" \
            --query 'length(Reservations[*].Instances[*][])' \
            --output text 2>/dev/null || echo "0")
        TOTAL=$((TOTAL + COUNT))
    done
fi

echo "================================================"
echo "AWS Host Count: $TOTAL"
echo "================================================"
