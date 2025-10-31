#!/bin/bash
set -e

# Gateway API Setup Script for GKE
# Cluster: nuttee-cluster-1
# Region: asia-southeast1-b
# Project: datadog-ese-sandbox

PROJECT_ID="datadog-ese-sandbox"
CLUSTER_NAME="nuttee-cluster-1"
CLUSTER_LOCATION="asia-southeast1-b"
STATIC_IP_NAME="mcp-agent-gateway-ip"

echo "========================================="
echo "Gateway API Setup for MCP Agent"
echo "Multi-Tenant Shared Gateway Pattern"
echo "========================================="
echo ""

# Step 1: Enable Gateway API on cluster
echo "Step 1: Enabling Gateway API on GKE cluster..."
gcloud container clusters update $CLUSTER_NAME \
  --location=$CLUSTER_LOCATION \
  --gateway-api=standard \
  --project=$PROJECT_ID

echo "✓ Gateway API enabled"
echo ""

# Step 2: Reserve static IP address
echo "Step 2: Reserving static IP address..."
if gcloud compute addresses describe $STATIC_IP_NAME --global --project=$PROJECT_ID >/dev/null 2>&1; then
  echo "✓ Static IP already exists"
else
  gcloud compute addresses create $STATIC_IP_NAME \
    --global \
    --ip-version IPV4 \
    --project=$PROJECT_ID
  echo "✓ Static IP created"
fi

GATEWAY_IP=$(gcloud compute addresses describe $STATIC_IP_NAME --global --project=$PROJECT_ID --format="get(address)")
echo ""
echo "========================================="
echo "Gateway IP Address: $GATEWAY_IP"
echo "========================================="
echo ""
echo "IMPORTANT: Configure this IP in your Namecheap DNS:"
echo "  @ → $GATEWAY_IP"
echo "  www → $GATEWAY_IP"
echo "  burgers → $GATEWAY_IP"
echo "  api → $GATEWAY_IP"
echo "  burger-api → $GATEWAY_IP"
echo "  dev → $GATEWAY_IP"
echo "  *.dev → $GATEWAY_IP"
echo ""
read -p "Press Enter to continue after noting the IP address..."

# Step 3: Create namespaces
echo "Step 3: Creating namespaces..."
kubectl apply -f 00-namespace-shared-infra.yaml
echo "✓ Shared infrastructure and production namespaces created"
echo ""

# Step 4: Deploy Gateway
echo "Step 4: Deploying shared Gateway in shared-infra namespace..."
kubectl apply -f 01-gateway.yaml
echo "✓ Gateway created"
echo ""

# Step 5: Wait for Gateway to be ready
echo "Step 5: Waiting for Gateway to be ready (this may take 5-10 minutes)..."
kubectl wait --for=condition=Programmed gateway/shared-gateway -n shared-infra --timeout=600s || {
  echo "⚠ Timeout waiting for Gateway. Checking status..."
  kubectl describe gateway shared-gateway -n shared-infra
}
echo ""

# Step 6: Get Gateway status
echo "Step 6: Checking Gateway status..."
kubectl get gateway shared-gateway -n shared-infra -o wide
echo ""

GATEWAY_ASSIGNED_IP=$(kubectl get gateway shared-gateway -n shared-infra -o jsonpath='{.status.addresses[0].value}' 2>/dev/null || echo "pending")
echo "Gateway assigned IP: $GATEWAY_ASSIGNED_IP"
echo ""

if [ "$GATEWAY_ASSIGNED_IP" != "$GATEWAY_IP" ] && [ "$GATEWAY_ASSIGNED_IP" != "pending" ]; then
  echo "⚠ WARNING: Gateway IP ($GATEWAY_ASSIGNED_IP) doesn't match static IP ($GATEWAY_IP)"
  echo "   Check the static IP annotation in 01-gateway.yaml"
fi

# Step 7: Deploy HTTPRoutes
echo "Step 7: Deploying HTTPRoutes..."
kubectl apply -f 02-httproute-dev.yaml
kubectl apply -f 03-httproute-prod.yaml
echo "✓ HTTPRoutes deployed"
echo ""

# Step 8: Check HTTPRoute status
echo "Step 8: Checking HTTPRoute status..."
echo ""
echo "Dev environment:"
kubectl get httproute -n mcp-agent-dev
echo ""
echo "Prod environment:"
kubectl get httproute -n mcp-agent-prod
echo ""

# Step 9: Summary
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Gateway IP: $GATEWAY_IP"
echo "Gateway Status:"
kubectl get gateway shared-gateway -n shared-infra -o jsonpath='{.status.conditions[?(@.type=="Programmed")]}' | jq '.' || echo "(jq not installed, showing raw)"
echo ""
echo "Architecture:"
echo "  - Shared Gateway: shared-infra namespace"
echo "  - Dev HTTPRoute: mcp-agent-dev namespace"
echo "  - Prod HTTPRoute: mcp-agent-prod namespace"
echo ""
echo "Next Steps:"
echo "1. Configure DNS in Namecheap (see IP above)"
echo "2. Wait for DNS propagation (5-60 minutes)"
echo "3. Test with: curl -v http://dev.platform-engineering-demo.dev"
echo ""
echo "Useful commands:"
echo "  kubectl describe gateway shared-gateway -n shared-infra"
echo "  kubectl describe httproute -n mcp-agent-dev"
echo "  kubectl describe httproute -n mcp-agent-prod"
echo "  kubectl get httproute --all-namespaces"
echo ""
