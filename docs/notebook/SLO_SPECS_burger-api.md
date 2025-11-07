---
title: 'SLI and SLO Specification: burger-api'
author: Platform Engineering Team
modified: 2025-11-06T10:00:00Z
tags: [slo, sli, observability, sre, burger-api]
metadata: {}
time:
  live_span: 30d
template_variables: []
---

| **Property** | **Details** |
|-|-|
| **Status** | **Draft** |
| **Author** | Platform Engineering Team |
| **Team** | Platform Engineering / DevSecOps |
| **Last updated** | 10:00 UTC 11/06/2025 |
| **Reviewers** | SRE Team |
| **Service** | burger-api |
| **Environment** | prod |

# Service Description

**Purpose:** The burger-api service is a REST API that provides the backend for a burger ordering platform. It manages the burger menu catalog, toppings inventory, and order lifecycle management.

**User Journey:** The service supports critical user journeys including:
- Browse burger menu and view item details
- Explore available toppings and customize orders
- Place new burger orders
- Track and manage existing orders
- View order history

**Dependencies:**
- PostgreSQL database (burger data, toppings, orders)
- Azure Blob Storage / Cloud Storage (burger and topping images)
- Health check dependencies for monitoring

**Criticality:** HIGH - This service is the primary backend for the burger ordering platform. Without it, users cannot browse the menu, place orders, or track their orders.

**Service Type:** Request/Response (REST API)

---

# SRE Fundamentals

## Why SLOs Matter

> **"100% is the wrong reliability target"** - Google SRE

- Perfect reliability is impossible and slows innovation
- Error budgets balance reliability with feature velocity
- SLOs provide shared language between engineering and business

## Service Levels Hierarchy

```
SLI (Indicator) → Measurement of service behavior
    ↓
SLO (Objective) → Target for SLI (internal goal)
    ↓
SLA (Agreement) → Business contract with customer compensation
```

## Error Budget

**Error Budget = 100% - SLO Target**

Example: 99.9% availability SLO = 0.1% error budget = 43.2 minutes/month downtime

---

# Performance Baseline (Past 7 Days)

Based on Datadog APM metrics from 2025-10-30 to 2025-11-06:

**Volume:**
- Total Requests: ~419,000 requests
- Average Requests/Hour: ~3,600 requests/hour (1 req/sec)
- Peak Load: ~3,988 requests/hour

**Availability:**
- Current Availability: **99.99%+** (virtually no 4xx/5xx errors detected)
- Successful Requests: ~419,000
- Failed Requests: <50 (minimal)

**Latency (p95):**
- Median (p50): **7-8ms**
- p75: **8-10ms**
- **p95: 10-14ms**
- p99: 14-39ms (with occasional spikes)

**Key Endpoints:**
- `GET /` - Health check
- `GET /api` - Health check with stats
- `GET /api/burgers` - List burgers
- `GET /api/burgers/:id` - Get burger details
- `GET /api/toppings` - List toppings
- `GET /api/toppings/:id` - Get topping details
- `GET /api/orders` - List orders
- `GET /api/orders/:orderId` - Get order details
- `POST /api/orders` - Create order
- `DELETE /api/orders/:id` - Cancel order
- `GET /api/images/*` - Serve images
- `GET /api/openapi` - OpenAPI spec

---

# SLO 1: Service Availability

**User Journey:** Users are able to successfully browse burgers, view toppings, and place orders

**SLI Category:** Availability

**SLI Definition:** The proportion of successful HTTP requests, measured from server-side APM traces

**Measurement Method:**
- **Good Events:** HTTP requests returning 2xx or 3xx status codes
- **Total Events:** All HTTP requests received by the service
- **Formula:** `(successful_requests / total_requests) × 100%`

**Datadog Query:**
```
Numerator (Good): sum:trace.express.request.hits{service:burger-api,env:prod,!http.status_code:5*,!http.status_code:4*}.as_count()
Denominator (Total): sum:trace.express.request.hits{service:burger-api,env:prod}.as_count()
```

**SLO Target:** **99.9% over 30 days**

**Rationale:** Based on current performance (99.99%+), a 99.9% target is achievable and provides reasonable error budget for deployments and incidents. This allows for ~43 minutes of downtime per month while maintaining high user satisfaction.

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window
  * This catches fast, severe incidents that will exhaust error budget in ~2 days

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window
  * This catches slow burns that will exhaust error budget over the month

**Datadog SLO Configuration:**
```yaml
name: "burger-api - Availability (99.9%)"
type: metric
description: "Percentage of successful requests for burger-api in production"
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - sli_type:availability
thresholds:
  target: 99.9
  target_display: "99.900"
  timeframe: 30d
  warning: 99.95
query:
  numerator: "sum:trace.express.request.hits{service:burger-api,env:prod,!http.status_code:5*,!http.status_code:4*}.as_count()"
  denominator: "sum:trace.express.request.hits{service:burger-api,env:prod}.as_count()"
```

**Datadog SLO URL:** `https://app.datadoghq.com/slo?query=service%3Aburger-api%20sli_type%3Aavailability`

---

# SLO 2: Request Latency (p95)

**User Journey:** Users receive fast responses when browsing the menu and placing orders

**SLI Category:** Latency

**SLI Definition:** The proportion of requests completing within acceptable latency threshold (p95 ≤ 20ms)

**Measurement Method:**
- **Good Events:** Requests with p95 latency ≤ 20ms
- **Total Events:** All HTTP requests
- **Formula:** `(requests_within_threshold / total_requests) × 100%`

**Datadog Query:**
```
P95 Latency: p95:trace.express.request{service:burger-api,env:prod,span.kind:server}
P99 Latency: p99:trace.express.request{service:burger-api,env:prod,span.kind:server}
```

**Latency Thresholds:**
- **Fast (p50):** ≤ 10ms
- **Acceptable (p95):** ≤ 20ms
- **Slow (p99):** ≤ 50ms

**SLO Target:** **99% of requests complete within 20ms (p95) over 30 days**

**Rationale:** Current p95 latency is 10-14ms, providing healthy headroom. Setting the threshold at 20ms allows for database queries, occasional GC pauses, and normal variance while still delivering excellent user experience. This is well within user perception thresholds (100ms for "instant").

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window

**Monitor-based SLO (Alternative):**
```yaml
name: "burger-api - Latency p95 ≤ 20ms (99%)"
type: monitor
description: "Time-based availability using p95 latency monitor"
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - sli_type:latency
thresholds:
  target: 99.0
  timeframe: 30d
  warning: 99.5
monitor_ids:
  - [create monitor for: avg(last_5m):p95:trace.express.request{service:burger-api,env:prod,span.kind:server} > 0.020]
```

**Why 20ms?**
- Current baseline: 10-14ms p95
- Headroom for: Database latency variance (2-5ms), GC pauses (1-3ms), Network jitter (1-2ms)
- User perception: Anything <100ms feels instant to users
- Industry benchmark: Most well-optimized APIs target <50ms p95

---

# SLO 3: Combined Success & Performance

**User Journey:** Users successfully browse and order with fast, reliable responses

**SLI Category:** Composite (Availability + Latency)

**SLI Definition:** The proportion of requests that succeed (2xx/3xx) AND complete within latency threshold (p95 ≤ 20ms)

**Measurement Method:**
- **Good Events:** Successful (2xx/3xx) requests with latency ≤ 20ms
- **Total Events:** All HTTP requests
- **Formula:** `(successful_fast_requests / total_requests) × 100%`

**Rationale:** A slow success is effectively a failure from the user's perspective. Users don't distinguish between "server error" and "painfully slow response" - both result in poor experience and potential abandonment.

**SLO Target:** **99.5% of requests succeed AND complete within 20ms over 30 days**

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window

**Datadog SLO Configuration:**
```yaml
name: "burger-api - Combined Success & Performance (99.5%)"
type: metric
description: "Percentage of successful requests completing within 20ms for burger-api"
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - sli_type:composite
thresholds:
  target: 99.5
  target_display: "99.500"
  timeframe: 30d
  warning: 99.75
query:
  # Note: This requires custom metric or monitor-based approach
  # Datadog metric-based SLOs don't natively support compound conditions
  # Consider using monitor-based SLO with composite monitor
  numerator: "sum:trace.express.request.hits{service:burger-api,env:prod,!http.status_code:5*,!http.status_code:4*,p95_latency:<0.020}.as_count()"
  denominator: "sum:trace.express.request.hits{service:burger-api,env:prod}.as_count()"
```

---

# Error Budget Policy

## Error Budget Calculation

**Monthly Error Budget:**
- **SLO Target:** 99.9%
- **Error Budget:** 0.1%
- **Allowed Downtime:** 43.2 minutes/month
- **Daily Budget:** ~1.4 minutes/day

**Example Scenarios:**
- One 40-minute outage = 93% of monthly budget consumed
- Four 10-minute incidents = 93% of monthly budget consumed
- 10 seconds of downtime per day = full budget over 30 days

## Graduated Response Policy

### 1. Healthy (>50% remaining) ✅
- ✅ Continue normal feature development
- ✅ Deploy during business hours (APAC/US daytime)
- ✅ Accept reasonable technical debt
- ✅ Experiment with new features behind feature flags

### 2. Warning (25-50% remaining) ⚠️
- ⚠️ Increase code review rigor for changes
- ⚠️ Prioritize stability improvements over new features
- ⚠️ Schedule deploys during low-traffic periods (APAC evening)
- ⚠️ Begin investigating recurring issues
- ⚠️ Daily standup review of error budget status

### 3. Critical (<25% remaining) 🚨
- 🚨 **Freeze non-critical deployments**
- 🚨 All hands on deck for reliability improvements
- 🚨 Daily error budget review meetings with leadership
- 🚨 Root cause analysis for ALL incidents (no exceptions)
- 🚨 Implement quick wins to improve reliability
- 🚨 Cancel or postpone feature work

### 4. Exhausted (0% remaining) 🛑
- 🛑 **FULL DEPLOYMENT FREEZE** (except critical hotfixes)
- 🛑 Emergency reliability sprint
- 🛑 Executive escalation and incident review
- 🛑 Mandatory post-mortem with action items
- 🛑 Identify and fix top 3 reliability issues before resuming features

---

# Supporting Monitors

## 1. Error Rate Monitor

**Purpose:** Alert on sudden increases in error rate before SLO breach

**Configuration:**
```yaml
name: "Increased error rate for burger-api in env:prod"
type: query alert
query: "change(avg(last_5m),last_2h):sum:trace.express.request.errors{service:burger-api,env:prod,span.kind:server}.as_rate() > 3"
message: |
  🚨 Error rate has increased for {{service.name}} in {{env.name}}

  Current error rate: {{value}} errors/sec
  Threshold: {{threshold}} errors/sec

  **Impact:** Users may be experiencing failures browsing menu or placing orders

  **Investigation Steps:**
  1. Check APM traces: https://app.datadoghq.com/apm/traces?query=service%3Aburger-api%20status%3Aerror
  2. Check service logs: kubectl logs -n mcp-agent-prod deployment/burger-api --tail=100
  3. Check database health: Monitor PostgreSQL metrics
  4. Check recent deployments: kubectl rollout history deployment/burger-api -n mcp-agent-prod

  **Runbook:** https://github.com/nuttea/mcp-agent-langchainjs-datadog/docs/runbooks/burger-api-errors.md

  @slack-platform-engineering @pagerduty-sre
thresholds:
  critical: 3
  warning: 1
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - alert_type:error_rate
```

## 2. Latency Anomaly Monitor

**Purpose:** Detect unusual latency patterns using machine learning

**Configuration:**
```yaml
name: "Abnormal change in p75 latency for burger-api on env:prod"
type: query alert
query: "avg(last_1h):anomalies(p75:trace.express.request{service:burger-api,env:prod,span.kind:server}, 'agile', 2, direction='above', interval=20, alert_window='last_5m', count_default_zero='true', seasonality='hourly') >= 1"
message: |
  ⚠️ Anomalous latency detected for {{service.name}} in {{env.name}}

  Current p75 latency is abnormally high compared to historical patterns.

  **Typical p75:** ~8-10ms
  **Current p75:** {{value}}ms

  **Potential Causes:**
  - Recent deployment with performance regression
  - Database query performance degradation
  - Downstream service (PostgreSQL) slowness
  - Resource saturation (CPU/Memory)
  - Increased traffic volume

  **Investigation Steps:**
  1. Check APM trace flamegraphs for slow operations
  2. Review database query performance in DBM
  3. Check CPU/Memory usage: kubectl top pods -n mcp-agent-prod
  4. Check PostgreSQL metrics

  @slack-platform-engineering
thresholds:
  critical: 1
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - alert_type:latency_anomaly
```

## 3. Resource Saturation Monitor

**Purpose:** Alert when service approaches resource limits

**Configuration:**
```yaml
name: "High CPU/Memory usage for burger-api"
type: query alert
query: "avg(last_10m):avg:kubernetes.cpu.usage.total{kube_deployment:burger-api,kube_namespace:mcp-agent-prod} by {pod_name} > 80"
message: |
  ⚠️ Resource saturation detected for {{pod_name.name}}

  Current CPU usage: {{value}}%
  Threshold: {{threshold}}%

  **Impact:** This may lead to performance degradation or availability issues.
  High CPU can cause request queueing and increased latency.

  **Investigation Steps:**
  1. Check pod CPU usage: kubectl top pods -n mcp-agent-prod
  2. Check for CPU blocking feature flags (ENABLE_CPU_BLOCKING)
  3. Review recent traffic patterns
  4. Check for memory leaks or inefficient code

  **Mitigation:**
  - Consider horizontal scaling (HPA should auto-scale)
  - Review and optimize CPU-intensive code paths
  - Check for infinite loops or blocking operations

  @slack-platform-engineering
thresholds:
  critical: 80
  warning: 70
tags:
  - service:burger-api
  - team:platform-engineering
  - env:prod
  - alert_type:resource_saturation
```

## 4. Database Connection Pool Monitor

**Purpose:** Alert when database connection pool is exhausted

**Configuration:**
```yaml
name: "burger-api Database Connection Pool Saturation"
type: query alert
query: "avg(last_5m):avg:postgresql.connections.count{service:burger-api-postgres} / avg:postgresql.connections.max_connections{service:burger-api-postgres} * 100 > 80"
message: |
  🚨 Database connection pool is approaching limits

  Current usage: {{value}}%
  Threshold: {{threshold}}%

  **Impact:** New database queries may fail or timeout, causing API errors.

  **Investigation Steps:**
  1. Check for connection leaks in application code
  2. Review slow queries that hold connections longer
  3. Check for connection timeout configuration
  4. Consider increasing pool size if sustained high usage

  @slack-platform-engineering @pagerduty-sre
thresholds:
  critical: 80
  warning: 70
```

## 5. PostgreSQL Query Performance Monitor

**Purpose:** Alert on slow database queries

**Configuration:**
```yaml
name: "Slow database queries for burger-api"
type: query alert
query: "avg(last_15m):avg:postgresql.queries.duration{service:burger-api-postgres} > 0.100"
message: |
  ⚠️ Slow database queries detected for burger-api

  Average query duration: {{value}}s
  Threshold: {{threshold}}s (100ms)

  **Impact:** Slow queries increase API latency and may cause timeouts.

  **Investigation:**
  1. Check DBM for slow query samples
  2. Review query execution plans
  3. Check for missing indexes
  4. Look for table locks or blocking queries

  **DBM Dashboard:** https://app.datadoghq.com/databases

  @slack-platform-engineering
thresholds:
  critical: 0.100
  warning: 0.050
```

---

# Alerting Strategy

## Alert Levels

1. **Informational:** SLO burn rate indicates potential future issues (Slack only)
2. **Warning (Ticket):** 75% of error budget consumed OR slow burn detected (Slack + Jira)
3. **Critical (Page):** 90% of error budget consumed OR fast burn detected (PagerDuty)
4. **Emergency:** SLO breach occurred OR error budget exhausted (PagerDuty + Executive escalation)

## Notification Channels

- **Slack:** `@slack-platform-engineering` for warnings and critical alerts
- **PagerDuty:** Critical and emergency alerts only
  - Business hours (9am-6pm APAC): Platform team channel
  - Off-hours: On-call SRE rotation
- **Email:** platform-engineering@company.com for all alerts
- **Incident Management:** Auto-create incident ticket for emergency alerts (Jira)

## Burn Rate Windows

**Fast Burn Detection (Page):**
- Long window: 1 hour
- Short window: 5 minutes
- Multiplier: 14.4x
- Detection: Severe incidents that exhaust budget in ~2 days
- Example: At 99.9% SLO, this detects when error rate >1.44% for 1 hour

**Slow Burn Detection (Ticket):**
- Long window: 3 days
- Short window: 6 hours
- Multiplier: 1x
- Detection: Gradual degradation over time
- Example: At 99.9% SLO, this detects when error rate >0.1% sustained over 3 days

## On-Call Rotation

**Primary On-Call:** SRE Team (24/7 PagerDuty rotation)
**Secondary On-Call:** Platform Engineering Team (business hours)
**Escalation:** Engineering Manager → VP Engineering (for P0 incidents)

**Handoff:** Daily at 9am APAC (Singapore/Bangkok timezone)

---

# SLO Review Process

## Weekly Review (Every Monday 10am APAC)
- Check error budget consumption across all SLOs
- Review incidents from past week impacting SLO compliance
- Identify trends in SLI metrics (improving/degrading)
- Update team on reliability status in standup
- Review upcoming deployments and assess risk

## Monthly Review (First Monday of month)
- Evaluate if SLO targets remain appropriate based on business needs
- Review effectiveness of alerting strategy (false positives/negatives)
- Update thresholds based on actual performance trends
- Document any SLO adjustments with business rationale
- Review error budget policy effectiveness
- Assess correlation with user-reported issues

## Quarterly Review (Q1: Jan, Q2: Apr, Q3: Jul, Q4: Oct)
- Deep dive into SLI metric accuracy and relevance
- Assess correlation with user satisfaction metrics (NPS, CSAT)
- Consider adding new SLIs/SLOs based on user feedback
- Align SLOs with evolving business objectives
- Review and update this specification document
- Present SLO performance to leadership
- Evaluate investment in reliability vs feature velocity

---

# Post-Mortem Process

_Required for any incident that consumes >25% of error budget or causes SLO breach_

## Post-Mortem Template

### 1. Header & Status
- **Incident ID:** INC-YYYY-NNNN
- **Date:** YYYY-MM-DD
- **Duration:** X hours Y minutes
- **Severity:** P0 (Critical) / P1 (High) / P2 (Medium)
- **Status:** Draft / Review / Published
- **Author:** On-call engineer name
- **Reviewers:** SRE team, Engineering Manager

### 2. Summary (Executive Summary)
_1-2 paragraph overview of what happened, impact, and resolution_

Example: "On 2025-11-06 at 14:30 UTC, the burger-api service experienced a 15-minute outage affecting all burger ordering functionality. The root cause was a database connection pool exhaustion triggered by a slow query introduced in deploy v1.2.3. Service was restored by rolling back the deployment. Total error budget consumed: 35%."

### 3. Impact Assessment
- **Users Affected:** [Number/Percentage] - e.g., "100% of users for 15 minutes"
- **Error Budget Consumed:** [Percentage] - e.g., "35% of monthly budget"
- **Revenue Impact:** [If applicable] - e.g., "$X in lost orders"
- **SLO Breach:** [Yes/No, which SLOs] - e.g., "Yes, Availability SLO breached (99.2%)"

### 4. Root Cause Analysis (5 Whys)
1. **What happened?** - e.g., "burger-api returned 500 errors for all requests"
2. **Why did it happen?** - e.g., "Database connection pool was exhausted"
3. **Why wasn't it prevented?** - e.g., "New query in v1.2.3 held connections for 30+ seconds"
4. **Why wasn't it detected sooner?** - e.g., "No alerting on connection pool saturation"
5. **Why wasn't the impact contained?** - e.g., "No connection timeout configured, cascading failures"

### 5. Detection & Response Timeline
| Time | Event | Actor |
|------|-------|-------|
| 14:30 | Deploy v1.2.3 completed | CI/CD Pipeline |
| 14:32 | First slow queries detected | PostgreSQL |
| 14:35 | Connection pool exhausted | burger-api |
| 14:36 | Users report errors | Customer Support |
| 14:37 | PagerDuty alert fired | Datadog Monitor |
| 14:38 | On-call engineer paged | PagerDuty |
| 14:40 | Incident confirmed | SRE (John) |
| 14:42 | Rollback initiated | SRE (John) |
| 14:45 | Service restored | System |
| 14:50 | Root cause identified | SRE Team |

### 6. What Went Well
- PagerDuty alert fired within 2 minutes of issue
- Rollback process was smooth and well-documented
- Team communicated effectively in incident Slack channel
- No data loss or corruption occurred

### 7. What Went Wrong
- Slow query not caught in code review or testing
- No database connection pool monitoring
- No staging environment testing for this change
- Missing connection timeout configuration

### 8. Where We Got Lucky
- Incident occurred during low-traffic period (2:30am user timezone)
- Database remained healthy, no corruption
- Rollback was possible (no schema migrations)
- Customer support team was online to respond quickly

### 9. Action Items
| Action | Owner | Due Date | Priority | Status |
|--------|-------|----------|----------|--------|
| Add connection pool saturation monitor | SRE (Sarah) | 2025-11-10 | P0 | In Progress |
| Implement connection timeout (30s) | Dev (Mike) | 2025-11-08 | P0 | Open |
| Add query performance testing to CI | QA (Lisa) | 2025-11-15 | P1 | Open |
| Enable slow query logging | DBA (Tom) | 2025-11-09 | P1 | Open |
| Create staging environment | DevOps (Alex) | 2025-12-01 | P2 | Open |

### 10. Lessons Learned
- Database connection management is critical for API reliability
- Monitoring should cover all resource constraints (CPU, memory, connections, etc.)
- Load testing should include database query patterns
- Code reviews should include performance considerations
- Staging environment is essential for catching these issues early

## Blameless Culture

> **"Focus on systems, not people. Blame the design, not the engineer."**

- Incidents are opportunities to learn and improve systems
- Human error is a symptom of systemic issues (poor tooling, inadequate testing, missing safeguards)
- Psychological safety enables honest discussion and learning
- Share learnings widely across teams to prevent recurrence
- Reward people for surfacing issues, not for hiding them

**Example Blameless Questions:**
- ❌ "Why didn't you test this before deploying?"
- ✅ "What testing gaps exist that allowed this to reach production?"

- ❌ "You should have known that would cause an outage"
- ✅ "How can we make the impact of changes more visible?"

---

# Open Questions

_Tracking unresolved questions about burger-api SLIs/SLOs:_

1. Should we add a separate SLO for the order placement endpoint (`POST /api/orders`) given its business criticality?
2. Do we need SLOs for the image serving endpoint (`GET /api/images/*`) or is it acceptable for images to occasionally fail?
3. Should we differentiate SLOs between read operations (GET) and write operations (POST/DELETE)?
4. What is the appropriate SLO for the database read replica (if implemented)?
5. Should we have dev environment SLOs, or only prod?

---

# Appendix

## Related Resources

- **Service Architecture:** [CLAUDE.md](../../CLAUDE.md)
- **Runbook:** [burger-api Incident Response](../runbooks/burger-api.md) _(to be created)_
- **Datadog Dashboard:** [burger-api Overview](https://app.datadoghq.com/dashboard/burger-api-prod)
- **APM Service Page:** `https://app.datadoghq.com/apm/service/burger-api`
- **SLO Dashboard:** `https://app.datadoghq.com/slo?query=service%3Aburger-api`
- **Team Contact:** #platform-engineering (Slack)
- **Repository:** https://github.com/nuttea/mcp-agent-langchainjs-datadog
- **Source Code:** [packages/burger-api/](../../packages/burger-api/)

## Reference Documentation

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Google SRE Workbook](https://sre.google/workbook/table-of-contents/)
- [Datadog SLO Documentation](https://docs.datadoghq.com/service_management/service_level_objectives/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Datadog DBM Documentation](https://docs.datadoghq.com/database_monitoring/)
- [Availability Calculator](https://uptime.is/)

## SLO Target Reference Table

| SLO Target | Error Budget | Monthly Downtime | Daily Downtime |
|------------|--------------|------------------|----------------|
| 90% | 10% | 72 hours | 2.4 hours |
| 95% | 5% | 36 hours | 1.2 hours |
| 99% | 1% | 7.2 hours | 14.4 minutes |
| 99.5% | 0.5% | 3.6 hours | 7.2 minutes |
| **99.9%** | **0.1%** | **43.2 minutes** | **1.4 minutes** ← burger-api target |
| 99.95% | 0.05% | 21.6 minutes | 43 seconds |
| 99.99% | 0.01% | 4.3 minutes | 8.6 seconds |

## API Endpoints and Critical Paths

| Endpoint | Method | Purpose | Criticality | Current p95 |
|----------|--------|---------|-------------|-------------|
| `/` | GET | Health check (GKE) | HIGH | ~7ms |
| `/api` | GET | Health check with stats | MEDIUM | ~7ms |
| `/api/burgers` | GET | List burgers (menu) | **CRITICAL** | ~10ms |
| `/api/burgers/:id` | GET | Burger details | HIGH | ~10ms |
| `/api/toppings` | GET | List toppings | HIGH | ~10ms |
| `/api/toppings/:id` | GET | Topping details | MEDIUM | ~10ms |
| `/api/toppings/categories` | GET | List categories | MEDIUM | ~8ms |
| `/api/orders` | GET | List orders (filtered) | HIGH | ~12ms |
| `/api/orders/:orderId` | GET | Order details | HIGH | ~11ms |
| `/api/orders` | POST | **Create order** | **CRITICAL** | ~15ms |
| `/api/orders/:id` | DELETE | Cancel order | HIGH | ~12ms |
| `/api/images/*` | GET | Serve images | MEDIUM | ~9ms |
| `/api/openapi` | GET | API spec | LOW | ~8ms |

**Critical Path Analysis:**
1. **Order Placement Flow:** `GET /api/burgers` → `GET /api/toppings` → `POST /api/orders`
2. **Menu Browsing Flow:** `GET /api/burgers` → `GET /api/burgers/:id` → `GET /api/images/*`
3. **Order Tracking Flow:** `GET /api/orders` → `GET /api/orders/:orderId`

## Change Log

| Date | Author | Changes | Version |
|------|--------|---------|---------|
| 2025-11-06 | Platform Engineering | Initial draft based on 7-day performance baseline | v0.1 |
| 2025-11-06 | Platform Engineering | Added 5 supporting monitors and detailed runbook links | v0.2 |
| - | - | Review and acceptance pending | - |

---

## Implementation Checklist

- [ ] Create SLOs in Datadog using provided YAML configurations
- [ ] Create supporting monitors (5 monitors)
- [ ] Set up PagerDuty integration and escalation policies
- [ ] Configure Slack notifications to #platform-engineering
- [ ] Create Jira integration for ticket creation
- [ ] Document runbooks for common incident scenarios
- [ ] Set up weekly SLO review meeting
- [ ] Train team on error budget policy
- [ ] Create Datadog dashboard with SLO widgets
- [ ] Test alerting channels (send test alerts)
- [ ] Review and approve with stakeholders
- [ ] Publish to team wiki/confluence

## Notes

- All Datadog queries validated in Metrics Explorer on 2025-11-06
- SLO targets based on 7-day performance baseline (2025-10-30 to 2025-11-06)
- Current performance (99.99% availability, 10-14ms p95) provides comfortable headroom
- Error budget shared across all SLOs for the service
- 30-day rolling window chosen for production (stable service)
- Review quarterly or after major incidents/architecture changes
- Ensure alignment between SLO targets and user experience expectations
- Consider adding canary deployment SLOs in future

---

**Template Version:** 1.0 (burger-api Production)
**Last Updated:** 2025-11-06 10:00 UTC
**Maintained By:** Platform Engineering / SRE Team
**Status:** Draft - Pending Review
