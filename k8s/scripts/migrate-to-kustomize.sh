#!/bin/bash

set -e

echo "🚀 Migrating Kubernetes manifests to Kustomize structure..."
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p k8s/base
mkdir -p k8s/overlays/dev/patches
mkdir -p k8s/overlays/prod/patches

# Copy manifests to base (we'll use dev as source, strip namespace and env labels)
echo "📋 Copying manifests to base directory..."

for file in k8s/manifests/*.yaml; do
    filename=$(basename "$file")

    # Skip namespace files
    if [[ "$filename" == "namespace.yaml" ]] || [[ "$filename" == "namespace-prod.yaml" ]]; then
        continue
    fi

    echo "  Processing $filename..."

    # Copy to base and remove namespace and environment-specific labels
    sed -e '/^  namespace: /d' \
        -e 's/environment: dev//g' \
        -e 's/tags.datadoghq.com\/env: "dev"/tags.datadoghq.com\/env: ENV_PLACEHOLDER/g' \
        "$file" > "k8s/base/$filename"
done

# Copy postgres files to base
echo "  Processing postgres-statefulset.yaml..."
if [ -f "k8s/postgres-statefulset.yaml" ]; then
    sed -e '/^  namespace: /d' \
        -e 's/environment: dev//g' \
        k8s/postgres-statefulset.yaml > k8s/base/postgres-statefulset.yaml
fi

echo "  Processing postgres-init-job.yaml..."
if [ -f "k8s/postgres-init-job.yaml" ]; then
    sed -e '/^  namespace: /d' \
        -e 's/environment: dev//g' \
        k8s/postgres-init-job.yaml > k8s/base/postgres-init-job.yaml
fi

echo ""
echo "✅ Base manifests created in k8s/base/"
echo ""
echo "Next steps:"
echo "  1. Review k8s/base/ manifests"
echo "  2. Create kustomization.yaml files"
echo "  3. Create overlay patches"
echo "  4. Test with: kustomize build k8s/overlays/dev"
echo ""
echo "⚠️  Note: You'll need to manually create:"
echo "  - k8s/base/kustomization.yaml"
echo "  - k8s/overlays/dev/kustomization.yaml
echo "  - k8s/overlays/prod/kustomization.yaml"
echo "  - Patch files for environment-specific differences"
