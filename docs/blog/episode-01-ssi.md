---
layout: default
title: "Episode 1: The Secret Sauce - SSI"
parent: "Bits Learn to Bites - Blog Series"
nav_order: 1
---

# Episode 1: The Secret Sauce - SSI (Single Step Instrumentation)

**Difficulty:** 🟢 Beginner

**Reading Time:** 8 minutes

**Prerequisites:**
- Basic Kubernetes knowledge
- Datadog account
- Access to a Kubernetes cluster (GKE, EKS, or local)

**What You'll Build:**
- APM-enabled Kubernetes cluster with zero code changes
- Automatic instrumentation for all Node.js services

---

## 🎯 The Problem

You're deploying your fifth microservice this month. You know the drill:

```typescript
// service-1/src/index.ts
import 'dd-trace/init';
import express from 'express';
// ... rest of code

// service-2/src/index.ts
import 'dd-trace/init';
import express from 'express';
// ... rest of code

// service-3/src/index.ts
import 'dd-trace/init';
import express from 'express';
// ... same boilerplate AGAIN
```

**Problems with this approach:**

1. **Maintenance Nightmare** 😫
   - Update dd-trace version? Touch every service
   - Change configuration? Update 15 repos
   - New service? Copy-paste (and forget something)

2. **Inconsistency** 🎲
   - Some services have profiling enabled
   - Some don't have log injection
   - Different dd-trace versions across services
   - "It works on my machine" syndrome

3. **Slow Onboarding** 🐌
   - New team member: "Wait, where do I add Datadog?"
   - Documentation gets outdated
   - Everyone has their own way of doing it

4. **Forgot to Instrument** 🤦
   - Deploy new service → No APM data
   - Realize 3 weeks later
   - "Why don't we have traces for that API?"

**Real-world cost:**
> At a 50-service company, managing manual instrumentation costs ~2 hours/week in maintenance, ~4 hours per new service onboarding, and countless hours debugging "missing instrumentation" issues.

---

## 🔍 The Investigation

Let's look at what's currently happening in our Contoso Burgers app **WITHOUT** SSI:

```typescript
// packages/agent-api/src/old-approach.ts (DON'T DO THIS)
import tracer from 'dd-trace';

// Every service needs this
const ddTracer = tracer.init({
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'agent-api',
  version: process.env.DD_VERSION || '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  // ... 15 more configuration options
});

// And this import must be FIRST, before anything else
// Mess up the order? Instrumentation breaks!
```

**What this means:**
- ❌ 30+ lines of boilerplate per service
- ❌ 5 services = 150 lines of copy-paste code
- ❌ Import order matters (fragile!)
- ❌ Configuration drift between services
- ❌ Manual updates when Datadog releases new features

---

## 💡 The Solution: Single Step Instrumentation (SSI)

**What if Kubernetes could auto-inject APM into your pods?**

That's exactly what SSI does! 🎉

### **How SSI Works**

```
┌─────────────────────────────────────────────────────────────┐
│ Kubernetes API Server                                       │
│   ↓                                                          │
│ Datadog Admission Controller (watches pod creation)         │
│   ↓                                                          │
│ Mutating Webhook: Inject dd-trace library into container    │
│   ↓                                                          │
│ Pod starts with dd-trace v5 automatically loaded             │
│   ↓                                                          │
│ Your application runs with APM - ZERO CODE CHANGES! ✨      │
└─────────────────────────────────────────────────────────────┘
```

**SSI automatically provides:**
- ✅ HTTP/Express instrumentation
- ✅ Database query tracing (PostgreSQL, MySQL, MongoDB, etc.)
- ✅ Distributed trace context propagation
- ✅ Runtime metrics (memory, CPU, GC)
- ✅ Continuous profiling
- ✅ Log injection (trace IDs in logs)

**What you still control:**
- Service name (via Kubernetes labels)
- Environment tagging (via labels)
- Sampling rates (via environment variables)
- Custom spans (via manual code)

---

## 🛠️ Hands-On Implementation

### **Step 1: Install Datadog Cluster Agent with SSI**

First, create a Kubernetes secret with your Datadog API key:

```bash
kubectl create secret generic datadog-secret \
  --from-literal=api-key=YOUR_DATADOG_API_KEY \
  -n datadog
```

Install the Datadog Helm chart with SSI enabled:

```yaml
# k8s/datadog/datadog-values.yaml
datadog:
  site: "datadoghq.com"
  apiKeyExistingSecret: "datadog-secret"

  # 🎯 This is the magic - SSI configuration
  apm:
    instrumentation:
      enabled: true  # ← Enable SSI
      targets:
        - name: "mcp-agent-apps"
          namespaceSelector:
            matchNames:
              - "mcp-agent-dev"
              - "mcp-agent-prod"
          ddTraceVersions:
            js: "5"  # ← Latest dd-trace for Node.js
          ddTraceConfigs:
            - name: "DD_PROFILING_ENABLED"
              value: "auto"

  logs:
    enabled: true
    containerCollectAll: true
```

Deploy the Datadog Agent:

```bash
helm repo add datadog https://helm.datadoghq.com
helm repo update

helm install datadog-agent -f k8s/datadog/datadog-values.yaml \
  --set datadog.clusterName=my-cluster \
  -n datadog \
  datadog/datadog
```

**What just happened?**
- Datadog Admission Controller is now watching your namespaces
- Any pod in `mcp-agent-dev` or `mcp-agent-prod` will get auto-instrumented
- No code changes needed!

---

### **Step 2: Label Your Kubernetes Deployments**

SSI uses Kubernetes labels for service metadata:

```yaml
# k8s/base/deployments/burger-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: burger-api
  labels:
    tags.datadoghq.com/env: "dev"      # ← Environment tag
    tags.datadoghq.com/service: "burger-api"  # ← Service name
    tags.datadoghq.com/version: "1.0.0"       # ← Version tag
spec:
  template:
    metadata:
      labels:
        tags.datadoghq.com/env: "dev"
        tags.datadoghq.com/service: "burger-api"
        tags.datadoghq.com/version: "1.0.0"
    spec:
      containers:
      - name: burger-api
        image: your-registry/burger-api:latest
        env:
        # Use fieldRef to inject labels as environment variables
        - name: DD_ENV
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/env']
        - name: DD_SERVICE
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/service']
        - name: DD_VERSION
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['tags.datadoghq.com/version']
        - name: DD_LOGS_INJECTION
          value: "true"  # ← Enable trace correlation in logs
        - name: DD_TRACE_SAMPLE_RATE
          value: "1"     # ← 100% sampling (adjust for prod)
```

**Key points:**
- Labels on BOTH deployment and pod template
- Environment variables from fieldRef (DRY principle)
- Standard tags: env, service, version (Unified Service Tagging)

---

### **Step 3: Update Your Application Code (SSI-Compatible)**

**BEFORE (Manual Initialization):**
```typescript
// ❌ DON'T DO THIS with SSI
import tracer from 'dd-trace';

const ddTracer = tracer.init({
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'burger-api',
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
});

// Problem: This conflicts with SSI!
// Result: Double initialization, unpredictable behavior
```

**AFTER (SSI-Compatible):**
```typescript
// ✅ DO THIS with SSI
import tracer from 'dd-trace';

// Use the SSI-initialized tracer directly
// SSI already called tracer.init() for you via admission controller
const ddTracer = tracer;

// For LLM Observability or custom spans, just use it:
export const llmobs = ddTracer.llmobs;
export { ddTracer };

console.log('Using SSI-initialized Datadog tracer:', {
  env: process.env.DD_ENV,
  service: process.env.DD_SERVICE,
  version: process.env.DD_VERSION,
  note: 'APM initialized via SSI - no tracer.init() needed!',
});
```

**See it in our code:**
- [packages/agent-api/src/dd-tracer.ts](../../packages/agent-api/src/dd-tracer.ts) - SSI-compatible tracer
- [packages/agent-api/src/logger.ts](../../packages/agent-api/src/logger.ts) - Logger without init

---

### **Step 4: Deploy and Verify**

Deploy your service:

```bash
kubectl apply -f k8s/base/deployments/burger-api.yaml
```

Watch the magic happen:

```bash
# Check pod logs
kubectl logs -n mcp-agent-dev deployment/burger-api | head -20

# You should see:
# ✅ No "dd-trace already initialized" warnings
# ✅ "Using SSI-initialized Datadog tracer" message
# ✅ APM working without any tracer.init() in your code!
```

Check Datadog UI:
1. Go to **APM** → **Services**
2. Find `burger-api`
3. Click into it → You should see traces! 🎉

---

## 🎓 Deep Dive: How SSI Actually Works

### **The Admission Controller Magic**

When you deploy a pod to a namespace targeted by SSI:

**1. Pod Creation Event**
```
kubectl apply → Kubernetes API → Datadog Admission Controller
```

**2. Webhook Mutation**
The controller modifies your pod spec to add:

```yaml
initContainers:
- name: datadog-lib-js-init
  image: gcr.io/datadoghq/dd-lib-js-init:v5
  command: ["sh", "-c", "cp -r /datadog-lib/. /datadog-init"]
  volumeMounts:
  - name: datadog-auto-instrumentation
    mountPath: /datadog-init

env:
- name: NODE_OPTIONS
  value: "--require /datadog-lib/node_modules/dd-trace/init"
- name: DD_ENV
  value: "dev"
- name: DD_SERVICE
  value: "burger-api"
# ... etc
```

**3. Runtime Behavior**
- Init container copies `dd-trace` library into shared volume
- `NODE_OPTIONS` forces Node.js to require dd-trace on startup
- Environment variables configure the tracer
- Your app code runs with APM automatically!

**4. Result**
Your app sees an already-initialized tracer - just import and use it!

---

## 🚨 Common Gotchas & How to Avoid Them

### **Gotcha #1: Double Initialization**

**Problem:**
```typescript
// Your code still has tracer.init()
import tracer from 'dd-trace';
tracer.init({ /* config */ });

// SSI also initialized tracer
// Result: "dd-trace already initialized" warning
```

**Solution:**
```typescript
// Just import, don't initialize
import tracer from 'dd-trace';

// Use directly - SSI already initialized it
const span = tracer.startSpan('my.operation');
```

**How we fixed this:**
See [commit a78ec32](https://github.com/nuttea/mcp-agent-langchainjs-datadog/commit/a78ec32) where we removed duplicate initialization.

---

### **Gotcha #2: Missing Labels**

**Problem:**
```yaml
# Deployment has labels, but pod template doesn't
metadata:
  labels:
    tags.datadoghq.com/service: "burger-api"  # ✅ On deployment
spec:
  template:
    metadata:
      labels: {}  # ❌ Missing on pod!
```

**Solution:**
```yaml
# Labels must be on BOTH deployment AND pod template
metadata:
  labels:
    tags.datadoghq.com/service: "burger-api"
spec:
  template:
    metadata:
      labels:
        tags.datadoghq.com/service: "burger-api"  # ✅ Also on pod
```

---

### **Gotcha #3: Wrong Namespace**

**Problem:**
```yaml
# SSI configured for these namespaces:
namespaceSelector:
  matchNames:
    - "mcp-agent-dev"
    - "mcp-agent-prod"

# But you deployed to different namespace:
kubectl apply -f deployment.yaml -n my-app  # ❌ Not instrumented!
```

**Solution:**
- Deploy to the configured namespaces, OR
- Update SSI config to include your namespace

---

## 📊 Results & Validation

### **Before SSI:**

| Metric | Value | Notes |
|--------|-------|-------|
| Code per service | 30-50 lines | Boilerplate instrumentation |
| Time to add APM | 30 minutes | Research, copy-paste, test |
| Maintenance burden | 2 hours/week | Version updates, config drift |
| Services instrumented | 3 of 5 | Forgot 2 services |
| Configuration consistency | 60% | Each service slightly different |

### **After SSI:**

| Metric | Value | Notes |
|--------|-------|-------|
| Code per service | 0 lines | Zero boilerplate! |
| Time to add APM | 0 seconds | Automatic |
| Maintenance burden | 5 minutes/month | Update Helm chart only |
| Services instrumented | 5 of 5 | All pods auto-instrumented |
| Configuration consistency | 100% | Centralized config |

**Improvement:** ~90% reduction in effort 🎉

---

### **Datadog UI - What You'll See**

**APM Service List:**
```
✅ agent-api        (env:dev, version:a78ec32)
✅ burger-api       (env:dev, version:a78ec32)
✅ burger-mcp       (env:dev, version:a78ec32)
✅ agent-webapp     (RUM)
✅ burger-webapp    (RUM)
```

**Trace Example:**
```
GET /api/burgers (burger-api)
  ├─ express.middleware (corsMiddleware) - 44μs
  ├─ express.middleware (jsonParser) - 37μs
  ├─ postgres.query (SELECT * FROM burgers) - 15ms  ← Auto-instrumented!
  └─ express.middleware (bound dispatch) - 52ms

Duration: 54ms
Tags: env:dev, service:burger-api, version:a78ec32
```

**Notice:** PostgreSQL query is automatically traced - you didn't write any code for this!

---

## 🤖 AI-Powered Exploration

Now let's use Claude Code with Datadog MCP to explore your SSI setup!

### **Beginner Prompt:**

```markdown
Using Datadog MCP, show me all services with APM tracing enabled in my environment.

For each service, tell me:
1. Service name
2. Environment (dev/prod)
3. Language/runtime
4. Whether it's using automatic instrumentation

Use:
- mcp__datadog-mcp__search_datadog_services
- mcp__datadog-mcp__search_datadog_spans (to infer instrumentation method)
```

**Expected insights:**
- List of all instrumented services
- Which are Node.js (SSI candidates)
- Which might have manual instrumentation

---

### **Intermediate Prompt:**

```markdown
Using Datadog MCP, analyze my burger-api service and show me:

1. What automatic instrumentation is working (HTTP, DB, etc.)
2. Average response time by endpoint
3. Any errors in the last hour
4. Database queries being executed

Then explain: Which parts of this came from SSI, and which would need custom spans?

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:burger-api")
- Group by operation_name to see different span types
- Identify automatic vs manual instrumentation patterns
```

**Expected insights:**
- SSI automatically traces: HTTP (express.request), DB (postgres.query)
- You'd need custom spans for: Business logic, background jobs

---

### **Advanced Prompt:**

```markdown
Compare the instrumentation between burger-api and agent-api services.

Questions to answer:
1. Do they have consistent APM coverage?
2. Are there any gaps in instrumentation?
3. What's the p95 latency difference?
4. Which service has more database calls per request?

Use:
- mcp__datadog-mcp__search_datadog_spans for both services
- Calculate statistics (p50, p95, p99)
- Look for missing spans or gaps
```

**Expected insights:**
- Configuration consistency across services (thanks to SSI!)
- Performance comparison
- Identify optimization opportunities

---

### **Challenge Prompt:**

```markdown
You're a consultant auditing this Kubernetes cluster's observability.

Task: Create a report showing:
1. Which services have APM vs which don't
2. For services without APM, explain why (wrong namespace? not Node.js?)
3. Calculate the "observability coverage percentage"
4. Recommend how to improve coverage to 100%

Use all available Datadog MCP tools to investigate.
```

**Expected output:**
- Comprehensive audit report
- Gap analysis
- Actionable recommendations

---

## 🎓 Key Takeaways

**TL;DR:**
1. **SSI = Zero-code APM** - Kubernetes admission controller injects dd-trace automatically
2. **Use Kubernetes labels** for service metadata (env, service, version)
3. **Don't call tracer.init()** - SSI already did it for you
4. **80% of APM for free** - HTTP, DB, external calls auto-instrumented
5. **Add custom spans** for the remaining 20% (your business logic)

---

### **When to Use SSI:**

✅ **Use SSI when:**
- You have 3+ services to instrument
- You use Kubernetes (GKE, EKS, AKS)
- You want zero-maintenance APM
- You need consistent configuration
- You're using supported languages (Node.js, Python, Java, .NET, etc.)

❌ **Don't use SSI when:**
- You're not on Kubernetes (use manual instrumentation)
- You need very custom tracer configuration
- You're using unsupported language/runtime
- You deploy to serverless (Lambda, Cloud Functions)

---

### **Cost Considerations:**

**SSI Impact:**
- ✅ **Development time:** ~2 hours/week saved on maintenance
- ✅ **Onboarding:** New services get APM automatically
- ⚠️ **Datadog usage:** Same as manual (sampling rate controls cost)
- ✅ **Infrastructure:** Minimal overhead (~50MB per node for Cluster Agent)

**Best practice:** Start with 100% sampling in dev, reduce to 20-50% in prod based on traffic volume.

---

## 🔗 Related Resources

**Datadog Documentation:**
- [Single Step Instrumentation](https://docs.datadoghq.com/tracing/trace_collection/automatic_instrumentation/)
- [Admission Controller](https://docs.datadoghq.com/containers/cluster_agent/admission_controller/)
- [Unified Service Tagging](https://docs.datadoghq.com/getting_started/tagging/unified_service_tagging/)

**Code Examples from This Project:**
- [SSI Configuration](../../k8s/datadog/datadog-values.yaml#L19-L39) - Helm values
- [Deployment Labels](../../k8s/base/deployments/burger-api.yaml#L6-L8) - Kubernetes labels
- [SSI-Compatible Tracer](../../packages/agent-api/src/dd-tracer.ts) - Code example
- [Before/After Comparison](https://github.com/nuttea/mcp-agent-langchainjs-datadog/commit/a78ec32) - Git commit

**Previous Episodes:**
- *This is Episode 1 - the beginning!*

**Next Episode Preview:**
- **Episode 2: "Logs & Traces: A Love Story"** - Learn how to make your logs and traces work together seamlessly with structured logging and automatic correlation

---

## 💬 Try It Yourself

### **Exercise 1: Deploy SSI to Your Cluster**

```bash
# 1. Clone the repo
git clone https://github.com/nuttea/mcp-agent-langchainjs-datadog
cd mcp-agent-langchainjs-datadog

# 2. Set your Datadog API key
export DD_API_KEY="your-api-key-here"

# 3. Deploy Datadog Agent with SSI
helm install datadog-agent -f k8s/datadog/datadog-values.yaml \
  --set datadog.clusterName=my-cluster \
  --set datadog.apiKeyExistingSecret=datadog-secret \
  -n datadog \
  datadog/datadog

# 4. Deploy burger-api
kubectl apply -k k8s/overlays/dev

# 5. Check APM in Datadog UI
echo "Check APM → Services in Datadog UI in 60 seconds"
```

### **Exercise 2: Verify SSI is Working**

```bash
# Check pod logs for SSI message
kubectl logs -n mcp-agent-dev deployment/burger-api | grep -i "ssi\|datadog"

# Expected output:
# "Using SSI-initialized Datadog tracer"
# No errors or double-init warnings

# Check environment variables were injected
kubectl exec -n mcp-agent-dev deployment/burger-api -- env | grep DD_

# Expected:
# DD_ENV=dev
# DD_SERVICE=burger-api
# DD_VERSION=1.0.0
# DD_LOGS_INJECTION=true
```

### **Exercise 3: Compare Manual vs SSI**

Create two deployments:
1. One with SSI (in `mcp-agent-dev` namespace)
2. One with manual instrumentation (in `manual-test` namespace)

**Observation checklist:**
- [ ] Both show traces in Datadog?
- [ ] Same trace quality and completeness?
- [ ] Any differences in startup time?
- [ ] Which one was easier to set up?

---

## 📸 Screenshots

*[Note: Add screenshots when publishing]*

1. SSI configuration in Helm values
2. Datadog Service List showing instrumented services
3. Trace example showing auto-instrumented spans
4. Pod logs showing SSI initialization message

---

## 🎁 Bonus Tips

### **Tip #1: SSI with LLM Observability**

Good news! SSI and LLM Observability work together:

```yaml
# In ConfigMap
DD_LLMOBS_ENABLED: "true"
DD_LLMOBS_ML_APP: "contoso-burgers-agent"

# In your code
import { llmobs } from './dd-tracer.js';  # ← SSI-compatible!
await llmobs.trace({ kind: 'workflow' }, async () => {
  // Your LLM code
});
```

See [Episode 4](#episode-4) for details!

---

### **Tip #2: Multi-Environment with SSI**

Use the same SSI config for all environments:

```yaml
namespaceSelector:
  matchNames:
    - "mcp-agent-dev"
    - "mcp-agent-staging"
    - "mcp-agent-prod"
```

Environment tag comes from Kubernetes labels - no code changes needed per environment!

---

### **Tip #3: Debugging SSI**

If SSI isn't working:

```bash
# 1. Check admission controller is running
kubectl get pods -n datadog | grep admission-controller

# 2. Check webhook configuration
kubectl get mutatingwebhookconfigurations | grep datadog

# 3. Check pod annotations (should be added by webhook)
kubectl get pod <pod-name> -n mcp-agent-dev -o yaml | grep admission

# 4. Check logs
kubectl logs -n datadog deployment/datadog-cluster-agent | grep admission
```

---

## 🎬 Coming Up Next

**Episode 2: "Logs & Traces: A Love Story"**

You've got APM working with SSI - awesome! But your logs are still using `console.log()` everywhere. Learn how to set up structured logging with automatic trace correlation, so every log entry links directly to its APM trace.

**Sneak peek:**
```typescript
// Before
console.log('Order created:', orderId);  // ❌ No correlation

// After
logger.info({ orderId, userId }, 'Order created');  // ✅ Trace ID auto-injected!
// Click log in Datadog → Jump to full APM trace
```

[Read Episode 2 →](./episode-02-logs-and-traces.md) *(Coming Tuesday, November 12)*

---

## 💬 Discussion

**Questions? Thoughts? Share below!**

- What challenges did you face setting up SSI?
- Did it work on your first try?
- What would you like to see in future episodes?

**Join the discussion:** [GitHub Discussions](https://github.com/nuttea/mcp-agent-langchainjs-datadog/discussions)

**Share your success:** Tag `#BitsLearnToBites` on social media!

---

**Published:** November 9, 2025
**Author:** Nuttee Jirattivongvibul (Platform Engineering @ Datadog)
**Series:** Bits Learn to Bites - Episode 1 of 12
**Tags:** #Datadog #Kubernetes #APM #SSI #Observability #DevOps

---

**⬅️ [Series Index](./index.md)** | **[Episode 2: Logs & Traces →](./episode-02-logs-and-traces.md)**
