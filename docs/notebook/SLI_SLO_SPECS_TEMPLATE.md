---
title: 'SLI and SLO Specification: [Service Name] - Template'
author: [Your Name]
modified: [Auto-generated timestamp]
tags: [slo, sli, observability, sre]
metadata: {}
time:
  live_span: 30d
template_variables: []
---

| **Property** | **Details** |
|-|-|
| **Status** | **Draft / Review / Accepted / Closed** |
| **Author** | [Team Member Name] |
| **Team** | [Team/Squad Name] |
| **Last updated** | hh:mm UTC MM/dd/yyyy |
| **Reviewers** | [Names of reviewers] |
| **Service** | [service-name] |
| **Environment** | [dev/staging/prod] |

# Service Description

_Provide information on the service you're creating SLOs for:_

- **Purpose:** What does this service do?
- **User Journey:** Which critical user journeys does it support?
- **Dependencies:** What are its upstream and downstream dependencies?
- **Criticality:** How critical is this service to the business?
- **Service Type:** Request/Response | Data Processing | Storage

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

# SLO 1: [Name - e.g., Availability]

**User Journey:** _Users are able to successfully [complete action]_

**SLI Category:** _Availability_

**SLI Definition:** _The proportion of successful requests, measured from the user's perspective_

**Measurement Method:**
- **Good Events:** HTTP requests returning 2xx or 3xx status codes
- **Total Events:** All HTTP requests received by the service
- **Formula:** `(successful_requests / total_requests) × 100%`

**Datadog Query:**
```
Numerator (Good): sum:trace.express.request.hits{service:[service-name],env:[environment],!http.status_code:5*,!http.status_code:4*}.as_count()
Denominator (Total): sum:trace.express.request.hits{service:[service-name],env:[environment]}.as_count()
```

**SLO Target:** _99.9% over 30 days_

**Rationale:** _Why this target? Based on user expectations and operational feasibility_

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window
  * _This catches fast, severe incidents that will exhaust error budget in ~2 days_

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window
  * _This catches slow burns that will exhaust error budget over the month_

**Datadog SLO Configuration:**
```yaml
name: "[Service Name] - Availability (99.9%)"
type: metric
description: "Percentage of successful requests for [service-name]"
tags:
  - service:[service-name]
  - team:[team-name]
  - env:[environment]
  - sli_type:availability
thresholds:
  target: 99.9
  target_display: "99.900"
  timeframe: 30d
  warning: 99.95
query:
  numerator: "sum:trace.express.request.hits{service:[service-name],env:[environment],!http.status_code:5*,!http.status_code:4*}.as_count()"
  denominator: "sum:trace.express.request.hits{service:[service-name],env:[environment]}.as_count()"
```

---

# SLO 2: [Name - e.g., Latency]

**User Journey:** _Users receive responses quickly when [performing action]_

**SLI Category:** _Latency_

**SLI Definition:** _The proportion of requests completing within target latency threshold_

**Measurement Method:**
- **Good Events:** Requests with p95 latency ≤ [X]ms
- **Total Events:** All HTTP requests
- **Formula:** `(requests_within_threshold / total_requests) × 100%`

**Datadog Query:**
```
P95 Latency: p95:trace.express.request{service:[service-name],env:[environment],span.kind:server}
P99 Latency: p99:trace.express.request{service:[service-name],env:[environment],span.kind:server}
```

**Latency Thresholds:**
- **Fast (p50):** ≤ [Y]ms
- **Acceptable (p95):** ≤ [X]ms
- **Slow (p99):** ≤ [Z]ms

**SLO Target:** _99% of requests complete within [X]ms over 30 days_

**Rationale:** _Why this threshold? Based on user experience research and performance testing_

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window

**Alternative: Monitor-based SLO**
```yaml
name: "[Service Name] - Latency Monitor-based"
type: monitor
description: "Time-based availability using latency monitor"
tags:
  - service:[service-name]
  - team:[team-name]
  - env:[environment]
  - sli_type:latency
thresholds:
  target: 99.0
  timeframe: 30d
  warning: 99.5
monitor_ids:
  - [monitor-id-for-p95-latency]
```

---

# SLO 3: [Name - e.g., Combined Success & Performance]

**User Journey:** _Users successfully complete [action] with acceptable performance_

**SLI Category:** _Composite (Availability + Latency)_

**SLI Definition:** _The proportion of requests that succeed AND complete within latency threshold_

**Measurement Method:**
- **Good Events:** Successful (2xx/3xx) requests with latency ≤ [X]ms
- **Total Events:** All HTTP requests
- **Formula:** `(successful_fast_requests / total_requests) × 100%`

**Rationale:** _A slow success is effectively a failure from the user's perspective_

**SLO Target:** _99.5% of requests succeed AND complete within [X]ms over 30 days_

**Alert Policy:**

* **Page (Critical):** Burn rate exceeds 14.4x over a 1 hour long window AND 5 min short window

* **Ticket (Warning):** Burn rate exceeds 1x over a 3 day long window AND 6 hour short window

**Datadog SLO Configuration:**
```yaml
name: "[Service Name] - Combined Success & Performance (99.5%)"
type: metric
description: "Percentage of successful requests completing within [X]ms"
tags:
  - service:[service-name]
  - team:[team-name]
  - env:[environment]
  - sli_type:composite
thresholds:
  target: 99.5
  target_display: "99.500"
  timeframe: 30d
  warning: 99.75
query:
  numerator: "sum:trace.express.request.hits{service:[service-name],env:[environment],!http.status_code:5*,!http.status_code:4*,p95_latency:<[X]}.as_count()"
  denominator: "sum:trace.express.request.hits{service:[service-name],env:[environment]}.as_count()"
```

---

# Additional SLI Types (Optional)

_Select additional SLIs based on your service type:_

## For Data Processing Services

### Coverage SLI
**Definition:** Proportion of input data successfully processed
**Formula:** `(processed_records / total_input_records) × 100%`

### Freshness SLI
**Definition:** Proportion of data processed within target time window
**Formula:** `(records_processed_on_time / total_records) × 100%`

## For Storage Services

### Durability SLI
**Definition:** Proportion of stored data that remains intact and retrievable
**Formula:** `(successfully_retrieved_objects / total_retrieval_attempts) × 100%`

### Throughput SLI
**Definition:** Operations per second within capacity target
**Formula:** `(actual_ops_per_second / target_ops_per_second) × 100%`

---

# Error Budget Policy

## Error Budget Calculation

**Monthly Error Budget:**
- **SLO Target:** [X]%
- **Error Budget:** [100-X]%
- **Allowed Downtime:** [calculated minutes/month]

Example for 99.9% SLO:
- Error Budget: 0.1%
- Monthly Downtime: 43.2 minutes
- Daily Budget: ~1.4 minutes

## Graduated Response Policy

### 1. Healthy (>50% remaining) ✅
- ✅ Continue normal feature development
- ✅ Deploy during business hours
- ✅ Accept reasonable technical debt

### 2. Warning (25-50% remaining) ⚠️
- ⚠️ Increase review rigor for changes
- ⚠️ Prioritize stability over new features
- ⚠️ Schedule deploys during low-traffic periods
- ⚠️ Begin investigating recurring issues

### 3. Critical (<25% remaining) 🚨
- 🚨 **Freeze non-critical deployments**
- 🚨 All hands on deck for reliability improvements
- 🚨 Daily error budget review meetings
- 🚨 Root cause analysis for ALL incidents
- 🚨 Implement quick wins to improve reliability

### 4. Exhausted (0% remaining) 🛑
- 🛑 **FULL DEPLOYMENT FREEZE** (except hotfixes)
- 🛑 Emergency reliability sprint
- 🛑 Executive escalation
- 🛑 Post-mortem required with action items

---

# Supporting Monitors

_These monitors provide early warning before SLO breach:_

## 1. Error Rate Monitor

**Purpose:** Alert on sudden increases in error rate

**Configuration:**
```yaml
name: "Increased error rate for [service-name] in env:[environment]"
type: query alert
query: "change(avg(last_5m),last_2h):sum:trace.express.request.errors{service:[service-name],env:[environment],span.kind:server}.as_rate() > 3"
message: |
  Error rate has increased for {{service.name}} in {{env.name}}

  Current error rate: {{value}}
  Threshold: {{threshold}}

  Check the service logs and APM traces for root cause.
  @slack-[team-channel]
thresholds:
  critical: 3
  warning: 1
tags:
  - service:[service-name]
  - team:[team-name]
  - env:[environment]
  - alert_type:error_rate
```

## 2. Latency Anomaly Monitor

**Purpose:** Detect unusual latency patterns using ML

**Configuration:**
```yaml
name: "Abnormal change in p75 latency for [service-name] on env:[environment]"
type: query alert
query: "avg(last_1h):anomalies(p75:trace.express.request{service:[service-name],env:[environment],span.kind:server}, 'agile', 2, direction='above', interval=20, alert_window='last_5m', count_default_zero='true', seasonality='hourly') >= 1"
message: |
  Anomalous latency detected for {{service.name}} in {{env.name}}

  Current p75 latency is abnormally high compared to historical patterns.

  Investigate:
  - Recent deployments
  - Database performance
  - Downstream service health
  @slack-[team-channel]
thresholds:
  critical: 1
tags:
  - service:[service-name]
  - team:[team-name]
  - env:[environment]
  - alert_type:latency_anomaly
```

## 3. Resource Saturation Monitor

**Purpose:** Alert when service approaches resource limits

**Configuration:**
```yaml
name: "High CPU/Memory usage for [service-name]"
type: query alert
query: "avg(last_10m):avg:system.cpu.user{service:[service-name]} > 80"
message: |
  Resource saturation detected for {{service.name}}

  This may lead to performance degradation or availability issues.
  @slack-[team-channel]
thresholds:
  critical: 80
  warning: 70
```

---

# Alerting Strategy

## Alert Levels

1. **Informational:** SLO burn rate indicates potential future issues
2. **Warning (Ticket):** 75% of error budget consumed OR slow burn detected
3. **Critical (Page):** 90% of error budget consumed OR fast burn detected
4. **Emergency:** SLO breach occurred OR error budget exhausted

## Notification Channels

- **Slack:** `@slack-[team-channel]` for warnings and critical alerts
- **PagerDuty:** Critical and emergency alerts only (during business hours: team channel, off-hours: on-call)
- **Email:** Team distribution list for all alerts
- **Incident Management:** Auto-create incident for emergency alerts

## Burn Rate Windows

**Fast Burn Detection (Page):**
- Long window: 1 hour
- Short window: 5 minutes
- Multiplier: 14.4x
- Detection: Severe incidents that exhaust budget in ~2 days

**Slow Burn Detection (Ticket):**
- Long window: 3 days
- Short window: 6 hours
- Multiplier: 1x
- Detection: Gradual degradation over time

---

# SLO Review Process

## Weekly Review
- Check error budget consumption across all SLOs
- Review recent incidents impacting SLO compliance
- Identify trends in SLI metrics (improving/degrading)
- Update team on reliability status

## Monthly Review
- Evaluate if SLO targets remain appropriate
- Review effectiveness of alerting strategy (false positives/negatives)
- Update thresholds based on actual performance
- Document any SLO adjustments with rationale
- Review error budget policy effectiveness

## Quarterly Review
- Deep dive into SLI metric accuracy and relevance
- Assess correlation with user satisfaction metrics
- Consider adding new SLIs/SLOs based on user feedback
- Align SLOs with evolving business objectives
- Review and update this specification document

---

# Post-Mortem Process

_Required for any incident that consumes >25% of error budget or causes SLO breach_

## Post-Mortem Template

### 1. Header & Status
- **Incident ID:** [ID]
- **Date:** [Date]
- **Duration:** [Duration]
- **Severity:** [P0/P1/P2/P3]
- **Status:** [Draft/Review/Published]
- **Author:** [Name]
- **Reviewers:** [Names]

### 2. Summary (Executive Summary)
_1-2 paragraph overview of what happened, impact, and resolution_

### 3. Impact Assessment
- **Users Affected:** [Number/Percentage]
- **Error Budget Consumed:** [Percentage]
- **Revenue Impact:** [If applicable]
- **SLO Breach:** [Yes/No, which SLOs]

### 4. Root Cause Analysis (5 Whys)
1. **What happened?**
2. **Why did it happen?**
3. **Why wasn't it prevented?**
4. **Why wasn't it detected sooner?**
5. **Why wasn't the impact contained?**

### 5. Detection & Response Timeline
| Time | Event | Actor |
|------|-------|-------|
| [HH:MM] | Issue began | System |
| [HH:MM] | First symptom detected | Monitor/User |
| [HH:MM] | Alert fired | Datadog |
| [HH:MM] | Team paged | PagerDuty |
| [HH:MM] | Incident confirmed | Engineer |
| [HH:MM] | Mitigation started | Team |
| [HH:MM] | Service restored | Team |
| [HH:MM] | Root cause identified | Team |

### 6. What Went Well
- _Things that worked as expected during the incident_

### 7. What Went Wrong
- _Things that failed or didn't work as expected_

### 8. Where We Got Lucky
- _Things that could have gone worse_

### 9. Action Items
| Action | Owner | Due Date | Priority | Status |
|--------|-------|----------|----------|--------|
| [Action] | [Name] | [Date] | [P0/P1/P2] | [Open/In Progress/Done] |

### 10. Lessons Learned
- _Key takeaways for future incident prevention and response_

## Blameless Culture

> **"Focus on systems, not people. Blame the design, not the engineer."**

- Incidents are opportunities to learn and improve
- Human error is a symptom of systemic issues
- Psychological safety enables honest discussion
- Share learnings widely to prevent recurrence

---

# Open Questions

_Note relevant questions and uncertainties here:_

- [Question 1]
- [Question 2]
- [Question 3]

---

# Appendix

## Related Resources

- **Service Architecture:** [Link to architecture doc]
- **Runbook:** [Link to incident response runbook]
- **Datadog Dashboard:** [Link to service dashboard]
- **APM Service Page:** `https://app.datadoghq.com/apm/service/[service-name]`
- **SLO Dashboard:** `https://app.datadoghq.com/slo`
- **Team Contact:** [Slack channel / Email]

## Reference Documentation

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Google SRE Workbook](https://sre.google/workbook/table-of-contents/)
- [Datadog SLO Documentation](https://docs.datadoghq.com/service_management/service_level_objectives/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Availability Calculator](https://uptime.is/)

## SLO Target Reference Table

| SLO Target | Error Budget | Monthly Downtime | Daily Downtime |
|------------|--------------|------------------|----------------|
| 90% | 10% | 72 hours | 2.4 hours |
| 95% | 5% | 36 hours | 1.2 hours |
| 99% | 1% | 7.2 hours | 14.4 minutes |
| 99.5% | 0.5% | 3.6 hours | 7.2 minutes |
| 99.9% | 0.1% | 43.2 minutes | 1.4 minutes |
| 99.95% | 0.05% | 21.6 minutes | 43 seconds |
| 99.99% | 0.01% | 4.3 minutes | 8.6 seconds |

## Change Log

| Date | Author | Changes | Version |
|------|--------|---------|---------|
| [YYYY-MM-DD] | [Name] | Initial draft | v0.1 |
| [YYYY-MM-DD] | [Name] | Review feedback incorporated | v0.2 |
| [YYYY-MM-DD] | [Name] | Accepted and published | v1.0 |

---

## Notes

- All Datadog queries should be validated in Metrics Explorer before implementation
- SLO targets should be realistic and based on historical performance (start with achievable targets)
- Error budgets are shared across all SLOs for the service
- Always tag SLOs with `service`, `team`, `env`, and `sli_type` for easy filtering
- Use 30-day rolling windows for production SLOs (7-day for experimental services)
- Review and update this specification quarterly or after major incidents
- Ensure alignment between SLO targets and business requirements

---

**Template Version:** 2.0 (Datadog Notebook Format)
**Last Updated:** 2025-11-06
**Maintained By:** Platform Engineering / SRE Team
