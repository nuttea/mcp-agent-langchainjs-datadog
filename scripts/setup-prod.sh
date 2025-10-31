#!/bin/bash
set -e

echo "========================================="
echo "Production Deployment Setup"
echo "========================================="
echo ""

# Check if mcp-agent-prod namespace exists
if kubectl get namespace mcp-agent-prod >/dev/null 2>&1; then
  echo "✓ Production namespace already exists"
else
  echo "Creating production namespace..."
  kubectl apply -f k8s/gateway/00-namespace-shared-infra.yaml
  echo "✓ Production namespace created"
fi
echo ""

# Create production ConfigMap
echo "Creating production ConfigMap..."
kubectl apply -f k8s/config/configmap-prod.yaml
echo "✓ ConfigMap created"
echo ""

# Check if secrets exist
if kubectl get secret app-secrets -n mcp-agent-prod >/dev/null 2>&1; then
  echo "✓ Secrets already exist"
else
  echo "⚠️  Secrets not found!"
  echo ""
  echo "You need to create secrets with your OpenAI API key:"
  echo ""
  echo "kubectl create secret generic app-secrets \\"
  echo "  --namespace=mcp-agent-prod \\"
  echo "  --from-literal=openai-api-key=YOUR_OPENAI_API_KEY"
  echo ""
  read -p "Press Enter after creating secrets, or Ctrl+C to exit..."
fi
echo ""

# Create production manifests directory
if [ ! -d "k8s/manifests-prod" ]; then
  echo "Creating production manifests..."
  mkdir -p k8s/manifests-prod

  # Copy manifests
  cp k8s/manifests/*.yaml k8s/manifests-prod/

  # Update namespace (macOS)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml
    sed -i '' 's/environment: dev/environment: prod/g' k8s/manifests-prod/*.yaml
  else
    # Linux
    sed -i 's/namespace: mcp-agent-dev/namespace: mcp-agent-prod/g' k8s/manifests-prod/*.yaml
    sed -i 's/environment: prod/environment: prod/g' k8s/manifests-prod/*.yaml
  fi

  echo "✓ Production manifests created in k8s/manifests-prod/"
  echo ""
  echo "⚠️  IMPORTANT: Review and update the following in manifests-prod/*.yaml:"
  echo "  1. Change Service type from LoadBalancer to ClusterIP (for webapps)"
  echo "  2. Update replica count (set to 2+ for HA)"
  echo "  3. Review resource limits"
  echo ""
  read -p "Press Enter after reviewing manifests, or Ctrl+C to make changes..."
else
  echo "✓ Production manifests directory already exists"
fi
echo ""

# Deploy to production
echo "Deploying services to production..."
kubectl apply -f k8s/manifests-prod/
echo "✓ Services deployed"
echo ""

# Wait for deployments
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=Available --timeout=300s \
  deployment --all -n mcp-agent-prod || echo "Some deployments may still be starting"
echo ""

# Apply production HTTPRoutes
echo "Applying production HTTPRoutes..."
kubectl apply -f k8s/gateway/03-httproute-prod.yaml
echo "✓ HTTPRoutes configured"
echo ""

# Show status
echo "========================================="
echo "Production Deployment Status"
echo "========================================="
echo ""

echo "Pods:"
kubectl get pods -n mcp-agent-prod
echo ""

echo "Services:"
kubectl get svc -n mcp-agent-prod
echo ""

echo "HTTPRoutes:"
kubectl get httproute -n mcp-agent-prod
echo ""

echo "========================================="
echo "✅ Production Setup Complete!"
echo "========================================="
echo ""
echo "Your services are now running in production!"
echo ""
echo "Access your production apps:"
echo "  - Agent: https://platform-engineering-demo.dev"
echo "  - Burgers: https://burgers.platform-engineering-demo.dev"
echo ""
echo "Useful commands:"
echo "  make k8s-status ENV=prod          - Check deployment status"
echo "  make k8s-logs ENV=prod            - View logs"
echo "  make deploy-agent-api ENV=prod    - Deploy single service"
echo ""
