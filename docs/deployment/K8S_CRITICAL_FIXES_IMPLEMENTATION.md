# Critical Kubernetes Security Fixes - Implementation Guide

**STOP:** Do not deploy to production until these fixes are implemented.

---

## Fix 1: Add Security Contexts (CRITICAL)

### Create Base Security Context Patch

Create: `k8s/base/security-context-patch.yaml`

```yaml
# This will be applied to all deployments via Kustomize
apiVersion: apps/v1
kind: Deployment
metadata:
  name: placeholder
spec:
  template:
    spec:
      # Pod-level security context
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault

      containers:
      - name: placeholder
        # Container-level security context
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
          runAsNonRoot: true
          runAsUser: 1000
```

### Apply to Each Deployment

**For Node.js Services (agent-api, burger-api, burger-mcp):**
```yaml
# Add to spec.template.spec in each deployment
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

containers:
- name: agent-api  # or burger-api, burger-mcp
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
    runAsNonRoot: true
    runAsUser: 1000
```

**For Nginx Services (agent-webapp, burger-webapp):**
```yaml
# Nginx typically runs as nginx user (UID 101)
securityContext:
  runAsNonRoot: true
  runAsUser: 101
  fsGroup: 101
  seccompProfile:
    type: RuntimeDefault

containers:
- name: agent-webapp
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
    runAsNonRoot: true
    runAsUser: 101
```

**For PostgreSQL StatefulSet:**
```yaml
# Postgres runs as postgres user (UID 999 or 70)
securityContext:
  runAsNonRoot: true
  runAsUser: 999
  fsGroup: 999
  seccompProfile:
    type: RuntimeDefault

containers:
- name: postgres
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
    runAsNonRoot: true
    runAsUser: 999
```

### Commands to Apply

```bash
# Test the changes with dry-run
kubectl apply -k k8s/overlays/dev --dry-run=server

# Apply to dev first
kubectl apply -k k8s/overlays/dev

# Verify pods are running with correct UID
kubectl exec -n mcp-agent-dev deployment/agent-api -- id
# Should output: uid=1000 gid=1000

# Apply to prod
kubectl apply -k k8s/overlays/prod
```

---

## Fix 2: Remove Secrets from Git & Implement External Secrets (CRITICAL)

### Step 1: Rotate ALL Credentials

```bash
# 1. Rotate Datadog API Key
# - Go to https://app.datadoghq.com/organization-settings/api-keys
# - Revoke old key
# - Create new key
export DD_API_KEY="new-datadog-key"

# 2. Rotate OpenAI API Key
# - Go to https://platform.openai.com/api-keys
# - Revoke old key
# - Create new key
export OPENAI_API_KEY="new-openai-key"

# 3. Change PostgreSQL password
kubectl exec -n mcp-agent-dev postgres-0 -- psql -U burgerapp -d burgerdb -c "ALTER USER burgerapp WITH PASSWORD 'new-secure-password-here';"
kubectl exec -n mcp-agent-prod postgres-0 -- psql -U burgerapp -d burgerdb -c "ALTER USER burgerapp WITH PASSWORD 'new-secure-password-here';"
```

### Step 2: Store Secrets in Google Secret Manager

```bash
# Create secrets in Google Secret Manager
echo -n "$DD_API_KEY" | gcloud secrets create datadog-api-key --data-file=- --project=datadog-ese-sandbox
echo -n "$OPENAI_API_KEY" | gcloud secrets create openai-api-key --data-file=- --project=datadog-ese-sandbox
echo -n "new-secure-password" | gcloud secrets create postgres-password --data-file=- --project=datadog-ese-sandbox

# Grant access to GKE service account
PROJECT_ID="datadog-ese-sandbox"
GSA_NAME="gke-workload-sa"

gcloud iam service-accounts create $GSA_NAME --project=$PROJECT_ID

for secret in datadog-api-key openai-api-key postgres-password; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${GSA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done
```

### Step 3: Install External Secrets Operator

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace \
  --set installCRDs=true

# Wait for deployment
kubectl wait --for=condition=available --timeout=60s \
  deployment/external-secrets -n external-secrets-system
```

### Step 4: Create SecretStore

Create: `k8s/base/secret-store.yaml`

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: gcpsm-secret-store
spec:
  provider:
    gcpsm:
      projectID: "datadog-ese-sandbox"
      auth:
        workloadIdentity:
          clusterLocation: asia-southeast1-b
          clusterName: nuttee-cluster-1
          serviceAccountRef:
            name: external-secrets-sa
```

### Step 5: Create ExternalSecret

Create: `k8s/base/external-secret.yaml`

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcpsm-secret-store
    kind: SecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
  - secretKey: datadog-api-key
    remoteRef:
      key: datadog-api-key
  - secretKey: openai-api-key
    remoteRef:
      key: openai-api-key
  - secretKey: postgres-password
    remoteRef:
      key: postgres-password
```

### Step 6: Remove Secrets from Git

```bash
# Delete the exposed secrets file
git rm k8s/config/secrets.yaml
git rm k8s/overlays/*/secrets.yaml

# Remove from git history (CAREFUL!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch k8s/config/secrets.yaml k8s/overlays/*/secrets.yaml' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
```

### Step 7: Update generate-secrets.sh

Comment out or remove the script since we're using External Secrets now.

---

## Fix 3: Add Network Policies (CRITICAL)

### Create Base Network Policies

Create: `k8s/base/network-policy-database.yaml`

```yaml
# Deny all traffic to postgres by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-deny-all
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  - Egress

---
# Allow only API services to access postgres
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-allow-apis
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          component: backend-api
    ports:
    - protocol: TCP
      port: 5432
  # Allow DNS
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
```

Create: `k8s/base/network-policy-default-deny.yaml`

```yaml
# Deny all ingress by default (good starting point)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

### Apply Network Policies

```bash
# Add to kustomization.yaml
echo "  - network-policy-database.yaml" >> k8s/base/kustomization.yaml
echo "  - network-policy-default-deny.yaml" >> k8s/base/kustomization.yaml

# Apply to dev
kubectl apply -k k8s/overlays/dev

# Test connectivity
kubectl run -it --rm test-pod -n mcp-agent-dev --image=busybox -- wget -O- http://postgres:5432
# Should timeout (blocked by network policy)

kubectl run -it --rm test-pod -n mcp-agent-dev --image=busybox \
  --labels="component=backend-api" -- wget -O- http://postgres:5432
# Should connect (allowed by policy)
```

---

## Fix 4: Add ServiceAccounts & RBAC (CRITICAL)

### Create ServiceAccounts

Create: `k8s/base/service-accounts.yaml`

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agent-api-sa
automountServiceAccountToken: false
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: burger-api-sa
automountServiceAccountToken: false
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: burger-mcp-sa
automountServiceAccountToken: false
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: webapp-sa
automountServiceAccountToken: false
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: postgres-sa
automountServiceAccountToken: false
```

### Update Deployments to Use ServiceAccounts

Add to each deployment's `spec.template.spec`:

```yaml
spec:
  template:
    spec:
      serviceAccountName: agent-api-sa  # or appropriate SA
      automountServiceAccountToken: false
```

---

## Fix 5: Add Pod Disruption Budgets (HIGH)

Create: `k8s/base/pod-disruption-budgets.yaml`

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: agent-api-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      service: agent-api
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: burger-api-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      service: burger-api
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: burger-mcp-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      service: burger-mcp
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: postgres-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: postgres
```

---

## Fix 6: Change LoadBalancer to ClusterIP (HIGH)

### Update Service Definitions

In `k8s/base/agent-webapp.yaml` and `k8s/base/burger-webapp.yaml`:

```yaml
# Change from:
spec:
  type: LoadBalancer

# To:
spec:
  type: ClusterIP
```

All traffic should go through the Gateway API instead.

---

## Fix 7: Enable HTTPS on Gateway (HIGH)

### Create TLS Certificate Secret

```bash
# Generate self-signed cert for testing (use real cert for prod)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=*.example.com/O=MCP Agent"

# Create secret
kubectl create secret tls gateway-tls \
  --cert=tls.crt --key=tls.key \
  -n shared-infra
```

### Update Gateway Configuration

Edit `k8s/gateway/01-gateway.yaml`:

```yaml
spec:
  gatewayClassName: gke-l7-global-external-managed
  listeners:
  # Keep existing HTTP listener for redirect
  - name: http
    protocol: HTTP
    port: 80

  # Add HTTPS listener
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - kind: Secret
        name: gateway-tls
```

### Update HTTPRoutes to Redirect HTTP to HTTPS

Add to HTTPRoute specs:

```yaml
spec:
  parentRefs:
  - name: shared-gateway
    sectionName: https  # Use HTTPS listener

  rules:
  # Add HTTP redirect rule
  - matches:
    - path:
        type: PathPrefix
        value: /
    filters:
    - type: RequestRedirect
      requestRedirect:
        scheme: https
        statusCode: 301
```

---

## Validation Checklist

After implementing fixes:

```bash
# ✅ Check security contexts
kubectl get pods -n mcp-agent-dev -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.runAsUser}{"\n"}{end}'

# ✅ Verify no secrets in git
git log --all --full-history -- "**/secrets.yaml"

# ✅ Test network policies
kubectl run test -n mcp-agent-dev --rm -it --image=busybox -- nc -zv postgres 5432

# ✅ Check service accounts
kubectl get sa -n mcp-agent-dev

# ✅ Verify PDBs
kubectl get pdb -n mcp-agent-dev

# ✅ Check service types
kubectl get svc -n mcp-agent-dev -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.type}{"\n"}{end}'

# ✅ Test HTTPS
curl -k https://your-gateway-ip/
```

---

## Rollback Plan

If issues occur:

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/agent-api -n mcp-agent-dev

# Remove network policies temporarily
kubectl delete networkpolicy --all -n mcp-agent-dev

# Check pod logs
kubectl logs -n mcp-agent-dev deployment/agent-api --tail=100

# Describe pod for security context issues
kubectl describe pod -n mcp-agent-dev -l service=agent-api
```

---

## Timeline Estimate

- **Fix 1 (Security Contexts):** 2-3 hours
- **Fix 2 (Secrets Management):** 4-6 hours
- **Fix 3 (Network Policies):** 2-3 hours
- **Fix 4 (RBAC):** 1-2 hours
- **Fix 5 (PDBs):** 30 minutes
- **Fix 6 (Services):** 30 minutes
- **Fix 7 (HTTPS):** 2-3 hours

**Total:** 12-18 hours (1.5-2 days)

---

## Support Resources

- [Kubernetes Security Contexts](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [External Secrets Operator Docs](https://external-secrets.io/latest/)
- [Network Policies Guide](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [GKE Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [Gateway API TLS](https://gateway-api.sigs.k8s.io/guides/tls/)
