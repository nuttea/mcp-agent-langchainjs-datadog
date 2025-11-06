# SLI & SLO Specification Template

## Service: {Service Name}

**Owner:** {Team/Squad Name}
**Environment:** {dev/prod}
**Last Updated:** {YYYY-MM-DD}
**Status:** {Draft/Active/Under Review}

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [SRE Fundamentals](#sre-fundamentals)
3. [Service Level Indicators (SLIs)](#service-level-indicators-slis)
4. [Service Level Objectives (SLOs)](#service-level-objectives-slos)
5. [Service Level Agreements (SLAs)](#service-level-agreements-slas)
6. [Error Budget](#error-budget)
7. [Supporting Monitors](#supporting-monitors)
8. [Alerting Strategy](#alerting-strategy)
9. [SLO Review Process](#slo-review-process)
10. [Post-Mortem Process](#post-mortem-process)

---

## Service Overview

**Description:** {Brief description of what this service does and its role in the system}

**Service Type:** {Request/Response | Data Processing | Storage}

**Dependencies:**
- {Upstream service 1}
- {Upstream service 2}
- {Database/External service}

**User Journey Impact:** {Describe which user journeys this service supports}

**Critical User Flows:**
- {Flow 1: e.g., User profile loading}
- {Flow 2: e.g., Order placement}
- {Flow 3: e.g., Payment processing}

---

## SRE Fundamentals

### What is SRE?

**Site Reliability Engineering (SRE)** implements DevSecOps practices with strong engineering capabilities:
- Focuses on reliability as a primary feature
- Balances reliability with feature velocity
- Automates operational tasks (spend <50% time on ops)
- Uses error budgets to drive decision-making

### Key SRE Principles

1. **Reliability is the most important feature** - Without reliability, no other features matter
2. **100% is the wrong reliability target** - Perfect reliability is impossible and expensive
3. **Error budgets enable innovation** - Unreliability budget can be "spent" on launches
4. **Blameless post-mortems drive learning** - Focus on systems, not people

### Service Levels Hierarchy

```
SLI (Indicator) → Measurement of service behavior
    ↓
SLO (Objective) → Target for SLI (internal goal)
    ↓
SLA (Agreement) → Business contract (customer-facing)
```

**Example:**
- **SLI:** Latency of successful HTTP 200 responses
- **SLO:** 95% of requests < 200ms in previous 28d
- **SLA:** Customer compensated if 95th percentile > 300ms

---

## Service Level Indicators (SLIs)

> **SLI Definition:** A quantifiable measure of service reliability expressed as the ratio:
> **SLI = (good events / valid events) × 100%**

### Choosing SLIs: The User Perspective

Ask these questions to identify the right SLIs:
- **"What does the user experience?"** - Measure what users see, not internal metrics
- **"When would users complain?"** - Identify pain thresholds
- **"Where is this measured?"** - Prefer client-side or edge measurements

### SLI Categories by Service Type

| Service Type | SLI Types | Examples |
|--------------|-----------|----------|
| **Request/Response** | Availability, Latency, Quality | HTTP success rate, p95 latency, degraded responses |
| **Data Processing** | Coverage, Correctness, Freshness, Throughput | % records processed, accuracy, data age, records/min |
| **Storage** | Throughput, Latency, Durability | operations/sec, read/write latency, data integrity |

---

### 1. Availability SLI

**Definition:** Percentage of valid requests served successfully

**The User Question:** "When I click, does the feature actually work, or do I get an error?"

**Measurement Specification:**

**What is "success"?**
- HTTP requests with 2XX, 3XX, or 4XX status codes (excluding 429 Too Many Requests)
- Responses that return expected data structure
- Requests that complete without server errors

**Where is success/failure recorded?**
- Measured at: Load balancer / API Gateway (closest to user)
- Why: Captures the actual user experience including network issues

**Formula:**
```
Availability SLI = (successful_requests / total_requests) × 100%

Where:
- successful_requests = HTTP 2XX + 3XX + 4XX (excl. 429)
- total_requests = all HTTP requests received
```

**Datadog Metrics:**
```
Good Requests (Numerator):
  sum:trace.express.request.hits{
    service:{service-name},
    env:{environment},
    !http.status_code:5*,
    !http.status_code:429
  }.as_count()

Total Requests (Denominator):
  sum:trace.express.request.hits{
    service:{service-name},
    env:{environment}
  }.as_count()
```

**Exclusions (What NOT to count):**
- Health check requests (filter by `http.url_details.path:!/health`)
- Internal monitoring requests
- Load test traffic (filter by user agent)

**Why This Matters:** Users expect the service to respond successfully. High error rates directly impact user experience, trust, and business metrics (conversion, retention).

---

### 2. Latency SLI

**Definition:** Percentage of valid requests served faster than a threshold

**The User Question:** "How fast does the feature feel? Is it instant (happy) or slow (frustrated)?"

**Measurement Specification:**

**What is "quickly"?**
- Threshold based on user expectations (typically 100-500ms for interactive services)
- Consider different thresholds for different endpoints
- Measure complete request cycle (request sent → response fully received)

**When does the timer start/stop?**
- Start: When request arrives at load balancer
- Stop: When entire response is sent from load balancer
- Why: Matches actual user-perceived latency

**Formula:**
```
Latency SLI = (requests_within_threshold / total_requests) × 100%

Where:
- requests_within_threshold = requests with latency ≤ X ms
- total_requests = all valid HTTP requests
```

**Datadog Metrics:**
```
Fast Requests (Numerator):
  sum:trace.express.request.hits{
    service:{service-name},
    env:{environment},
    http.status_code:2*,
    duration:≤{threshold_ms}
  }.as_count()

Total Successful Requests (Denominator):
  sum:trace.express.request.hits{
    service:{service-name},
    env:{environment},
    http.status_code:2*
  }.as_count()

Percentile Tracking:
  p50:trace.express.request{service:{service-name},env:{environment},span.kind:server}
  p95:trace.express.request{service:{service-name},env:{environment},span.kind:server}
  p99:trace.express.request{service:{service-name},env:{environment},span.kind:server}
```

**Latency Thresholds:**
- **Fast (p50):** ≤ {Y}ms - Half of users experience this speed
- **Acceptable (p95):** ≤ {X}ms - SLO target (95% of users)
- **Slow (p99):** ≤ {Z}ms - Worst-case acceptable latency

**Why This Matters:** Response time directly affects user satisfaction, conversion rates, and perceived quality. Slow responses lead to abandonment and poor reviews.

**User Perception Guidelines:**
- **< 100ms:** Instant, feels responsive
- **100-300ms:** Slight delay, still acceptable
- **300-1000ms:** Noticeable lag, requires feedback
- **> 1000ms:** Slow, user may retry or abandon

---

### 3. Quality SLI (Optional)

**Definition:** Percentage of requests that return complete, non-degraded responses

**The User Question:** "One part broke. Did the feature still load in a 'good enough' way, or did it crash entirely?"

**Measurement:**
- **Good Events:** Successful responses with all critical components loaded
- **Degraded Events:** Partial failures (e.g., profile page loads but "Friends List" is missing)
- **Failed Events:** Complete failures (5XX errors)

**Formula:**
```
Quality SLI = (complete_responses / (complete_responses + degraded_responses + failed_responses)) × 100%
```

**Implementation Approach:**
- Add custom response headers: `X-Response-Quality: complete|degraded|failed`
- Track in application code based on component availability
- Monitor critical dependencies separately

**Why This Matters:** Graceful degradation improves user experience during partial outages. Not all failures are equal from a user perspective.

---

### 4. Data Processing SLIs (For Batch/Pipeline Services)

#### Coverage SLI
**Question:** "Did our pipeline process all the data it was supposed to?"

**Formula:**
```
Coverage SLI = (records_processed / records_received) × 100%
```

**Example:** Leaderboard job processing all new game scores

#### Correctness SLI
**Question:** "Is the math right? Is the final data accurate?"

**Formula:**
```
Correctness SLI = (correct_calculations / total_calculations) × 100%
```

**Example:** Leaderboard showing the correct #1 player

#### Freshness SLI
**Question:** "How new is the data? Is it from right now, or from yesterday?"

**Formula:**
```
Freshness SLI = (data_updates_within_SLO_time / total_updates) × 100%
```

**Example:** Leaderboard showing scores within 30 minutes of match end

#### Throughput SLI
**Question:** "How fast is the pipeline working? Can it keep up with demand?"

**Formula:**
```
Throughput SLI = (actual_processing_rate / required_processing_rate) × 100%
```

**Example:** Processing at least 1,000 scores per minute

---

### 5. Storage SLIs (For Database/Persistence Services)

#### Storage Throughput SLI
**Question:** "How many players can save data at the same time without it crashing?"

**Formula:**
```
Storage Throughput SLI = (concurrent_operations_supported / concurrent_operations_required) × 100%
```

**Example:** Database supporting 20,000 concurrent save operations

#### Storage Latency SLI
**Question:** "How fast is data saved? Is it instant?"

**Formula:**
```
Storage Latency SLI = (write_operations_under_threshold / total_write_operations) × 100%
```

**Example:** 99.5% of saves confirmed in < 250ms

---

## Service Level Objectives (SLOs)

> **SLO Definition:** A target value or range for an SLI measured over a specific time window.
> **Format:** "{X}% of {SLI} over {time window}"

### SLO Design Principles

1. **User-centric targets** - Based on what users need, not what system can do
2. **Achievable but challenging** - Realistic given current architecture
3. **Business-aligned** - Support product goals and user satisfaction
4. **Measurable** - Clear, unambiguous metrics
5. **Fewer is better** - Focus on 2-3 critical SLOs per service

### Choosing SLO Targets

**Starting Point Method:**
1. Look at historical performance (past 28 days)
2. Take the "worst good" performance (e.g., 99.5th percentile)
3. Set initial target slightly better than historical
4. Iterate based on user feedback and error budget consumption

**Example:**
- Historical availability: 99.7%
- Initial SLO target: 99.9%
- Aspirational target: 99.95%

### Time Windows

| Window | Use Case | Error Budget per Window |
|--------|----------|-------------------------|
| **7 days** | New services, experiments | More frequent feedback |
| **28 days** | Standard production (recommended) | Monthly planning cycles |
| **90 days** | Mature, stable services | Quarterly planning |

---

### SLO 1: Availability

**Target:** 99.9% of requests succeed over a rolling 28-day window

**Type:** Metric-based SLO

**SLI Definition:** Availability SLI (see above)

**Error Budget:**
- **Monthly Budget:** 0.1% = 43.2 minutes of downtime
- **Weekly Budget:** ~10.8 minutes
- **Daily Budget:** ~1.4 minutes
- **Alerting Threshold:** Alert when 75% of error budget consumed (32.4 minutes used)

**Why 99.9%?**
- Allows for reasonable maintenance windows
- Balances reliability with development velocity
- Industry standard for customer-facing services
- Achievable with standard practices (redundancy, health checks, rolling updates)

**Datadog SLO Configuration:**
```yaml
name: "{Service Name} - Availability (99.9%)"
type: metric
description: "Percentage of successful requests for {service-name}"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:availability
  - criticality:high
thresholds:
  target: 99.9
  target_display: "99.900"
  timeframe: 28d
  warning: 99.95
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},!http.status_code:5*,!http.status_code:429}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_count()"
```

**Datadog Dashboard Link:** `https://app.datadoghq.com/slo?query=service:{service-name}`

---

### SLO 2: Latency

**Target:** 95% of requests complete within {X}ms over a rolling 28-day window

**Type:** Metric-based SLO

**SLI Definition:** Latency SLI (see above)

**Error Budget:**
- **Monthly Budget:** 5% of requests can exceed threshold
- **Daily Budget:** ~5% per day
- **Alerting Threshold:** Alert when 75% of error budget consumed (3.75% of requests slow)

**Determining {X}ms threshold:**
1. Review p95 latency from past 28 days
2. Consider user expectations for this feature type:
   - **Interactive (search, navigation):** 100-200ms
   - **Page loads:** 500-1000ms
   - **Background operations:** 2000-5000ms
3. Validate with user research or A/B tests

**Why p95 instead of p99?**
- p95 affects a larger percentage of users (5% vs 1%)
- More actionable - easier to investigate and fix
- Less influenced by outliers and cold starts

**Datadog SLO Configuration:**
```yaml
name: "{Service Name} - Latency p95 ≤ {X}ms (95%)"
type: metric
description: "Percentage of requests completing within {X}ms for {service-name}"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:latency
  - criticality:high
thresholds:
  target: 95.0
  target_display: "95.000"
  timeframe: 28d
  warning: 97.0
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},http.status_code:2*,duration:≤{X}}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment},http.status_code:2*}.as_count()"
```

**Alternative: Monitor-based SLO**
```yaml
name: "{Service Name} - Latency Monitor-based"
type: monitor
description: "Time-based uptime using p95 latency monitor"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:latency
thresholds:
  target: 99.5
  timeframe: 28d
  warning: 99.75
monitor_ids:
  - {monitor-id-for-p95-latency-threshold}
groups:
  - env:{environment}
```

---

### SLO 3: Combined Availability & Latency (Recommended)

**Target:** 99.5% of requests succeed AND complete within {X}ms over a rolling 28-day window

**Type:** Metric-based SLO (composite)

**Rationale:** A successful response that's too slow is effectively a failure from the user's perspective. This composite SLO captures the true user experience.

**Error Budget:**
- **Monthly Budget:** 0.5% = 21.6 minutes
- **Weekly Budget:** ~5.4 minutes
- **Daily Budget:** ~43 seconds
- **Alerting Threshold:** Alert when 75% consumed (16.2 minutes)

**Why Combined SLO?**
- **More realistic:** Users care about "good" requests (fast + successful)
- **Prevents gaming:** Can't trade off latency for availability
- **Simpler communication:** One number to track and report
- **Better error budget:** Shared budget forces prioritization

**Datadog SLO Configuration:**
```yaml
name: "{Service Name} - Combined Success & Performance (99.5%)"
type: metric
description: "Percentage of successful AND fast requests for {service-name}"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:composite
  - criticality:critical
thresholds:
  target: 99.5
  target_display: "99.500"
  timeframe: 28d
  warning: 99.75
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},!http.status_code:5*,!http.status_code:429,duration:≤{X}}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_count()"
```

---

### Multi-Window SLO (Advanced)

For critical services, define SLOs over multiple windows to balance short-term alerting with long-term trends:

```yaml
# Short-term (7-day) - Fast feedback
name: "{Service Name} - Availability 7d (99.5%)"
thresholds:
  target: 99.5
  timeframe: 7d

# Medium-term (28-day) - Standard
name: "{Service Name} - Availability 28d (99.9%)"
thresholds:
  target: 99.9
  timeframe: 28d

# Long-term (90-day) - Trend tracking
name: "{Service Name} - Availability 90d (99.95%)"
thresholds:
  target: 99.95
  timeframe: 90d
```

---

## Service Level Agreements (SLAs)

> **SLA Definition:** A business contract between service provider and customer with financial or business consequences for breach.

### SLA vs SLO Relationship

**Critical Rule:** SLA target must be less stringent than SLO target

**Example:**
- **Internal SLO:** 99.9% availability (we alert and fix issues at this level)
- **Customer SLA:** 99.5% availability (customers get compensation below this)
- **Buffer:** 0.4% allows us to fix issues before customer impact

### SLA for {Service Name}

**Target:** {99.5}% of requests succeed over a calendar month

**Measurement Window:** Calendar month (1st to last day)

**Compensation:**
| Actual Availability | Service Credit |
|---------------------|----------------|
| 99.5% - 99.0% | 10% monthly fee |
| 99.0% - 95.0% | 25% monthly fee |
| < 95.0% | 50% monthly fee |

**Exclusions (Not counted against SLA):**
- Scheduled maintenance windows (with 7 days notice)
- Customer-caused outages (e.g., API abuse, DDoS)
- Force majeure events
- Third-party service failures (if clearly documented)

**SLA Review:** Quarterly with customer stakeholders

---

## Error Budget

> **Error Budget Definition:** The amount of unreliability you can tolerate before breaching your SLO.
>
> **Formula:** Error Budget = 100% - SLO Target

### Error Budget Calculation

**For 99.9% availability SLO over 28 days:**

```
Error Budget = 100% - 99.9% = 0.1%
= 0.001 × 28 days × 24 hours × 60 minutes
= 40.32 minutes per 28 days
≈ 43.2 minutes accounting for actual month length
```

### Error Budget Allocation

Error budget can be "spent" on:
- **Planned activities:** Feature launches, experiments, migrations
- **Unplanned outages:** Incidents, bugs, capacity issues
- **System changes:** Deployments, configuration changes
- **Dependencies:** Third-party service failures
- **Maintenance:** Planned downtime for upgrades

**Best Practice:** Reserve 50% for unplanned events, allocate 50% for planned activities

### Error Budget Visualization

**Current Status Dashboard:**
```
SLO: 99.9% Availability (28d)
Current: 99.87%
Error Budget Remaining: 65% (28 minutes of 43 minutes)

Status: HEALTHY ✅
```

**Error Budget Consumption Chart:**
- Show daily burn rate
- Forecast exhaustion date at current rate
- Highlight incidents and deployments

**Reference:** [https://availability.sre.xyz](https://availability.sre.xyz)

### Error Budget Table (Reference)

| Availability | Downtime/Year | Downtime/Quarter | Downtime/Month | Downtime/Week | Downtime/Day | Downtime/Hour |
|--------------|---------------|------------------|----------------|---------------|--------------|---------------|
| 90% | 36.52 days | 9.13 days | 3.04 days | 16.80 hours | 2.40 hours | 6.00 min |
| 95% | 18.26 days | 4.57 days | 1.52 days | 8.40 hours | 1.20 hours | 3.00 min |
| 99% | 3.65 days | 21.91 hours | 7.30 hours | 1.68 hours | 14.40 min | 36.00 sec |
| **99.5%** | **1.83 days** | **10.96 hours** | **3.65 hours** | **50.40 min** | **7.20 min** | **18.00 sec** |
| **99.9%** | **8.77 hours** | **2.19 hours** | **43.83 min** | **10.08 min** | **1.44 min** | **3.60 sec** |
| **99.95%** | **4.38 hours** | **1.10 hours** | **21.91 min** | **5.04 min** | **43.20 sec** | **1.80 sec** |
| 99.99% | 52.59 min | 13.15 min | 4.38 min | 1.01 min | 8.64 sec | 0.36 sec |
| 99.999% | 5.26 min | 1.31 min | 26.30 sec | 6.05 sec | 0.86 sec | 0.04 sec |

---

## Error Budget Policy

> **Purpose:** Define clear actions based on error budget status to balance reliability and innovation.

### 1. Healthy (>50% remaining) ✅

**Status:** Error budget is healthy, normal operations

**Actions:**
- ✅ Continue normal feature development velocity
- ✅ Deploy during business hours
- ✅ Accept reasonable technical debt
- ✅ Run experiments and A/B tests
- ✅ Standard code review process
- ✅ Launch new features on schedule

**Review Cadence:** Weekly SLO check-in

---

### 2. Warning (25-50% remaining) ⚠️

**Status:** Error budget consumption is elevated, increasing scrutiny

**Actions:**
- ⚠️ Increase review rigor for all changes
- ⚠️ Prioritize stability over new features
- ⚠️ Schedule deploys during low-traffic periods (nights/weekends)
- ⚠️ Require SRE approval for risky changes
- ⚠️ Begin investigating recurring issues
- ⚠️ Postpone non-critical experiments
- ⚠️ Add monitoring to error-prone areas
- ⚠️ Conduct mini-retrospectives on recent incidents

**Review Cadence:** Daily error budget review

**Notifications:**
- Alert team in Slack: "@channel - Error budget at {X}% - Warning threshold reached"
- Add agenda item to daily standup
- Update stakeholders on reliability status

---

### 3. Critical (<25% remaining) 🚨

**Status:** Error budget critically low, focus on reliability

**Actions:**
- 🚨 **Freeze non-critical deployments** - Only bug fixes and reliability improvements
- 🚨 All hands on deck for reliability improvements
- 🚨 Daily error budget review meetings
- 🚨 Root cause analysis required for ALL incidents
- 🚨 Implement quick wins to improve reliability
- 🚨 Cancel or postpone feature launches
- 🚨 Executive escalation and visibility
- 🚨 Create reliability improvement sprint
- 🚨 Mandatory blameless post-mortems

**Review Cadence:** Twice daily error budget review + incident reviews

**Notifications:**
- Page on-call engineer
- Alert engineering leadership
- Daily status updates to executive team
- Stakeholder communication plan

**Exit Criteria:**
- Error budget restored to >50%
- Root causes of major incidents addressed
- Monitoring gaps filled
- Runbooks updated

---

### 4. Exhausted (0% remaining) 🛑

**Status:** SLO breach, emergency response mode

**Actions:**
- 🛑 **FULL DEPLOYMENT FREEZE** - No changes except incident response
- 🛑 Emergency reliability sprint
- 🛑 Executive escalation to VP/CTO level
- 🛑 Customer communication (if SLA affected)
- 🛑 Post-mortem required with detailed action items
- 🛑 Dedicated war room for reliability improvements
- 🛑 Cancel all non-essential meetings
- 🛑 Block new feature work until recovery

**Review Cadence:** Continuous monitoring + hourly check-ins

**Notifications:**
- Immediate escalation to CTO/VP Engineering
- Customer success team notified (SLA impact)
- All-hands communication on severity
- Daily executive briefings

**Recovery Plan:**
1. Stabilize service immediately
2. Identify and fix top 3 sources of unreliability
3. Conduct comprehensive post-mortem
4. Create 30-day reliability improvement roadmap
5. Schedule follow-up review in 1 week

**Exit Criteria:**
- Service stable for 48 hours
- Error budget restored to >25%
- Action items from post-mortem assigned and tracked
- Executive team approves return to normal operations

---

## Supporting Monitors

> **Purpose:** Provide early warning before SLO breaches by monitoring symptoms and causes.

### Monitor Strategy

**Two Types of Monitors:**
1. **Symptom-based (SLO-focused):** Alert when SLI approaches SLO threshold
2. **Cause-based (Component-focused):** Alert on underlying issues (CPU, memory, dependencies)

**Monitor Principles:**
- Alert on symptoms first, investigate causes second
- Low alert fatigue - only page for actionable issues
- Clear ownership and escalation paths
- Runbooks linked in every alert

---

### 1. Error Rate Monitor (Symptom)

**Purpose:** Alert on sudden increases in error rate before significant SLO impact

**Type:** Change-based anomaly detection

**Configuration:**
```yaml
name: "Increased error rate for {service-name} in env:{environment}"
type: query alert
query: "change(avg(last_5m),last_2h):sum:trace.express.request.errors{service:{service-name},env:{environment},span.kind:server}.as_rate() > 3"
message: |
  🚨 Error rate has increased for {{service.name}} in {{env.name}}

  **Current error rate:** {{value}} errors/second
  **Threshold:** {{threshold}} errors/second
  **Change:** +{{value}} from 2 hours ago

  **Impact:**
  - SLO: {{slo_status}}% (target: 99.9%)
  - Error budget: {{error_budget_remaining}}% remaining

  **Investigation steps:**
  1. Check APM traces: {{trace_url}}
  2. Review recent deployments: {{deployment_log}}
  3. Check dependency health: {{dependency_dashboard}}
  4. Review error logs: {{log_url}}

  **Runbook:** https://wiki.company.com/runbooks/{service-name}/high-error-rate

  @slack-{team-channel}
  @pagerduty-{team-name}
thresholds:
  critical: 3
  warning: 1
  recovery: 0.5
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - alert_type:error_rate
  - severity:high
priority: 2
```

**Alert Enrichment:**
- Link to APM error analytics
- Recent deployment timeline
- Error budget status
- Runbook URL

---

### 2. Latency Anomaly Monitor (Symptom)

**Purpose:** Detect unusual latency patterns using ML-based anomaly detection

**Type:** Anomaly detection

**Configuration:**
```yaml
name: "Abnormal p75 latency for {service-name} on env:{environment}"
type: query alert
query: "avg(last_1h):anomalies(p75:trace.express.request{service:{service-name},env:{environment},span.kind:server}, 'agile', 2, direction='above', interval=20, alert_window='last_5m', count_default_zero='true', seasonality='hourly') >= 1"
message: |
  ⚠️ Anomalous latency detected for {{service.name}} in {{env.name}}

  **Current p75 latency:** {{value}}ms
  **Expected range:** {{normal_range}}ms
  **Deviation:** {{deviation}}%

  **Potential causes to investigate:**
  - Recent deployments or config changes
  - Database query performance (check slow query log)
  - Downstream service degradation
  - Resource constraints (CPU, memory)
  - Cache hit rate drops
  - Increased traffic patterns

  **Dashboards:**
  - Service performance: {{apm_dashboard}}
  - Database metrics: {{db_dashboard}}
  - Infrastructure: {{infra_dashboard}}

  **Runbook:** https://wiki.company.com/runbooks/{service-name}/high-latency

  @slack-{team-channel}
thresholds:
  critical: 1
  critical_recovery: 0
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - alert_type:latency_anomaly
  - severity:medium
priority: 3
```

**Why Anomaly Detection?**
- Adapts to traffic patterns (daily/weekly cycles)
- Reduces false positives from expected spikes
- Detects gradual degradation
- Learns normal behavior over time

---

### 3. SLO Burn Rate Alert (Symptom)

**Purpose:** Alert when error budget is being consumed faster than sustainable rate

**Type:** Multi-window burn rate

**Configuration:**
```yaml
name: "Fast SLO burn rate for {service-name}"
type: slo alert
query: "slo('{slo-id}').over('1h').errors_budget_remaining() < 75 AND slo('{slo-id}').over('5m').errors_budget_remaining() < 50"
message: |
  🔥 FAST SLO BURN DETECTED for {{service.name}}

  **Burn Rate Analysis:**
  - 5-minute burn: {{burn_rate_5m}}x normal
  - 1-hour burn: {{burn_rate_1h}}x normal
  - Error budget remaining: {{error_budget_pct}}%
  - Time to exhaustion: {{time_to_exhaustion}}

  **At this rate, error budget will be exhausted in {{forecast_time}}**

  **Immediate actions:**
  1. Identify active incident causing burn
  2. Implement mitigation or rollback
  3. Alert incident commander
  4. Update status page if customer-facing

  **Context:**
  - SLO target: {{slo_target}}%
  - Current performance: {{current_sli}}%
  - Recent changes: {{recent_deploys}}

  @pagerduty-{team-name}-critical
  @slack-{team-channel}
thresholds:
  critical: 75
  warning: 50
tags:
  - service:{service-name}
  - alert_type:slo_burn_rate
  - severity:critical
priority: 1
```

**Burn Rate Windows:**
- **5-minute window:** Detect fast-burning incidents (page immediately)
- **1-hour window:** Detect slow burns (alert but don't page)
- **6-hour window:** Trend monitoring (informational)

---

### 4. Dependency Health Monitor (Cause)

**Purpose:** Alert when upstream dependencies are degraded

**Configuration:**
```yaml
name: "Dependency health check for {dependency-name}"
type: service check
query: '"http.check".over("url:https://{dependency-endpoint}/health").by("*").last(2).count_by_status()'
message: |
  ⚠️ Dependency {{check.name}} is failing

  **Dependency:** {dependency-name}
  **Status:** {{check.status}}
  **Endpoint:** {{check.url}}
  **Last success:** {{check.last_success}}

  **Impact assessment:**
  - Affected services: {service-name}, {other-service}
  - Expected error rate increase: ~{{estimated_impact}}%
  - Circuit breaker status: {{circuit_breaker_status}}

  **Actions:**
  1. Check dependency status page
  2. Review circuit breaker configuration
  3. Consider fallback/degraded mode
  4. Communicate with dependency team

  @slack-{team-channel}
thresholds:
  critical: 2
tags:
  - service:{service-name}
  - alert_type:dependency_health
  - dependency:{dependency-name}
priority: 3
```

---

### 5. Error Budget Threshold Alerts

**Purpose:** Provide graduated warnings as error budget is consumed

**Configuration:**

```yaml
# Alert 1: 75% consumed (Warning)
name: "Error budget 75% consumed - {service-name}"
query: "slo('{slo-id}').error_budget_remaining() < 25"
message: |
  ⚠️ Error budget at 25% remaining for {{service.name}}

  Entering WARNING state. Review error budget policy.

  @slack-{team-channel}
priority: 3

# Alert 2: 90% consumed (Critical)
name: "Error budget 90% consumed - {service-name}"
query: "slo('{slo-id}').error_budget_remaining() < 10"
message: |
  🚨 Error budget at 10% remaining for {{service.name}}

  Entering CRITICAL state. Deployment freeze in effect.

  @slack-{team-channel}
  @pagerduty-{team-name}
priority: 2

# Alert 3: Exhausted (Emergency)
name: "Error budget exhausted - {service-name}"
query: "slo('{slo-id}').error_budget_remaining() <= 0"
message: |
  🛑 ERROR BUDGET EXHAUSTED for {{service.name}}

  SLO BREACH. Emergency response required.

  @pagerduty-{team-name}-critical
  @slack-{team-channel}
priority: 1
```

---

## Alerting Strategy

### Alert Severity Levels

| Level | Trigger | Response | Who | Response Time |
|-------|---------|----------|-----|---------------|
| **P1 - Critical** | SLO breach or fast burn (>5x) | Page on-call | On-call engineer | < 5 minutes |
| **P2 - High** | SLO at risk (>3x burn rate) | Page during business hours | Team lead | < 15 minutes |
| **P3 - Medium** | Warning threshold (>1.5x burn) | Slack notification | Team | < 1 hour |
| **P4 - Low** | Informational | Dashboard only | Team | Next business day |

### Alert Routing

**Notification Channels:**
```yaml
channels:
  critical:
    - pagerduty: {team-name}-critical
    - slack: {team-channel} @channel
    - email: {team-distribution-list}

  high:
    - pagerduty: {team-name}
    - slack: {team-channel}
    - email: {on-call-engineer}

  medium:
    - slack: {team-channel}

  low:
    - dashboard: SLO Dashboard
```

### Alert Escalation

**Escalation Policy:**
```
1. On-call engineer (0 minutes)
   ↓ (no ack in 15 min)
2. Backup on-call (15 minutes)
   ↓ (no ack in 15 min)
3. Team lead (30 minutes)
   ↓ (no resolution in 1 hour)
4. Engineering manager (1 hour)
   ↓ (SLO breach confirmed)
5. VP Engineering (SLO breach + customer impact)
```

### Alert Best Practices

1. **Every alert must be actionable** - No "FYI" pages
2. **Link to runbooks** - Every alert has investigation steps
3. **Include context** - Error budget status, recent changes, impact
4. **Tune thresholds** - Target <2 pages per week per engineer
5. **Review alert fatigue** - Measure ack time and false positive rate

### On-Call Responsibilities

**When alerted:**
1. **Acknowledge** within 5 minutes
2. **Assess** severity and impact
3. **Mitigate** immediately (rollback, scale, disable feature)
4. **Communicate** in incident channel
5. **Document** actions in incident log
6. **Resolve** and verify recovery
7. **Create** post-mortem ticket

---

## SLO Review Process

> **Purpose:** Continuously improve SLOs based on business needs, user feedback, and system evolution.

### Weekly Review

**Attendees:** Team lead, SRE, Product owner

**Duration:** 15 minutes

**Agenda:**
1. **Check error budget consumption**
   - Current status for each SLO
   - Burn rate trends (increasing/decreasing?)
   - Comparison to previous week
2. **Review recent incidents**
   - Which incidents impacted SLOs?
   - How much error budget was consumed?
   - Were alerts effective?
3. **Identify trends in SLI metrics**
   - Are we consistently above/below target?
   - Any degradation patterns?
   - New issues emerging?
4. **Action items**
   - Immediate reliability improvements needed
   - Monitor tuning required
   - Runbook updates

**Outputs:**
- Error budget status report
- Action items with owners
- Risk assessment for upcoming week

---

### Monthly Review

**Attendees:** Team, SRE, Product manager, Engineering manager

**Duration:** 1 hour

**Agenda:**
1. **Evaluate if SLO targets remain appropriate**
   - Are targets too easy? (Always 100% → increase target)
   - Are targets too hard? (Always failing → decrease target)
   - Has business context changed?
2. **Review effectiveness of alerting strategy**
   - False positive rate
   - Time to detect/respond
   - Alert fatigue metrics
3. **Update thresholds based on actual performance**
   - Adjust based on historical data
   - Consider seasonality
4. **Document any SLO adjustments**
   - Why changed
   - What changed
   - Expected impact

**Outputs:**
- SLO adjustment recommendations
- Updated monitor thresholds
- Error budget policy refinements
- Quarterly goals

---

### Quarterly Review

**Attendees:** Team, SRE, Product, Engineering leadership, Customer success

**Duration:** 2 hours

**Agenda:**
1. **Deep dive into SLI metric accuracy**
   - Do metrics reflect actual user experience?
   - Are we measuring the right things?
   - Any gaps in instrumentation?
2. **Assess correlation with user satisfaction**
   - Compare SLO performance to NPS, support tickets
   - User research findings
   - Customer feedback themes
3. **Consider adding new SLIs/SLOs**
   - New features launched
   - New user journeys
   - Emerging reliability concerns
4. **Align SLOs with business objectives**
   - Strategic priorities for next quarter
   - Competitive positioning
   - Contractual obligations

**Outputs:**
- Updated SLI/SLO specification
- Instrumentation backlog
- Quarterly reliability roadmap
- Executive summary report

---

### SLO Adjustment Process

**When to adjust:**
- ✅ Consistently meeting target (>3 months) → Increase target
- ✅ Consistently missing target (>3 months) → Decrease target OR invest in reliability
- ✅ Business requirements change
- ✅ User expectations shift
- ✅ System architecture changes significantly

**How to adjust:**
1. Propose change with data-driven rationale
2. Review with stakeholders
3. Update documentation
4. Announce to team and customers (if SLA affected)
5. Monitor for 4 weeks
6. Retrospective on change impact

**Version control:**
- Track all SLO changes in git
- Include rationale in commit message
- Archive old versions for reference

---

## Post-Mortem Process

> **Post-Mortem Definition:** A blameless document that analyzes an incident AFTER resolution to understand systemic causes and prevent recurrence.

### When to Write a Post-Mortem

**Required for:**
- ✅ Any incident that breached an SLO
- ✅ Customer-impacting outages (even if SLO met)
- ✅ Significant error budget consumption (>10% in one incident)
- ✅ Near-misses that could have caused major impact
- ✅ Incidents lasting >1 hour

**Optional but recommended for:**
- Interesting or novel failures
- Incidents with valuable lessons
- Process failures (even without technical failure)

---

### Post-Mortem Structure

#### 1. Header & Status

```markdown
# Post-Mortem: {Incident Title}

**Date:** {YYYY-MM-DD}
**Authors:** {Name 1}, {Name 2}
**Status:** {Draft | In Review | Complete}
**Severity:** {P1 | P2 | P3}
**Incident Commander:** {Name}
**Reviewers:** {Name 1}, {Name 2}
```

#### 2. Summary (Executive Summary)

**1-2 paragraph overview:**
- What happened (symptoms)
- When it happened
- How long it lasted
- High-level cause
- User impact

**Example:**
> "On 2024-11-06 at 14:35 UTC, the {service-name} API experienced elevated error rates (15% vs. baseline 0.1%) due to a cascading failure triggered by a database connection pool exhaustion. The incident lasted 43 minutes and consumed 12% of our monthly error budget. Approximately 5,000 users experienced errors during this time, primarily affecting the order placement flow."

#### 3. Impact Assessment

**User Impact:**
- Number of users affected
- Features/flows impacted
- Geographic distribution
- Customer segment (free/paid)

**Business Impact:**
- Revenue impact (if calculable)
- Support tickets generated
- NPS/sentiment impact
- SLA/SLO breach consequences

**SLO Impact:**
```
- Availability SLO: 99.87% (target: 99.9%)
- Error budget consumed: 12% of monthly budget
- Time to exhaustion at current rate: 6 more incidents of this size
```

#### 4. Root Cause Analysis

**Trigger (What directly caused it):**
- The specific event that initiated the incident
- Example: "Deployment of version 2.3.4 at 14:30 UTC"

**Root Cause (Why it was able to happen):**
- The underlying systemic reason
- Example: "Database connection pool was configured for 100 connections but typical peak load requires 150. No monitoring alerted on connection pool saturation."

**Contributing Factors:**
- Additional conditions that worsened impact
- Example: "Retry logic without exponential backoff amplified load on database"

**Why Analysis (5 Whys):**
```
1. Why did the service fail?
   → Database connections exhausted

2. Why did connections exhaust?
   → Pool size (100) < peak demand (150)

3. Why wasn't pool size adequate?
   → Pool sized based on average load, not peak

4. Why didn't we detect this before production?
   → Load testing used average traffic patterns

5. Why aren't traffic patterns in load tests?
   → No documented process for realistic load test scenarios
```

#### 5. Detection & Response Timeline

**Detailed timeline with timestamps:**

| Time (UTC) | Event | Who/What |
|------------|-------|----------|
| 14:30:00 | Deployment v2.3.4 started | CD Pipeline |
| 14:32:15 | First error spike detected | Datadog Monitor |
| 14:33:00 | On-call paged | PagerDuty |
| 14:35:30 | Engineer acknowledged | Alice |
| 14:38:00 | Incident channel created | Alice |
| 14:42:00 | Identified DB connection issue | Alice |
| 14:45:00 | Rollback initiated | Alice |
| 14:52:00 | Rollback complete | CD Pipeline |
| 14:55:00 | Error rates returned to normal | Datadog |
| 15:13:00 | Incident resolved | Alice |

**Detection:**
- How was it detected? (monitoring alert, customer report, etc.)
- Time to detect (TTD): 2 minutes
- Alert effectiveness: Good - monitor fired as expected

**Response:**
- Who responded and how quickly?
- What mitigation steps were taken?
- Time to mitigate (TTM): 20 minutes
- Time to resolve (TTR): 43 minutes

#### 6. What Went Well

**Celebrate successes (yes, even during incidents!):**
- ✅ Monitoring detected issue within 2 minutes
- ✅ On-call acknowledged alert within 3 minutes
- ✅ Rollback process worked smoothly
- ✅ Clear communication in incident channel
- ✅ No data loss occurred

#### 7. What Went Wrong

**Blameless identification of gaps:**
- ❌ Connection pool sizing inadequate for peak load
- ❌ No alerting on connection pool saturation
- ❌ Load testing didn't simulate peak traffic patterns
- ❌ Retry logic amplified the problem
- ❌ Rollback took 10 minutes (target: <5 minutes)

#### 8. Where We Got Lucky

**Near-misses and luck factors:**
- 🍀 Incident occurred during low-traffic period (could have been worse at peak)
- 🍀 Issue manifested quickly (detected before all users affected)
- 🍀 Experienced engineer was on-call

#### 9. Action Items

**Specific, measurable, owned tasks:**

| Action Item | Type | Owner | Due Date | Priority | Status |
|-------------|------|-------|----------|----------|--------|
| Increase DB connection pool to 200 | Mitigate | Alice | 2024-11-07 | P1 | ✅ Done |
| Add connection pool saturation alert | Prevent | Bob | 2024-11-09 | P1 | 🟡 In Progress |
| Implement exponential backoff in retry logic | Prevent | Charlie | 2024-11-15 | P2 | ⏳ Todo |
| Update load tests with peak traffic patterns | Prevent | Dave | 2024-11-20 | P2 | ⏳ Todo |
| Improve rollback speed (target <5min) | Process | Alice | 2024-11-25 | P3 | ⏳ Todo |
| Document connection pool sizing runbook | Process | Bob | 2024-11-30 | P3 | ⏳ Todo |

**Action Item Types:**
- **Mitigate:** Immediate fixes to prevent recurrence
- **Prevent:** Long-term improvements to eliminate root cause
- **Process:** Improve detection, response, or communication
- **Monitor:** Add observability for similar issues

#### 10. Lessons Learned

**Key takeaways:**
1. **Load testing must simulate peak traffic** - Average load is not sufficient
2. **Monitor resource saturation, not just errors** - Proactive vs reactive
3. **Fast rollback is critical** - Invest in deployment automation
4. **Retry logic needs backoff** - Can amplify failures without it

---

### Post-Mortem Best Practices

**1. Blameless Culture**
- Never name individuals as "cause"
- Focus on systems, processes, assumptions
- Create psychological safety for honesty

**2. Timeline Accuracy**
- Use actual logs, metrics, chat timestamps
- Be precise (minutes matter)

**3. Actionable Items**
- Specific, not vague ("add monitoring" → "add alert for connection pool >80%")
- Assigned owner and due date
- Tracked to completion

**4. Share Widely**
- Distribute to entire engineering org
- Present in team meeting
- Archive in knowledge base

**5. Follow-up**
- Review action items weekly until complete
- Verify effectiveness of changes
- Celebrate when fully resolved

---

### Post-Mortem Template

**Template Location:** `docs/post-mortem-template.md`

**Example Post-Mortem:** [https://gist.github.com/mlafeldt/6e02ea0caeebef1205b47f31c2647966](https://gist.github.com/mlafeldt/6e02ea0caeebef1205b47f31c2647966)

---

## Related Documentation

**Service Documentation:**
- **Service Architecture:** [Link to architecture doc]
- **API Documentation:** [Link to API docs]
- **Runbooks:** [Link to incident response runbooks]
- **Deployment Guide:** [Link to deployment procedures]

**Dashboards & Monitoring:**
- **Datadog Service Dashboard:** `https://app.datadoghq.com/dashboard/{dashboard-id}`
- **APM Service Page:** `https://app.datadoghq.com/apm/service/{service-name}`
- **SLO Dashboard:** `https://app.datadoghq.com/slo?query=service:{service-name}`
- **Error Budget Dashboard:** `https://app.datadoghq.com/slo?query=service:{service-name}&view=error_budget`

**SRE Resources:**
- **SRE Handbook:** [Link to internal SRE handbook]
- **Error Budget Policy:** [Link to organization-wide policy]
- **Post-Mortem Archive:** [Link to past post-mortems]
- **On-Call Rotation:** [Link to PagerDuty schedule]

**External References:**
- **Google SRE Book:** [https://sre.google/books/](https://sre.google/books/)
- **Datadog SLO Guide:** [https://docs.datadoghq.com/service_management/service_level_objectives/](https://docs.datadoghq.com/service_management/service_level_objectives/)
- **Availability Calculator:** [https://availability.sre.xyz](https://availability.sre.xyz)
- **Apdex Score:** [http://apdex.org/](http://apdex.org/)

---

## Examples & Templates

### Example: agent-api Service

For a complete worked example of this template filled out for the `agent-api` service, see:
- [agent-api SLI/SLO Specification](./SLI_SLO_SPECS_agent-api.md)

### Example: burger-api Service

For an example focused on a REST API service, see:
- [burger-api SLI/SLO Specification](./SLI_SLO_SPECS_burger-api.md)

---

## Appendix: Apdex Score (Optional)

**Apdex (Application Performance Index)** is an alternative method to measure user satisfaction based on response time.

### Apdex Formula

```
Apdex = (Satisfied_count + (Tolerating_count / 2)) / Total_samples
```

**Response Time Zones:**
- **Satisfied (S):** Response time ≤ T (target)
- **Tolerating (T):** T < Response time ≤ 4T
- **Frustrated (F):** Response time > 4T

**Score Interpretation:**
| Score Range | Rating |
|-------------|--------|
| 1.00 - 0.94 | Excellent |
| 0.93 - 0.85 | Good |
| 0.84 - 0.70 | Fair |
| 0.69 - 0.50 | Poor |
| 0.49 - 0.00 | Unacceptable |

**Example Calculation:**
- Target (T): 200ms
- Samples: 200 total
  - 150 requests ≤ 200ms (Satisfied)
  - 30 requests 200-800ms (Tolerating)
  - 20 requests > 800ms (Frustrated)

```
Apdex = (150 + (30 / 2)) / 200 = 0.825 (Fair)
```

**When to use Apdex:**
- Alternative to percentile-based SLOs
- Single metric for user satisfaction
- Weighted toward fast responses
- Industry-standard benchmark

---

## Notes & Best Practices

### General Guidelines

1. **Start simple** - Begin with 1-2 SLOs (availability + latency), add more as needed
2. **Use historical data** - Base targets on past performance, then iterate
3. **Measure at the edge** - SLIs should reflect user experience, not internal metrics
4. **Iterate continuously** - Review and adjust SLOs quarterly
5. **Balance is key** - Too many 9s = slow innovation, too few = unhappy users

### Datadog-Specific Tips

1. **Validate queries** - Test all Datadog queries in Metrics Explorer before deploying
2. **Use tags consistently** - Tag all SLOs with `service`, `team`, `env`, `sli_type`
3. **Enable anomaly detection** - Use Datadog's ML for smarter alerting
4. **Leverage APM** - Correlate SLO breaches with traces for faster root cause analysis
5. **Create SLO summaries** - Use Datadog's SLO summary widget in dashboards

### Common Pitfalls to Avoid

1. ❌ **Too many SLOs** - More than 5 SLOs per service is typically too many
2. ❌ **Vanity metrics** - Don't measure internal metrics users don't experience
3. ❌ **Unrealistic targets** - 99.99% may sound good but is often unnecessary and expensive
4. ❌ **No error budget policy** - SLOs without consequences don't drive behavior change
5. ❌ **Ignoring dependencies** - Your SLO is limited by your slowest dependency
6. ❌ **Alert fatigue** - Too many alerts = ignored alerts
7. ❌ **No post-mortems** - Incidents without learning are wasted opportunities

### Success Metrics

**You'll know SLOs are working when:**
- ✅ Error budget is being used to make deployment decisions
- ✅ Team has shared language for reliability ("we're at 50% error budget")
- ✅ Fewer than 2 pages per week per engineer
- ✅ Most incidents detected by monitoring (not customers)
- ✅ Post-mortem action items are completed and effective
- ✅ SLO performance correlates with user satisfaction metrics

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| {YYYY-MM-DD} | 1.0 | Initial SLI/SLO specification | {Author} |
| {YYYY-MM-DD} | 1.1 | Updated latency threshold based on Q1 data | {Author} |
| {YYYY-MM-DD} | 2.0 | Added combined SLO, revised error budget policy | {Author} |

---

## Approval & Sign-off

**Approved by:**
- [ ] Team Lead: _________________ Date: _________
- [ ] SRE: _________________ Date: _________
- [ ] Product Manager: _________________ Date: _________
- [ ] Engineering Manager: _________________ Date: _________

**Next Review Date:** {YYYY-MM-DD}

---

*This template is based on the SRE Deep Dive presentation delivered at DevSecOps Meetup on 6 November 2025 by Jirayut Nimsaeng (Dear), CEO & Founder of Opsta.*
