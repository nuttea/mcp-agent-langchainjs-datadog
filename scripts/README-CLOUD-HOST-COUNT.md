# Cloud Host Counting Scripts

Scripts to count running hosts across AWS, Azure, and Google Cloud for Datadog Cloud Security Management (CSM) Pro pricing estimation.

## Overview

Datadog CSM Pro pricing is based on the number of hosts monitored in cloud environments. These scripts help you count running instances/VMs across different cloud providers.

## Prerequisites

### AWS
- AWS CLI installed: `brew install awscli` (macOS) or [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- AWS credentials configured: `aws configure`
- **Single Account**: Permissions required: `ec2:DescribeInstances`, `ec2:DescribeRegions`
- **Multi-Account (Organizations)**: Additional permissions: `organizations:ListAccounts`, `sts:AssumeRole`

### Azure
- Azure CLI installed: `brew install azure-cli` (macOS) or [Azure CLI Installation Guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- Authenticated: `az login`
- Permissions required: Reader role on subscriptions

### Google Cloud
- gcloud CLI installed: `brew install google-cloud-sdk` (macOS) or [gcloud CLI Installation Guide](https://cloud.google.com/sdk/docs/install)
- Authenticated: `gcloud auth login`
- Permissions required: `compute.instances.list` on all projects

## Usage

### Count AWS EC2 Instances

#### Option 1: Single Account or Simple Multi-Account

```bash
chmod +x scripts/count-aws-hosts.sh
./scripts/count-aws-hosts.sh
```

**What it counts:**
- All running EC2 instances across all AWS regions in the current account
- Detects AWS Organizations and lists accounts (but counts current account only)
- Only counts instances in "running" state (excludes stopped/terminated)

**Example output:**
```
Counting AWS EC2 instances across all accounts...
Single AWS account or no Organizations access
================================================
AWS Host Count: 42
================================================
```

#### Option 2: Multi-Account with Cross-Account Role Assumption

For AWS Organizations with multiple accounts, use the multi-account script:

```bash
chmod +x scripts/count-aws-hosts-multi-account.sh
./scripts/count-aws-hosts-multi-account.sh
```

**What it does:**
- Discovers all active accounts in your AWS Organization
- Assumes a role in each member account to count instances
- Counts across all regions in all accounts
- Default role name: `OrganizationAccountAccessRole` (customizable)

**Prerequisites:**
- Must run from the **management account** (or delegated administrator)
- A cross-account role must exist in each member account with these permissions:
  - `ec2:DescribeInstances`
  - `ec2:DescribeRegions`
- The role must trust the management account

**Custom role name:**
```bash
export AWS_ASSUME_ROLE_NAME="MyCustomRoleName"
./scripts/count-aws-hosts-multi-account.sh
```

**Example output:**
```
Counting AWS EC2 instances across all organization accounts...
Using assume role: OrganizationAccountAccessRole
Management Account: 123456789012

Checking account: 123456789012 (Management)
  Account total: 15 instances

Checking account: 987654321098 (Production)
  Account total: 42 instances

Checking account: 111222333444 (Development)
  Account total: 8 instances

================================================
TOTAL AWS Host Count (all accounts): 65
================================================
```

### Count Azure VMs

```bash
chmod +x scripts/count-azure-hosts.sh
./scripts/count-azure-hosts.sh
```

**What it counts:**
- All running VMs across all subscriptions you have access to
- Only counts VMs with powerState "VM running"

**Example output:**
```
Counting Azure VMs...
================================================
Azure Host Count: 28
================================================
```

### Count GCP VM Instances

```bash
chmod +x scripts/count-gcp-hosts.sh
./scripts/count-gcp-hosts.sh
```

**What it counts:**
- All running VM instances across all GCP projects you have access to
- Only counts instances with status "RUNNING"

**Example output:**
```
Counting GCP VM instances...
================================================
GCP Host Count: 35
================================================
```

## Total Host Count Calculation

To get your total CSM Pro host count, run all three scripts and sum the results:

### Single Account Setup
```bash
# Run all counts
AWS=$(./scripts/count-aws-hosts.sh | grep "AWS Host Count:" | awk '{print $4}')
AZURE=$(./scripts/count-azure-hosts.sh | grep "Azure Host Count:" | awk '{print $4}')
GCP=$(./scripts/count-gcp-hosts.sh | grep "GCP Host Count:" | awk '{print $4}')

# Calculate total
TOTAL=$((AWS + AZURE + GCP))
echo "Total Hosts Across All Clouds: $TOTAL"
```

### Multi-Account AWS Setup
```bash
# Use multi-account script for AWS
AWS=$(./scripts/count-aws-hosts-multi-account.sh | grep "TOTAL AWS Host Count" | awk '{print $6}')
AZURE=$(./scripts/count-azure-hosts.sh | grep "Azure Host Count:" | awk '{print $4}')
GCP=$(./scripts/count-gcp-hosts.sh | grep "GCP Host Count:" | awk '{print $4}')

# Calculate total
TOTAL=$((AWS + AZURE + GCP))
echo "Total Hosts Across All Clouds: $TOTAL"
```

## Important Notes

### What Gets Counted
- **Running hosts only**: Stopped, terminated, or deallocated instances are NOT counted
- **All regions/locations**: Scripts scan all available regions/zones
- **All accounts/subscriptions/projects**:
  - AWS: Use multi-account script for Organizations, or single account script
  - Azure: Counts across all accessible subscriptions
  - GCP: Counts across all accessible projects

### Datadog CSM Pro Pricing
- CSM Pro is priced per host per month
- Only **running** hosts are counted for billing
- The host count should match what Datadog reports in the Infrastructure List

### Performance
- **AWS Single Account**: May take 1-2 minutes to scan all regions (16+ regions globally)
- **AWS Multi-Account**: Time increases linearly with number of accounts (e.g., 10 accounts = ~10-20 minutes)
- **Azure**: Typically fast (seconds) as it queries all subscriptions at once
- **GCP**: Time depends on number of projects (can be slow with many projects)

### Troubleshooting

**AWS: "Unable to locate credentials"**
```bash
aws configure
# Enter your Access Key ID, Secret Access Key, and default region
```

**Azure: "Please run 'az login'"**
```bash
az login
# Follow browser authentication flow
```

**GCP: "You do not currently have an active account"**
```bash
gcloud auth login
# Follow browser authentication flow

# Set default project (optional)
gcloud config set project YOUR_PROJECT_ID
```

**AWS Multi-Account: "Cannot assume role in account"**
This means the cross-account role doesn't exist or trust is not configured properly:

1. Create the IAM role in each member account:
```bash
# In each member account, create a role that trusts the management account
# Role name: OrganizationAccountAccessRole (or custom name)
# Trust policy: Allow management account to assume the role
# Permissions: ec2:DescribeInstances, ec2:DescribeRegions
```

2. Example trust policy (replace `123456789012` with management account ID):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

3. Alternative: Use AWS CloudFormation StackSets to deploy the role across all accounts

**Script shows 0 hosts but you know you have instances:**
- Check CLI tool is authenticated: Run `aws sts get-caller-identity`, `az account show`, or `gcloud config list`
- Verify permissions: Ensure your account has read access to compute resources
- Check regions: Make sure instances exist in regions being scanned
- For AWS multi-account: Verify the assume role exists in all member accounts

## Integration with Datadog

After getting your host counts, you can verify against Datadog's Infrastructure List:

1. Go to Datadog UI → Infrastructure → Infrastructure List
2. Filter by cloud provider (e.g., `cloud_provider:aws`)
3. Count should match the script output

### Datadog Agent vs CSM Pro

Note: CSM Pro counts are based on cloud-native detection, NOT Datadog Agent installation. A host is counted if:
- It exists in your cloud account
- It's in "running" state
- Datadog has cloud integration configured (AWS, Azure, or GCP)

## Related Documentation

- [Datadog CSM Pro Pricing](https://www.datadoghq.com/pricing/?product=cloud-security-management#cloud-security-management)
- [Datadog Cloud Security Management](https://docs.datadoghq.com/security/cloud_security_management/)
- [Datadog Infrastructure Monitoring](https://docs.datadoghq.com/infrastructure/)
