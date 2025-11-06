# SLO Specification Template

## Service: {Service Name}

**Owner:** {Team/Squad Name}
**Environment:** {dev/prod}
**Last Updated:** {YYYY-MM-DD}

---

## Service Overview

**Description:** {Brief description of what this service does and its role in the system}

**Dependencies:**
- {Upstream service 1}
- {Upstream service 2}
- {Database/External service}

**User Journey Impact:** {Describe which user journeys this service supports}

---

## Service Level Indicators (SLIs)

### 1. Availability SLI

**Definition:** Percentage of successful requests (non-error responses)

**Measurement:**
- **Good Events:** HTTP requests returning 2xx or 3xx status codes
- **Total Events:** All HTTP requests received by the service
- **Formula:** `(good_requests / total_requests) * 100`

**Datadog Metrics:**
```
Good Requests: sum:trace.express.request.hits{service:{service-name},env:{environment},!http.status_code:5*,!http.status_code:4*}
Total Requests: sum:trace.express.request.hits{service:{service-name},env:{environment}}
```

**Why This Matters:** Users expect the service to respond successfully to their requests. High error rates directly impact user experience and trust.

---

### 2. Latency SLI

**Definition:** Percentage of requests completing within target latency threshold

**Measurement:**
- **Good Events:** Requests with p95 latency d {X}ms
- **Total Events:** All HTTP requests
- **Formula:** `(requests_within_threshold / total_requests) * 100`

**Datadog Metrics:**
```
P95 Latency: p95:trace.express.request{service:{service-name},env:{environment},span.kind:server}
P99 Latency: p99:trace.express.request{service:{service-name},env:{environment},span.kind:server}
```

**Latency Thresholds:**
- **Fast (p50):** d {Y}ms
- **Acceptable (p95):** d {X}ms
- **Slow (p99):** d {Z}ms

**Why This Matters:** Response time directly affects user satisfaction. Slow responses lead to poor user experience and potential timeouts.

---

### 3. Throughput SLI (Optional)

**Definition:** Service capacity to handle expected request volume

**Measurement:**
- **Current Throughput:** Requests per second
- **Expected Throughput:** Target requests per second
- **Formula:** `(current_rps / expected_rps) * 100`

**Datadog Metrics:**
```
Request Rate: sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_rate()
```

**Why This Matters:** Ensures the service can handle expected load without degradation.

---

## Service Level Objectives (SLOs)

### SLO 1: Service Availability

**Target:** 99.9% of requests succeed over a rolling 30-day window

**Type:** Metric-based SLO

**Error Budget:**
- **Monthly Budget:** 0.1% (43.2 minutes of downtime)
- **Daily Budget:** ~1.4 minutes
- **Alerting Threshold:** Alert when 75% of error budget consumed

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
thresholds:
  target: 99.9
  target_display: "99.900"
  timeframe: 30d
  warning: 99.95
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},!http.status_code:5*,!http.status_code:4*}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_count()"
```

**Rationale:** 99.9% availability allows for minimal downtime while being achievable with standard practices. This target balances user expectations with operational reality.

---

### SLO 2: Service Latency

**Target:** 99% of requests complete within {X}ms over a rolling 30-day window

**Type:** Metric-based SLO (using p95 latency)

**Error Budget:**
- **Monthly Budget:** 1% of requests can exceed latency threshold
- **Alerting Threshold:** Alert when 75% of error budget consumed

**Datadog SLO Configuration:**
```yaml
name: "{Service Name} - Latency p95 d {X}ms (99%)"
type: metric
description: "Percentage of requests completing within {X}ms for {service-name}"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:latency
thresholds:
  target: 99.0
  target_display: "99.000"
  timeframe: 30d
  warning: 99.5
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},p95_latency:<{X}}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_count()"
```

**Alternative: Monitor-based SLO**
```yaml
name: "{Service Name} - Latency Monitor-based"
type: monitor
description: "Time-based availability using latency monitor"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:latency
thresholds:
  target: 99.5
  timeframe: 30d
  warning: 99.75
monitor_ids:
  - {monitor-id-for-p95-latency}
```

**Rationale:** Fast response times are critical for user experience. The p95 threshold ensures most users experience acceptable performance.

---

### SLO 3: Combined Availability & Latency (Recommended)

**Target:** 99.5% of requests succeed AND complete within {X}ms over a rolling 30-day window

**Type:** Metric-based SLO (composite)

**Error Budget:**
- **Monthly Budget:** 0.5% (21.6 minutes)
- **Alerting Threshold:** Alert when 75% of error budget consumed

**Datadog SLO Configuration:**
```yaml
name: "{Service Name} - Combined Success & Performance (99.5%)"
type: metric
description: "Percentage of successful requests completing within {X}ms for {service-name}"
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - sli_type:composite
thresholds:
  target: 99.5
  target_display: "99.500"
  timeframe: 30d
  warning: 99.75
query:
  numerator: "sum:trace.express.request.hits{service:{service-name},env:{environment},!http.status_code:5*,!http.status_code:4*,p95_latency:<{X}}.as_count()"
  denominator: "sum:trace.express.request.hits{service:{service-name},env:{environment}}.as_count()"
```

**Rationale:** A successful response that's too slow is effectively a failure from the user's perspective. This composite SLO captures the true user experience.

---

## Supporting Monitors

### Error Rate Monitor

**Purpose:** Alert on sudden increases in error rate before SLO breach

**Configuration:**
```yaml
name: "Increased error rate for {service-name} in env:{environment}"
type: query alert
query: "change(avg(last_5m),last_2h):sum:trace.express.request.errors{service:{service-name},env:{environment},span.kind:server}.as_rate() > 3"
message: |
  Error rate has increased for {{service.name}} in {{env.name}}

  Current error rate: {{value}}
  Threshold: {{threshold}}

  Check the service logs and APM traces for root cause.
  @slack-{team-channel}
thresholds:
  critical: 3
  warning: 1
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - alert_type:error_rate
```

---

### Latency Anomaly Monitor

**Purpose:** Detect unusual latency patterns using machine learning

**Configuration:**
```yaml
name: "Abnormal change in p75 latency for {service-name} on env:{environment}"
type: query alert
query: "avg(last_1h):anomalies(p75:trace.express.request{service:{service-name},env:{environment},span.kind:server}, 'agile', 2, direction='above', interval=20, alert_window='last_5m', count_default_zero='true', seasonality='hourly') >= 1"
message: |
  Anomalous latency detected for {{service.name}} in {{env.name}}

  Current p75 latency is abnormally high compared to historical patterns.

  Investigate:
  - Recent deployments
  - Database performance
  - Downstream service health
  @slack-{team-channel}
thresholds:
  critical: 1
tags:
  - service:{service-name}
  - team:{team-name}
  - env:{environment}
  - alert_type:latency_anomaly
```

---

## Error Budget Policy

### When Error Budget is Healthy (>50% remaining)

-  Continue normal feature development
-  Deploy during business hours
-  Accept reasonable technical debt

### When Error Budget is Warning (25-50% remaining)

-   Increase review rigor for changes
-   Prioritize stability over new features
-   Schedule deploys during low-traffic periods
-   Begin investigating recurring issues

### When Error Budget is Critical (<25% remaining)

- =¨ **Freeze non-critical deployments**
- =¨ All hands on deck for reliability improvements
- =¨ Daily error budget review meetings
- =¨ Root cause analysis for all incidents
- =¨ Implement quick wins to improve reliability

### When Error Budget is Exhausted (0% remaining)

- =Ñ **FULL DEPLOYMENT FREEZE** (except hotfixes)
- =Ñ Emergency reliability sprint
- =Ñ Executive escalation
- =Ñ Post-mortem required with action items

---

## Alerting Strategy

### Alert Levels

1. **Informational:** SLO burn rate indicates potential future issues
2. **Warning:** 75% of error budget consumed OR fast burn detected
3. **Critical:** 90% of error budget consumed OR very fast burn detected
4. **Emergency:** SLO breach occurred OR error budget exhausted

### Notification Channels

- **Slack:** `@slack-{team-channel}` for warnings and critical alerts
- **PagerDuty:** Critical and emergency alerts only
- **Email:** Team distribution list for all alerts
- **Incident Management:** Auto-create incident for emergency alerts

---

## SLO Review Process

### Weekly Review
- Check error budget consumption
- Review recent incidents impacting SLO
- Identify trends in SLI metrics

### Monthly Review
- Evaluate if SLO targets remain appropriate
- Review effectiveness of alerting strategy
- Update thresholds based on actual performance
- Document any SLO adjustments

### Quarterly Review
- Deep dive into SLI metric accuracy
- Assess correlation with user satisfaction
- Consider adding new SLIs/SLOs
- Align SLOs with business objectives

---

## Related Documentation

- **Service Architecture:** [Link to architecture doc]
- **Runbook:** [Link to incident response runbook]
- **Datadog Dashboard:** [Link to service dashboard]
- **APM Service Page:** `https://app.datadoghq.com/apm/service/{service-name}`
- **SLO Dashboard:** `https://app.datadoghq.com/slo`

---

## Example: Filled Template for agent-api

See [agent-api SLO Specification](./SLO_SPECS_agent-api.md) for a complete example.

---

## Notes

- All Datadog queries should be validated in Metrics Explorer before implementation
- SLO targets should be realistic and based on historical performance
- Error budgets are shared across all SLOs for the service
- Always tag SLOs with `service`, `team`, `env`, and `sli_type` for easy filtering
- Use 30-day rolling windows for production SLOs
- Consider 7-day windows for experimental or new services
- Review and update this specification quarterly or after major incidents
