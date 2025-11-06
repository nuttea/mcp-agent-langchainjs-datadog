#!/bin/bash
# Count AWS EC2 instances across multiple accounts for Datadog CSM Pro pricing
# Supports AWS Organizations with cross-account role assumption
# Requires: AWS CLI configured with management account credentials

set -euo pipefail

# Configuration: Role name to assume in member accounts
# This role must exist in all member accounts with ec2:DescribeInstances permission
ASSUME_ROLE_NAME="${AWS_ASSUME_ROLE_NAME:-OrganizationAccountAccessRole}"

echo "Counting AWS EC2 instances across all organization accounts..."
echo "Using assume role: $ASSUME_ROLE_NAME"
echo ""

TOTAL=0

# Check if AWS Organizations is available
ORG_ACCOUNTS=$(aws organizations list-accounts --query 'Accounts[?Status==`ACTIVE`].[Id,Name]' --output text 2>/dev/null || echo "")

if [ -z "$ORG_ACCOUNTS" ]; then
    echo "ERROR: No AWS Organization found or insufficient permissions"
    echo "Falling back to current account only..."
    echo ""

    # Get all regions
    REGIONS=$(aws ec2 describe-regions --query 'Regions[*].RegionName' --output text)

    for region in $REGIONS; do
        COUNT=$(aws ec2 describe-instances \
            --region "$region" \
            --filters "Name=instance-state-name,Values=running" \
            --query 'length(Reservations[*].Instances[*][])' \
            --output text 2>/dev/null || echo "0")
        TOTAL=$((TOTAL + COUNT))
    done

    echo "================================================"
    echo "AWS Host Count (current account): $TOTAL"
    echo "================================================"
    exit 0
fi

# Get current account ID (management account)
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)
echo "Management Account: $CURRENT_ACCOUNT"
echo ""

# Get all regions once
REGIONS=$(aws ec2 describe-regions --query 'Regions[*].RegionName' --output text)

# Process organization accounts
while IFS=$'\t' read -r account_id account_name; do
    echo "Checking account: $account_id ($account_name)"

    ACCOUNT_TOTAL=0

    if [ "$account_id" = "$CURRENT_ACCOUNT" ]; then
        # Current account - use existing credentials
        for region in $REGIONS; do
            COUNT=$(aws ec2 describe-instances \
                --region "$region" \
                --filters "Name=instance-state-name,Values=running" \
                --query 'length(Reservations[*].Instances[*][])' \
                --output text 2>/dev/null || echo "0")
            ACCOUNT_TOTAL=$((ACCOUNT_TOTAL + COUNT))
        done
    else
        # Member account - assume role
        ROLE_ARN="arn:aws:iam::${account_id}:role/${ASSUME_ROLE_NAME}"

        # Attempt to assume role
        CREDENTIALS=$(aws sts assume-role \
            --role-arn "$ROLE_ARN" \
            --role-session-name "count-hosts-session" \
            --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
            --output text 2>/dev/null || echo "")

        if [ -n "$CREDENTIALS" ]; then
            # Parse credentials
            read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN <<< "$CREDENTIALS"

            export AWS_ACCESS_KEY_ID
            export AWS_SECRET_ACCESS_KEY
            export AWS_SESSION_TOKEN

            # Count instances in all regions
            for region in $REGIONS; do
                COUNT=$(aws ec2 describe-instances \
                    --region "$region" \
                    --filters "Name=instance-state-name,Values=running" \
                    --query 'length(Reservations[*].Instances[*][])' \
                    --output text 2>/dev/null || echo "0")
                ACCOUNT_TOTAL=$((ACCOUNT_TOTAL + COUNT))
            done

            # Unset temporary credentials
            unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
        else
            echo "  WARNING: Cannot assume role in account $account_id"
            echo "  Ensure role '$ASSUME_ROLE_NAME' exists and trusts the management account"
        fi
    fi

    echo "  Account total: $ACCOUNT_TOTAL instances"
    TOTAL=$((TOTAL + ACCOUNT_TOTAL))
    echo ""

done <<< "$ORG_ACCOUNTS"

echo "================================================"
echo "TOTAL AWS Host Count (all accounts): $TOTAL"
echo "================================================"
