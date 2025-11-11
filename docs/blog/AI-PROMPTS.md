---
layout: default
title: "AI Prompts Guide"
parent: "Bits Learn to Bites - Blog Series"
nav_order: 99
---

# AI Exploration Prompts - Complete Collection

This guide contains all AI prompts from the **Bits Learn to Bites** series, organized by episode and difficulty level.

**How to use these prompts:**
1. Install [Claude Code](https://claude.com/claude-code)
2. Configure [Datadog MCP server](https://docs.datadoghq.com/bits_ai/mcp_server/)
3. Copy any prompt below
4. Paste into Claude Code
5. Explore your own Datadog environment!

---

## 📚 Episode 1: The Secret Sauce - SSI

### 🟢 Beginner Prompt

```markdown
Using Datadog MCP, show me all services with APM tracing enabled in my environment.

For each service, tell me:
1. Service name
2. Environment (dev/prod)
3. Language/runtime
4. Whether it's using automatic instrumentation

Use:
- mcp__datadog-mcp__search_datadog_services
- mcp__datadog-mcp__search_datadog_spans (to see span types)
```

**Learning goal:** Understand which services have APM and what's being traced

---

### 🟡 Intermediate Prompt

```markdown
Using Datadog MCP, analyze my burger-api service and show me:

1. What automatic instrumentation is working (HTTP, DB, Redis, etc.)
2. Average response time by endpoint
3. Any errors in the last hour
4. Database queries being executed

Then explain: Which parts came from SSI automatic instrumentation, and which would require custom spans?

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:burger-api")
- Group results by operation_name
- Analyze span hierarchy (parent-child relationships)
- Check for postgres.query, http.request spans
```

**Learning goal:** Distinguish automatic vs custom instrumentation

---

### 🔴 Advanced Prompt

```markdown
Compare instrumentation coverage between burger-api and agent-api services.

Create a comparison table showing:
1. Common span types (HTTP, DB, etc.)
2. Unique span types per service
3. p95 latency by endpoint
4. Error rate comparison
5. Database query count per request

Then calculate:
- Instrumentation completeness score (0-100%)
- Identify gaps in observability
- Recommend additional custom spans needed

Use:
- mcp__datadog-mcp__search_datadog_spans for both services
- Statistical analysis
- Compare span coverage
```

**Learning goal:** Audit observability coverage across services

---

### 🏆 Challenge Prompt

```markdown
You're consulting for a company with 20 microservices. They want to adopt SSI.

Investigate the mcp-agent project and create:

1. **Migration Plan:**
   - Which services can use SSI immediately?
   - Which need code changes first?
   - Estimate effort (hours) to migrate

2. **ROI Analysis:**
   - Time saved on maintenance (hours/week)
   - Consistency improvement (% better)
   - Risk reduction (incidents prevented)

3. **Implementation Guide:**
   - Step-by-step checklist
   - Common pitfalls to avoid
   - Testing strategy

Use:
- mcp__datadog-mcp__search_datadog_services
- Code analysis from the repo
- Best practices from Datadog docs (search_datadog_docs)
```

**Learning goal:** Build real-world migration expertise

---

## 📚 Episode 2: Logs & Traces: A Love Story

### 🟢 Beginner Prompt

```markdown
Using Datadog MCP, find logs from burger-api service in the last hour.

Show me:
1. Total log count
2. Breakdown by log level (info, error, warn)
3. Any errors found
4. Do the logs have trace IDs (dd.trace_id)?

Use:
- mcp__datadog-mcp__search_datadog_logs (query: "service:burger-api")
- Group by status (info/error)
- Check for correlation fields
```

**Learning goal:** Understand log structure and correlation

---

### 🟡 Intermediate Prompt

```markdown
Find an error in the burger-api logs from the last 24 hours.

Then:
1. Extract the trace ID from the log entry
2. Get the full APM trace using that trace ID
3. Show me the complete request flow (all spans)
4. Identify which span had the error
5. Show any related log entries in the same trace

Use:
- mcp__datadog-mcp__search_datadog_logs (query: "service:burger-api status:error")
- mcp__datadog-mcp__get_datadog_trace (with extracted trace_id)
- Correlate logs to trace timeline
```

**Learning goal:** Debug using log-trace correlation

---

### 🔴 Advanced Prompt

```markdown
Analyze log patterns for burger-api over the last 7 days.

Questions to answer:
1. What percentage of logs have trace correlation?
2. Most common error messages (top 5)
3. Error rate trend (increasing/decreasing?)
4. Which endpoints generate the most logs?
5. Log volume by severity (info vs error)

Then investigate the top error:
- Get full trace showing the error
- Find root cause from span tags
- Recommend fix

Use:
- mcp__datadog-mcp__search_datadog_logs with grouping
- Statistical analysis
- Pattern recognition
```

**Learning goal:** Log analytics and error pattern detection

---

### 🏆 Challenge Prompt

```markdown
You're debugging a production issue: "Orders failing intermittently"

Using only logs and traces, investigate:

1. Find failed order attempts in logs
2. For each failure, get the trace
3. Identify commonalities (same endpoint? same error?)
4. Check if database queries are involved
5. Look for timing patterns (time of day? load-related?)

Create a root cause analysis report with:
- What's failing (which operation)
- Why it's failing (error analysis)
- When it fails (pattern analysis)
- How to fix it (recommendation)

Use all Datadog MCP tools available.
```

**Learning goal:** Real-world incident investigation

---

## 📚 Episode 3: RUM - Seeing Through Your Users' Eyes

### 🟢 Beginner Prompt

```markdown
Using Datadog MCP, show me RUM data for the agent-webapp in the last hour.

Questions:
1. How many user sessions?
2. What's the average page load time?
3. Are there any errors users encountered?
4. Which pages are most visited?

Use:
- mcp__datadog-mcp__search_datadog_rum_events (query: "@application.name:agent-webapp")
- Group by event type (session, view, error)
- Calculate statistics
```

**Learning goal:** Basic RUM data exploration

---

### 🟡 Intermediate Prompt

```markdown
Find RUM sessions that had errors in the last 24 hours.

For each error session:
1. Show the error message
2. Find the backend trace (if RUM-APM correlation works)
3. Determine if error was frontend or backend
4. Show user journey (what they did before error)

Use:
- mcp__datadog-mcp__search_datadog_rum_events (query: "@type:error")
- Extract trace IDs from RUM events
- mcp__datadog-mcp__get_datadog_trace for backend correlation
```

**Learning goal:** Frontend-backend error correlation

---

### 🔴 Advanced Prompt

```markdown
Analyze user experience for agent-webapp over the last 7 days.

Create a UX health report:

**Performance Metrics:**
- p50, p95, p99 page load times
- Slowest pages (top 5)
- Resource load times (JS, CSS, images)
- Long tasks (> 50ms)

**Error Analysis:**
- Error rate by page
- Most common errors
- Errors that prevent user actions
- Backend vs frontend error split

**User Behavior:**
- Bounce rate (single-page sessions)
- Average session duration
- Most common user flows
- Drop-off points in conversion funnel

Use:
- mcp__datadog-mcp__search_datadog_rum_events with different filters
- Statistical aggregation
- Trend analysis
```

**Learning goal:** Comprehensive UX analysis

---

### 🏆 Challenge Prompt

```markdown
You're optimizing the agent-webapp for better user experience.

Task: Find the biggest performance bottleneck

Investigation steps:
1. Identify the slowest page/interaction
2. Break down the slowness (network? rendering? backend?)
3. For backend slowness: Get APM trace, find slow span
4. For frontend slowness: Check resource loading, long tasks
5. Estimate impact (how many users affected? revenue impact?)

Deliverable:
- Performance audit report
- Prioritized list of optimizations
- Expected improvement (% faster)
- Implementation difficulty (low/medium/high)

Use all RUM and APM tools available.
```

**Learning goal:** Performance optimization methodology

---

## 📚 Episode 4: Teaching AI to Tell You What It's Thinking

### 🟢 Beginner Prompt

```markdown
Using Datadog MCP, show me LLM Observability data for the burger assistant agent.

Questions:
1. How many AI workflows executed in the last hour?
2. What's the average workflow duration?
3. Which tools does the agent call most often?
4. Are there any failed workflows?

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:agent-api @llmobs.kind:workflow")
- Filter by llmobs-related spans
- Analyze patterns
```

**Learning goal:** Basic LLM Observability exploration

---

### 🟡 Intermediate Prompt

```markdown
Analyze a specific user's conversation with the burger agent.

Pick a session from the last 24 hours and show:
1. All workflow executions in that session
2. What questions the user asked (from input annotations)
3. What answers the agent gave (from output annotations)
4. Which tools were called for each question
5. Total conversation duration

Use:
- mcp__datadog-mcp__search_datadog_spans filtered by session_id
- Extract llmobs annotations
- Build conversation timeline
```

**Learning goal:** Session-level AI workflow analysis

---

### 🔴 Advanced Prompt

```markdown
Performance analysis of the burger assistant agent.

Questions to answer:
1. What's the p95 latency for agent workflows?
2. Which part is slowest: tool loading, LLM call, or tool execution?
3. How does latency change with conversation length?
4. What's the token usage pattern?
5. Cost per conversation (if token count available)

Then optimize:
- Identify bottlenecks
- Suggest caching opportunities
- Recommend prompt improvements

Use:
- mcp__datadog-mcp__search_datadog_spans with @llmobs.* filters
- Statistical analysis
- Cost calculation
```

**Learning goal:** LLM performance optimization

---

### 🏆 Challenge Prompt

```markdown
You're debugging: "Agent gives wrong burger recommendations sometimes"

Investigation:
1. Find workflows where output doesn't match input intent
2. Analyze tool calls - are correct tools being used?
3. Check if MCP communication is working
4. Look for patterns in failures

Create a debugging report:
- What percentage of workflows are "wrong"?
- Common failure modes
- Are failures random or systematic?
- Proposed fixes (prompt engineering? tool improvements?)

Use LLM Obs spans, annotations, and MCP traces.
```

**Learning goal:** AI agent debugging in production

---

## 📚 Episode 5: MCP Deep Dive

### 🟢 Beginner Prompt

```markdown
Show me all MCP tool calls in the last hour.

For each tool:
1. Tool name
2. How many times called
3. Average duration
4. Success rate

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:burger-mcp")
- Group by operation name
- Calculate statistics
```

**Learning goal:** MCP tool usage patterns

---

### 🟡 Intermediate Prompt

```markdown
Analyze the place_order MCP tool performance.

Questions:
1. Average execution time
2. What does it do internally (check spans)
3. Any failures or errors?
4. How often is it called vs get_burgers?
5. Is there a correlation between order size and duration?

Then trace a full flow:
- User question → Agent → MCP tool call → Burger API → Database
- Show all spans in this chain

Use:
- mcp__datadog-mcp__search_datadog_spans
- Filter by tool name
- Follow trace hierarchy
```

**Learning goal:** End-to-end MCP request tracing

---

### 🔴 Advanced Prompt

```markdown
Performance optimization for MCP communication.

Investigate:
1. MCP session lifecycle (creation, reuse, termination)
2. Tool loading performance (how long to load 10 tools?)
3. Network latency between agent-api and burger-mcp
4. Serialization overhead (request/response sizes)

Recommendations:
- Should we cache tool definitions?
- Is session reuse working correctly?
- Can we reduce tool loading time?
- Optimal keep-alive duration?

Use:
- mcp__datadog-mcp__search_datadog_spans for MCP operations
- Analyze session patterns
- Calculate overhead costs
```

**Learning goal:** MCP performance tuning

---

### 🏆 Challenge Prompt

```markdown
Design a new MCP tool and predict its performance.

Task:
1. Analyze existing tools (get_burgers, place_order, etc.)
2. Identify performance patterns:
   - Simple queries: X ms
   - Complex queries: Y ms
   - Database operations: Z ms
3. Design a new tool: "get_order_history" (last 30 orders for user)
4. Predict its performance based on existing patterns
5. Identify potential bottlenecks

Create:
- Tool specification (inputs, outputs)
- Estimated latency (p50, p95)
- Scaling considerations
- Instrumentation strategy

Use MCP and database performance data.
```

**Learning goal:** Performance-aware API design

---

## 📚 Episode 6: Engineer Metrics → Business KPIs

### 🟢 Beginner Prompt

```markdown
Using Datadog MCP, calculate these basic business KPIs for today:

1. Total revenue
2. Number of orders placed
3. Average order value
4. Cancellation rate (%)

Use the burger.* custom metrics we created.

Tools:
- mcp__datadog-mcp__get_datadog_metric
- Queries: burger.revenue.total, burger.order.placed, etc.
```

**Learning goal:** Basic business metric calculation

---

### 🟡 Intermediate Prompt

```markdown
Create a weekly business performance report.

Metrics to calculate (last 7 days):
1. Revenue by day
2. Orders by day
3. Top 5 most ordered burgers
4. Customization rate (% orders with toppings)
5. Average basket size (burgers per order)

Compare to previous week:
- Revenue growth (%)
- Order volume change
- Trending burgers (up or down)

Use:
- mcp__datadog-mcp__get_datadog_metric with time ranges
- burger.* metrics
- Week-over-week comparison
```

**Learning goal:** Trend analysis and reporting

---

### 🔴 Advanced Prompt

```markdown
Build a conversion funnel analysis:

**Funnel stages:**
1. Menu viewed (burger.menu.viewed)
2. Burger viewed (burger.item.viewed)
3. Order placed (burger.order.placed)
4. Order completed (burger.order.status_transition to completed)

Calculate:
- Conversion rate at each stage
- Drop-off points (where do users abandon?)
- Average time between stages
- Funnel efficiency score

Then:
- Identify the weakest stage
- Suggest improvements (based on data)
- Estimate revenue impact of 10% improvement

Use:
- Multiple burger.* metrics
- Funnel analysis methodology
- Business impact modeling
```

**Learning goal:** Conversion optimization

---

### 🏆 Challenge Prompt

```markdown
You're presenting to the CEO tomorrow. Create an executive dashboard.

Requirements:
1. Single-page view
2. Only the most important KPIs (max 6 metrics)
3. Must answer: "Is the business healthy?"
4. Include trends (not just current values)
5. Red/yellow/green indicators

Calculate and visualize:
- Revenue vs target (are we on track?)
- Order volume trend (growing or shrinking?)
- Customer satisfaction proxy (cancellation rate)
- Operational health (queue depth, prep time)

Bonus: Forecast next month's revenue based on trends.

Use all available metrics and your business judgment.
```

**Learning goal:** Executive communication

---

## 📚 Episode 7: The Chef Dashboard

### 🟢 Beginner Prompt

```markdown
Show me the current state of the kitchen queue.

Questions:
1. How many orders are pending?
2. How many in preparation?
3. How many ready for pickup?
4. What's the total active order count?

Use:
- mcp__datadog-mcp__get_datadog_metric
- Queries: burger.queue.pending, burger.queue.in_preparation, etc.
- Get the latest value (gauge metrics)
```

**Learning goal:** Real-time operational metrics

---

### 🟡 Intermediate Prompt

```markdown
Analyze kitchen performance over the last 8 hours.

Create a report showing:
1. Queue depth over time (graph)
2. Peak hours (when was queue highest?)
3. Average prep time per order
4. Throughput (orders completed per hour)
5. Identify any bottlenecks

Recommendations:
- When should we add staff?
- Is current capacity sufficient?
- Any unusual patterns?

Use:
- mcp__datadog-mcp__get_datadog_metric for queue and duration metrics
- Time-series analysis
- Capacity planning
```

**Learning goal:** Operational capacity planning

---

### 🔴 Advanced Prompt

```markdown
Optimize kitchen operations using data.

Investigation:
1. Correlation between queue depth and prep time (do slow times cause queues?)
2. Order complexity impact (more toppings = longer prep?)
3. Time-of-day patterns (lunch rush vs slow periods)
4. Efficiency trends (getting faster or slower over time?)

Deliverable:
- Staffing recommendation (hours/staff needed)
- Process improvements (batching? prioritization?)
- Alert thresholds (when to warn chef)
- Expected impact (% faster, % more capacity)

Use:
- Multiple burger.* metrics
- Statistical correlation analysis
- Operations research principles
```

**Learning goal:** Data-driven process optimization

---

### 🏆 Challenge Prompt

```markdown
Build a predictive model for kitchen capacity.

Given:
- Historical queue depth data
- Order patterns by hour/day
- Prep time distributions

Predict:
1. Queue depth for tomorrow (by hour)
2. When will we hit capacity limits?
3. How many staff needed for Thanksgiving (10x normal orders)?
4. What's the maximum sustainable order rate?

Create:
- Forecasting model
- Capacity planning spreadsheet
- Alerting strategy
- Scaling recommendations

Use historical metrics and statistical modeling.
```

**Learning goal:** Predictive analytics for operations

---

## 📚 Episode 8: Revenue Tracking

### 🟢 Beginner Prompt

```markdown
Calculate revenue metrics for today:

1. Total revenue
2. Number of orders
3. Average order value
4. Revenue lost to cancellations

Use:
- mcp__datadog-mcp__get_datadog_metric
- burger.revenue.total, burger.revenue.lost
- burger.order.placed, burger.order.cancelled
```

**Learning goal:** Basic revenue tracking

---

### 🟡 Intermediate Prompt

```markdown
Revenue analysis for the last 30 days.

Create visualizations showing:
1. Revenue trend (daily)
2. Revenue by day of week (Mon-Sun pattern)
3. Revenue by hour of day (peak hours)
4. Correlation between revenue and order count

Questions:
- Which days are most profitable?
- What's the best time for promotions?
- Is revenue growing or flat?
- What's the revenue forecast for next month?

Use:
- mcp__datadog-mcp__get_datadog_metric with rollups
- Time-series analysis
- Pattern recognition
```

**Learning goal:** Revenue trend analysis

---

### 🔴 Advanced Prompt

```markdown
Build a revenue attribution model.

Analyze:
1. Revenue by burger type (requires span tag analysis)
2. Revenue impact of toppings (addon revenue)
3. Revenue by customer segment (new vs returning)
4. Revenue by traffic source (if available in RUM)

Calculate:
- Which burgers drive the most revenue?
- Is customization (toppings) profitable?
- Customer lifetime value (if repeat data available)
- Most effective acquisition channel

Recommendations:
- Which products to promote?
- Pricing optimization opportunities?
- Customer retention strategies?

Use:
- burger.* metrics
- APM span tags (order.burger_ids, order.topping_count)
- Business modeling
```

**Learning goal:** Revenue optimization strategy

---

### 🏆 Challenge Prompt

```markdown
You're the CFO. Build a complete financial model from observability data.

Metrics to calculate:
**Revenue:**
- Gross revenue (orders placed)
- Net revenue (minus cancellations)
- Revenue by product category

**Costs (estimated):**
- Compute costs (from pod metrics)
- Datadog costs (from trace/metric volume)
- Ingredient costs (from order data)

**Profitability:**
- Gross margin per burger
- Most profitable products
- Break-even order volume

**Forecasting:**
- Revenue forecast (next quarter)
- Growth rate needed to hit targets
- Scenario analysis (best/worst/likely)

Use all available observability data + business assumptions.
```

**Learning goal:** Financial modeling from ops data

---

## 📚 Episode 9: Custom Spans - The Art of Storytelling

### 🟢 Beginner Prompt

```markdown
Show me all custom spans in the burger-api service.

Questions:
1. Which operation names are custom spans? (hint: burger.*)
2. How many custom spans vs automatic spans?
3. What tags are on the custom spans?
4. Average duration of each custom span type

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:burger-api")
- Filter by operation_name pattern
- Identify manual vs automatic spans
```

**Learning goal:** Recognize custom instrumentation

---

### 🟡 Intermediate Prompt

```markdown
Analyze the burger.order.create custom span.

Investigation:
1. What tags are being set? (order.*, etc.)
2. How do these tags help with debugging?
3. Find an order with high value (> $50)
4. Find an order with many toppings (> 5)
5. Show the full trace for a complex order

Questions:
- What insights can we get from span tags?
- How would you query for specific order patterns?
- What additional tags would be valuable?

Use:
- mcp__datadog-mcp__search_datadog_spans
- Filter by custom attributes
- Analyze tag utility
```

**Learning goal:** Effective span tagging

---

### 🔴 Advanced Prompt

```markdown
Design a custom span strategy for a new feature: "Burger recommendations"

Requirements:
- AI suggests burgers based on user preferences
- Calls external nutrition API
- Queries database for allergies
- Returns personalized list

Design:
1. How many custom spans needed?
2. What should each span track?
3. What tags are essential vs nice-to-have?
4. How to handle errors in each component?
5. Performance budget (max latency allowed)

Create:
- Span hierarchy diagram
- Tag specification for each span
- Error handling strategy
- Sample code implementation

Use:
- Patterns from existing burger.* spans
- Best practices from Datadog docs
```

**Learning goal:** Instrumentation architecture

---

### 🏆 Challenge Prompt

```markdown
Audit all custom spans in the project for best practices.

Check each custom span for:
- ✅ Proper resource naming
- ✅ Relevant tags (min 3, max 15)
- ✅ Error tagging (span.setTag('error', error))
- ✅ Proper span lifecycle (try/finally pattern)
- ✅ Business context included

Create:
- Quality score per span (0-100%)
- Issues found and fixes needed
- Best span example (to copy)
- Worst span example (to improve)

Rewrite the worst span using best practices.

Use span analysis and code review methodology.
```

**Learning goal:** Instrumentation code review

---

## 📚 Episode 10: DBM + APM = Query Detective

### 🟢 Beginner Prompt

```markdown
Show me database queries from burger-api in the last hour.

Questions:
1. How many queries executed?
2. What's the average query time?
3. Slowest query (p99)?
4. Any slow queries (> 100ms)?

Use:
- mcp__datadog-mcp__search_datadog_spans (query: "service:burger-api @db.type:postgres")
- Analyze postgres.query spans
- Sort by duration
```

**Learning goal:** Basic database query analysis

---

### 🟡 Intermediate Prompt

```markdown
Find a slow database query and trace it to the source code.

Steps:
1. Find queries with duration > 100ms
2. Get the full APM trace containing that query
3. Identify which API endpoint triggered it
4. Show the complete request flow
5. Determine why it's slow (N+1? missing index? large dataset?)

Recommendations:
- Can this query be optimized?
- Should we add caching?
- Is the slowness acceptable for this endpoint?

Use:
- Database span search
- Trace analysis
- Performance profiling
```

**Learning goal:** Query performance debugging

---

### 🔴 Advanced Prompt

```markdown
Detect N+1 query problems automatically.

Analysis:
1. Find traces with > 10 database queries
2. Identify repetitive query patterns
3. Calculate overhead (time wasted on redundant queries)
4. Show which endpoint/code path has the problem

For the worst N+1:
- Show the inefficient query pattern
- Estimate cost (queries per request × request volume)
- Propose fix (JOIN query or caching)
- Calculate expected improvement

Use:
- APM trace analysis
- Query pattern recognition
- Performance modeling
```

**Learning goal:** Automated performance issue detection

---

### 🏆 Challenge Prompt

```markdown
You're a database consultant. Audit the entire database usage.

Create a database health report:

**Query Patterns:**
- Most frequent queries
- Slowest queries
- Most expensive queries (duration × frequency)
- Queries that should be indexed

**Connection Pool:**
- Pool utilization (from postgres metrics)
- Connection leaks?
- Optimal pool size

**Optimization Opportunities:**
- Queries to rewrite
- Indexes to add
- Caching candidates
- Read replica opportunities

**Cost Analysis:**
- Database CPU usage
- Query cost (RDS/Cloud SQL pricing)
- Optimization ROI

Use all DBM and APM data available.
```

**Learning goal:** Comprehensive database optimization

---

## 📚 Episode 11: Debugging Production - A Detective Story

### 🟢 Beginner Prompt

```markdown
Practice incident investigation workflow:

Scenario: "Users report slow orders"

Steps:
1. Check RUM: Are users experiencing slowness?
2. Check APM: Which service is slow?
3. Check logs: Any errors around slow requests?
4. Check DB: Any slow queries?

Create timeline:
- When did it start?
- How many users affected?
- Is it ongoing?

Use:
- RUM events (page load times)
- APM spans (service latency)
- Logs (errors)
- Systematic investigation
```

**Learning goal:** Incident triage workflow

---

### 🟡 Intermediate Prompt

```markdown
Investigate a past incident: "Orders failed on Nov 8 between 2-3 PM"

Full investigation:
1. Find failed order attempts in logs
2. Get traces for failed requests
3. Identify common error (same error message?)
4. Check if issue was:
   - Code bug?
   - Database connection issue?
   - External API failure?
   - Resource exhaustion?

Create incident report:
- Root cause
- Impact (users/revenue affected)
- Time to detect
- Time to resolve
- Prevention measures

Use historical data and forensic analysis.
```

**Learning goal:** Post-mortem investigation

---

### 🔴 Advanced Prompt

```markdown
Build an anomaly detection system using observability data.

Task:
1. Analyze normal behavior patterns:
   - Baseline latency by endpoint
   - Typical error rate (< 1%?)
   - Normal queue depth (< 5?)
   - Expected request rate

2. Define anomalies:
   - Latency spike (> 2x baseline)
   - Error rate spike (> 5x normal)
   - Queue overflow (> 10)
   - Traffic drop (< 50% normal)

3. For each anomaly type:
   - Detection query
   - Alert threshold
   - Investigation runbook
   - Auto-remediation (if possible)

Create: Anomaly detection spec and alerting strategy.

Use metrics, spans, and statistical analysis.
```

**Learning goal:** Proactive incident prevention

---

### 🏆 Challenge Prompt

```markdown
Simulate and respond to a production incident.

**Incident Simulation:**
"Black Friday sale - 10x normal traffic - system struggling"

Your response:
1. Real-time assessment (what's failing? why?)
2. Impact analysis (revenue at risk?)
3. Immediate mitigation (scale? disable feature?)
4. Communication (status page update)
5. Post-incident review

Use observability data to:
- Identify bottleneck (DB? API? Queue depth?)
- Predict breaking point
- Recommend scaling strategy
- Create war room dashboard

Deliverable: Complete incident response plan.
```

**Learning goal:** High-pressure incident management

---

## 📚 Episode 12: Dashboards Your CEO Will Love

### 🟢 Beginner Prompt

```markdown
Help me create a simple executive dashboard.

Requirements:
- Revenue today
- Orders today
- Active customers
- System health (up/down)

For each metric:
- Give me the exact Datadog query
- Suggest widget type (query_value, timeseries, etc.)
- Explain what it means in business terms

Use burger.* metrics to build this.
```

**Learning goal:** Basic dashboard creation

---

### 🟡 Intermediate Prompt

```markdown
Design three dashboards for different stakeholders:

1. **Store Owner Dashboard**
   - Focus: Revenue, profitability
   - Metrics: 5-6 key numbers
   - Timeframe: Today + trends

2. **Chef Dashboard**
   - Focus: Operations, queue
   - Metrics: Real-time status
   - Alerts: Queue overflow

3. **Marketing Dashboard**
   - Focus: Engagement, conversion
   - Metrics: Funnel analysis
   - Insights: Product performance

For each dashboard:
- List exact metrics
- Suggest visualizations
- Define success criteria

Use our business-dashboards.md guide as reference.
```

**Learning goal:** Stakeholder-specific dashboards

---

### 🔴 Advanced Prompt

```markdown
Create a mobile-optimized executive dashboard.

Constraints:
- Must fit on phone screen
- Max 4 widgets
- Updates every 60 seconds
- No scrolling needed

Design decisions:
1. Which 4 metrics matter MOST?
2. How to visualize on small screen?
3. When to alert vs just inform?
4. Mobile-friendly color schemes

Then:
- Build dashboard JSON
- Test on mobile viewport
- Get feedback from stakeholders

Bonus: Dark mode version.
```

**Learning goal:** Mobile dashboard design

---

### 🏆 Challenge Prompt

```markdown
You're presenting to investors. Build a "Company Health" dashboard.

Show:
1. Growth metrics (MoM, YoY)
2. Unit economics (revenue per order, costs)
3. Customer metrics (acquisition, retention, LTV)
4. Operational efficiency (automation rate)
5. Competitive position (if comparable data exists)

Each metric needs:
- Current value
- Trend (up/down arrow)
- Context (vs target, vs last period)
- Visual indicator (green/yellow/red)

Create investor-grade presentation dashboard.

Use all available metrics + business acumen.
```

**Learning goal:** Investor-grade reporting

---

## 🎯 How to Use These Prompts

### **1. Choose Your Level**
- New to Datadog? Start with 🟢 Beginner prompts
- Comfortable with basics? Try 🟡 Intermediate
- Want a challenge? Go for 🔴 Advanced or 🏆 Challenge

### **2. Set Up Claude Code + Datadog MCP**
```bash
# Install Claude Code
# Configure Datadog MCP server with your API key
# Verify connection: Ask Claude "Show me my Datadog services"
```

### **3. Copy-Paste-Explore**
- Copy any prompt from this guide
- Paste into Claude Code
- Let Claude + Datadog MCP do the investigation
- Learn from the results!

### **4. Customize for Your Use Case**
- Replace "burger-api" with your service name
- Adjust time ranges (last hour → last week)
- Add your own business metrics
- Ask follow-up questions!

---

## 💡 Prompt Engineering Tips

### **Make Prompts More Effective:**

**1. Be Specific**
```
❌ "Show me metrics"
✅ "Show me burger.order.placed metric for the last 7 days, grouped by environment"
```

**2. Ask for Analysis, Not Just Data**
```
❌ "Get logs"
✅ "Get error logs and explain the top 3 patterns causing failures"
```

**3. Request Actionable Output**
```
❌ "Find slow queries"
✅ "Find slow queries, rank by impact, and recommend which 2 to optimize first"
```

**4. Combine Multiple Tools**
```
✅ "Find errors in logs, get their traces, show me the slow spans, then check related database queries"
```

---

## 📚 More Prompts by Use Case

### **Daily Operations**
```markdown
Create my daily ops report:
- Any incidents in last 24h?
- Performance vs yesterday (better/worse?)
- Top 3 issues to investigate
- Green/yellow/red health score

Use all monitoring data sources.
```

### **Weekly Review**
```markdown
Weekly business review for engineering team:
- Deployment frequency
- Error rate trend
- Performance improvements (or regressions)
- New issues introduced
- Infrastructure costs

Compare to last week.
```

### **Release Validation**
```markdown
We just deployed version X. Validate the release:
- Compare metrics before/after deployment
- Any new errors introduced?
- Performance impact (faster/slower?)
- User experience change (from RUM)
- Rollback recommendation (yes/no?)

Give go/no-go decision with evidence.
```

---

## 🎓 Learning Path

**Suggested progression:**

**Week 1:** Episode 1 prompts (SSI)
- Master Beginner prompts
- Try 1-2 Intermediate prompts

**Week 2:** Episode 2 prompts (Logs)
- Focus on correlation techniques
- Practice debugging with logs+traces

**Week 3:** Episode 3 prompts (RUM)
- Understand user experience data
- Connect frontend to backend

**Week 4:** Episode 4-5 prompts (AI)
- LLM Observability patterns
- MCP debugging

**Week 5:** Episode 6-8 prompts (Business)
- Business metric mastery
- Dashboard creation

**Week 6:** Episode 9-12 prompts (Advanced)
- Custom instrumentation
- Advanced techniques

**By Week 6:** You can answer ANY observability question using AI + Datadog MCP!

---

## 🤝 Community Prompts

**Share your own prompts!**

If you create useful prompts, share them:
1. Fork the repo
2. Add to this file
3. Submit PR
4. Tag `#BitsLearnToBites`

We'll feature the best community prompts!

---

## 📖 Additional Resources

**Datadog MCP Documentation:**
- [Setup Guide](https://docs.datadoghq.com/bits_ai/mcp_server/)
- [Available Tools](https://docs.datadoghq.com/bits_ai/mcp_server/#tools)

**Claude Code:**
- [Getting Started](https://docs.claude.com/claude-code)
- [MCP Integration](https://docs.claude.com/claude-code/mcp)

**Prompt Engineering:**
- [Anthropic Prompt Library](https://docs.anthropic.com/claude/prompt-library)

---

**Last Updated:** November 9, 2025
**Maintained by:** Bits Learn to Bites Community

---

**⬅️ [Back to Series Index](./index.md)**
