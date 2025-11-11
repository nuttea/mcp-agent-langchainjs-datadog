# Business Dashboards for Contoso Burgers

This guide describes the business dashboards powered by custom APM spans and metrics implemented in the burger-api service.

## Overview

The application now emits **custom business metrics** and **enriched APM spans** that provide visibility into:
- Revenue and order volumes
- Menu performance and popularity
- Kitchen operations and queue depth
- Customer behavior and preferences

These metrics power three primary dashboards for different stakeholders.

---

## 📊 Dashboard 1: Store Owner Dashboard

**Purpose:** Revenue tracking, business performance, operational efficiency

### Key Metrics

#### Revenue & Orders
```
# Total Revenue (Today)
sum:burger.revenue.total{env:prod,source:order_placed}.as_count()

# Revenue Trend (7 days)
sum:burger.revenue.total{env:prod}.rollup(sum, 86400)

# Orders Placed (Total)
sum:burger.order.placed{env:prod}.as_count()

# Average Order Value
avg:burger.order.value{env:prod}

# Cancellation Rate
(sum:burger.order.cancelled{env:prod}.as_count() / sum:burger.order.placed{env:prod}.as_count()) * 100
```

#### Popular Burgers
```
# Top 5 Most Ordered Burgers
top(sum:burger.item.ordered{env:prod} by {burger_id}.as_count(), 5, 'mean', 'desc')

# Revenue by Burger (requires APM span analysis)
# Query: service:burger-api operation_name:burger.order.create
# Group by: order.burger_ids tag
# Aggregate: Sum of order.total_price
```

#### Operational Metrics
```
# Total Active Orders
burger.queue.total_active{env:prod}

# Average Completion Time (Pending → Completed)
avg:burger.order.status_duration{env:prod,from_status:pending}

# Order Fulfillment Rate
(sum:burger.order.placed{env:prod}.as_count() - sum:burger.order.cancelled{env:prod}.as_count()) / sum:burger.order.placed{env:prod}.as_count()
```

### Recommended Widgets

1. **Revenue Timeseries** (Line graph)
   - Metric: `burger.revenue.total`
   - Rollup: Daily sum
   - Comparison: Week over week

2. **Orders Funnel** (Query value)
   - Menu Views → Orders Placed → Orders Completed

3. **Top Burgers Table** (Top List)
   - Metric: `burger.item.ordered`
   - Group by: `burger_id`

4. **Active Orders Gauge** (Query value)
   - Metric: `burger.queue.total_active`

---

## 👨‍🍳 Dashboard 2: Chef Dashboard

**Purpose:** Kitchen operations, queue management, preparation efficiency

### Key Metrics

#### Live Queue Status
```
# Pending Orders (needs to start cooking)
burger.queue.pending{env:prod}

# In Preparation (currently cooking)
burger.queue.in_preparation{env:prod}

# Ready for Pickup
burger.queue.ready{env:prod}

# Total Active (all non-completed orders)
burger.queue.total_active{env:prod}
```

#### Kitchen Performance
```
# Orders per Hour (throughput)
rate(sum:burger.order.placed{env:prod})

# Average Burgers per Order (capacity planning)
avg:burger.order.burger_count{env:prod}

# Average Prep Time (Pending → Ready)
avg:burger.order.status_duration{env:prod,from_status:pending,to_status:ready}

# Average Customization (toppings per order)
avg:burger.order.topping_count{env:prod}
```

#### Alerts
```
# High Queue Alert
burger.queue.total_active{env:prod} > 10

# Slow Prep Time Alert
avg:burger.order.status_duration{env:prod,from_status:pending,to_status:in_preparation} > 300 (5 minutes)

# Long Wait Alert
avg:burger.order.status_duration{env:prod,from_status:in_preparation,to_status:ready} > 900 (15 minutes)
```

### Recommended Widgets

1. **Queue Depth Heatmap** (Timeseries)
   - Metrics: `burger.queue.pending`, `burger.queue.in_preparation`, `burger.queue.ready`
   - Stacked area chart

2. **Order Throughput** (Query value)
   - Metric: `rate(burger.order.placed)`
   - Display: Orders/hour

3. **Prep Time Distribution** (Histogram)
   - Metric: `burger.order.status_duration`
   - Filter: `from_status:pending,to_status:ready`

4. **Complexity Meter** (Query value)
   - Metric: `avg:burger.order.topping_count`

---

## 📈 Dashboard 3: Marketing Dashboard

**Purpose:** Customer engagement, product performance, conversion tracking

### Key Metrics

#### Customer Engagement
```
# Menu Views (Total)
sum:burger.menu.viewed{env:prod}.as_count()

# Conversion Rate
(sum:burger.order.placed{env:prod}.as_count() / sum:burger.menu.viewed{env:prod}.as_count()) * 100

# Agent Interactions
sum:burger.agent.interaction{env:prod} by {action}.as_count()

# Repeat Order Rate
# Requires: Count of unique user_hash with > 1 order
# Query APM spans: service:burger-api operation_name:burger.order.create
# Aggregate: unique_count(order.user_hash) where order_count > 1
```

#### Product Performance
```
# Most Viewed Burgers
top(sum:burger.item.viewed{env:prod} by {burger_id}.as_count(), 10, 'mean', 'desc')

# Most Ordered Burgers
top(sum:burger.item.ordered{env:prod} by {burger_id}.as_count(), 10, 'mean', 'desc')

# View-to-Order Conversion by Burger
sum:burger.item.ordered{*} by {burger_id} / sum:burger.item.viewed{*} by {burger_id}

# Popular Toppings
top(sum:burger.toppings.viewed{env:prod} by {category}.as_count(), 5, 'mean', 'desc')

# Customization Rate
(sum:burger.order.placed{env:prod,has_toppings:true}.as_count() / sum:burger.order.placed{env:prod}.as_count()) * 100
```

#### Revenue Analysis
```
# Revenue by Hour of Day
sum:burger.revenue.total{env:prod}.rollup(sum, 3600)

# Revenue by Day of Week
sum:burger.revenue.total{env:prod}.rollup(sum, 86400)

# Average Basket Size
avg:burger.order.burger_count{env:prod}

# Lost Revenue (Cancellations)
sum:burger.revenue.lost{env:prod,reason:cancellation}.as_count()
```

### Recommended Widgets

1. **Engagement Funnel** (Funnel widget)
   - Steps: Menu Views → Burger Views → Orders Placed → Orders Completed

2. **Product Popularity Matrix** (Table)
   - Columns: Burger Name, Views, Orders, Conversion %
   - Sort by: Orders (descending)

3. **Revenue Heatmap** (Timeseries)
   - Metric: `burger.revenue.total`
   - Group by: Hour of day
   - View: Last 7 days

4. **Customization Trends** (Pie chart)
   - Metric: `burger.order.placed`
   - Group by: `has_toppings` tag

---

## 🔍 APM Span Tags Reference

### Order Creation Span: `burger.order.create`

**Tags:**
- `order.id` - Unique order identifier
- `order.user_hash` - Anonymized user ID (first 8 chars)
- `order.total_price` - Order value in currency
- `order.burger_count` - Number of burgers in order
- `order.topping_count` - Total extra toppings
- `order.items` - Number of line items
- `order.estimated_minutes` - Prep time estimate
- `order.has_nickname` - Whether customer provided nickname
- `order.burger_ids` - Comma-separated burger IDs
- `order.status` - Always "created" for this span

**Query Examples:**
```
# High-value orders (> $50)
service:burger-api operation_name:burger.order.create @order.total_price:>50

# Large orders (> 5 burgers)
service:burger-api operation_name:burger.order.create @order.burger_count:>5

# Orders with toppings
service:burger-api operation_name:burger.order.create @order.topping_count:>0
```

### Order Cancellation Span: `burger.order.cancel`

**Tags:**
- `order.id` - Order being cancelled
- `order.user_hash` - User who cancelled
- `order.status_before` - Status at time of cancellation
- `order.value` - Value of cancelled order
- `order.age_minutes` - How long since order was placed
- `cancel.result` - Result: `success`, `not_found`, `invalid_status`, `failed`

**Query Examples:**
```
# Recent cancellations
service:burger-api operation_name:burger.order.cancel @cancel.result:success

# Cancellations of high-value orders
service:burger-api operation_name:burger.order.cancel @order.value:>30

# Quick cancellations (customer changed mind)
service:burger-api operation_name:burger.order.cancel @order.age_minutes:<2
```

### Status Update Worker Span: `burger.orders.status_update_worker`

**Tags:**
- `worker.total_orders` - All orders in system
- `worker.queue.pending` - Orders waiting to cook
- `worker.queue.in_preparation` - Orders being cooked
- `worker.queue.ready` - Orders ready for pickup
- `worker.updates_attempted` - Status transitions attempted
- `worker.updates_success` - Successful transitions
- `worker.updates_failed` - Failed transitions
- `worker.elapsed_ms` - Worker execution time
- `worker.transitions.pending_to_prep` - Count
- `worker.transitions.prep_to_ready` - Count
- `worker.transitions.ready_to_completed` - Count

---

## 📐 Metrics Reference

### Count Metrics (Use `.as_count()`)

| Metric | Description | Tags |
|--------|-------------|------|
| `burger.order.placed` | Orders created | `env`, `has_nickname`, `has_toppings` |
| `burger.order.cancelled` | Orders cancelled | `env`, `cancelled_from_status` |
| `burger.order.status_transition` | Status changes | `env`, `from_status`, `to_status` |
| `burger.menu.viewed` | Menu browsing | `env` |
| `burger.item.viewed` | Individual burger views | `env`, `burger_id` |
| `burger.item.ordered` | Burger orders | `env`, `burger_id` |
| `burger.toppings.viewed` | Toppings catalog views | `env`, `category` |
| `burger.agent.interaction` | AI assistant actions | `env`, `action`, `success` |
| `mcp.tool.called` | MCP tool invocations | `env`, `tool_name`, `status` |

### Distribution Metrics (Use `avg`, `p50`, `p95`, etc.)

| Metric | Description | Unit | Tags |
|--------|-------------|------|------|
| `burger.order.value` | Order prices | Currency | `env` |
| `burger.order.burger_count` | Burgers per order | Count | `env` |
| `burger.order.topping_count` | Toppings per order | Count | `env` |
| `burger.order.status_duration` | Time in each status | Seconds | `env`, `from_status`, `to_status` |
| `burger.order.cancelled_value` | Cancelled order values | Currency | `env` |
| `burger.order.cancelled_age_minutes` | Age when cancelled | Minutes | `env` |
| `mcp.tool.duration` | Tool execution time | Milliseconds | `env`, `tool_name` |

### Gauge Metrics (Current value)

| Metric | Description | Tags |
|--------|-------------|------|
| `burger.queue.pending` | Orders in pending status | `env` |
| `burger.queue.in_preparation` | Orders being prepared | `env` |
| `burger.queue.ready` | Orders ready for pickup | `env` |
| `burger.queue.total_active` | All non-completed orders | `env` |
| `burger.orders.completed_today` | Completed count | `env` |
| `burger.orders.cancelled_today` | Cancelled count | `env` |

### Revenue Metrics (Special - increment by amount)

| Metric | Description | Tags |
|--------|-------------|------|
| `burger.revenue.total` | Revenue earned | `env`, `source` (order_placed/order_completed) |
| `burger.revenue.lost` | Revenue lost | `env`, `reason` (cancellation) |

---

## 🎨 Sample Dashboard JSON

### Store Owner Dashboard

```json
{
  "title": "Contoso Burgers - Store Owner Dashboard",
  "widgets": [
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "sum:burger.revenue.total{env:prod,source:order_placed}.as_count()",
            "aggregator": "sum"
          }
        ],
        "title": "Revenue Today",
        "precision": 2
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:burger.revenue.total{env:prod}.rollup(sum, 86400)",
            "display_type": "bars"
          }
        ],
        "title": "Revenue Trend (7 Days)"
      }
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "avg:burger.order.value{env:prod}",
            "aggregator": "avg"
          }
        ],
        "title": "Average Order Value",
        "precision": 2
      }
    },
    {
      "definition": {
        "type": "toplist",
        "requests": [
          {
            "q": "top(sum:burger.item.ordered{env:prod} by {burger_id}.as_count(), 5, 'mean', 'desc')"
          }
        ],
        "title": "Top 5 Burgers by Orders"
      }
    }
  ]
}
```

### Chef Dashboard

```json
{
  "title": "Contoso Burgers - Kitchen Operations",
  "widgets": [
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "burger.queue.total_active{env:prod}",
            "aggregator": "last"
          }
        ],
        "title": "Active Orders",
        "autoscale": true
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "burger.queue.pending{env:prod}",
            "display_type": "area",
            "style": {
              "palette": "warm"
            }
          },
          {
            "q": "burger.queue.in_preparation{env:prod}",
            "display_type": "area",
            "style": {
              "palette": "cool"
            }
          },
          {
            "q": "burger.queue.ready{env:prod}",
            "display_type": "area",
            "style": {
              "palette": "green"
            }
          }
        ],
        "title": "Queue Depth Over Time"
      }
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "avg:burger.order.status_duration{env:prod,from_status:pending,to_status:in_preparation}",
            "aggregator": "avg"
          }
        ],
        "title": "Avg Time to Start Cooking (seconds)",
        "precision": 1
      }
    },
    {
      "definition": {
        "type": "distribution",
        "requests": [
          {
            "q": "avg:burger.order.topping_count{env:prod}"
          }
        ],
        "title": "Order Complexity Distribution"
      }
    }
  ]
}
```

---

## 🚨 Recommended Monitors

### Store Owner Alerts

```yaml
# High Cancellation Rate
Alert when: (burger.order.cancelled / burger.order.placed) > 0.15 (15%)
Message: "Cancellation rate is unusually high. Check for service issues."

# Low Revenue
Alert when: sum:burger.revenue.total{env:prod}.rollup(sum, 3600) < $100 during business hours
Message: "Hourly revenue below $100. Investigate customer traffic."

# No Orders
Alert when: sum:burger.order.placed{env:prod}.rollup(sum, 1800) == 0 for 30 minutes
Message: "No orders placed in 30 minutes. System may be down."
```

### Chef Alerts

```yaml
# High Queue Depth
Alert when: burger.queue.total_active > 10
Message: "Queue depth exceeds 10 orders. Consider additional kitchen staff."

# Slow Prep Time
Alert when: avg:burger.order.status_duration{from_status:pending,to_status:ready} > 1200 (20 min)
Message: "Average prep time exceeding 20 minutes. Check kitchen capacity."

# Orders Stuck in Ready
Alert when: burger.queue.ready > 5 for 10 minutes
Message: "5+ orders ready for pickup but not collected. Check customer notifications."
```

### Marketing Alerts

```yaml
# Low Conversion Rate
Alert when: (burger.order.placed / burger.menu.viewed) < 0.05 (5%)
Message: "Menu view-to-order conversion below 5%. Review pricing/promotions."

# Menu Not Viewed
Alert when: sum:burger.menu.viewed{env:prod}.rollup(sum, 1800) == 0 for 30 minutes
Message: "No menu activity in 30 minutes. Check webapp availability."
```

---

## 🛠️ Implementation Details

### Code Locations

- **Metrics Class:** [packages/burger-api/src/metrics.ts](../../packages/burger-api/src/metrics.ts)
- **Order Spans:** [packages/burger-api/src/express-server.ts:327-509](../../packages/burger-api/src/express-server.ts#L327-L509)
- **Menu Spans:** [packages/burger-api/src/express-server.ts:120-177](../../packages/burger-api/src/express-server.ts#L120-L177)
- **Worker Spans:** [packages/burger-api/src/express-server.ts:648-786](../../packages/burger-api/src/express-server.ts#L648-L786)

### Span Naming Convention

All custom business spans use the pattern: `burger.<domain>.<action>`

- `burger.order.create` - Order placement
- `burger.order.cancel` - Order cancellation
- `burger.menu.browse` - Menu browsing
- `burger.orders.status_update_worker` - Background job

### Metric Naming Convention

All custom metrics use the pattern: `burger.<domain>.<metric_name>`

- **Domain:** `order`, `menu`, `queue`, `revenue`, `agent`, `item`, `toppings`
- **Type:** Inferred from metric type (increment, histogram, gauge)

---

## 📊 How to Create Dashboards in Datadog

### Option 1: Datadog UI

1. Navigate to **Dashboards** → **New Dashboard**
2. Choose **Timeboard** or **Screenboard**
3. Add widgets using the metrics listed above
4. Use **Template Variables** for environment filtering

### Option 2: Terraform (Infrastructure as Code)

```hcl
resource "datadog_dashboard_json" "store_owner_dashboard" {
  dashboard = file("${path.module}/dashboards/store-owner.json")
}
```

### Option 3: API

```bash
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @store-owner-dashboard.json
```

---

## 🎯 Expected Business Value

### For Store Owner
- **Revenue Visibility:** Real-time and historical revenue tracking
- **Trend Analysis:** Week-over-week, day-over-day comparisons
- **Product Insights:** Which burgers drive the most revenue
- **Operational Alerts:** Immediate notification of issues

### For Chef Team
- **Queue Management:** Never lose track of order volume
- **Capacity Planning:** Understand peak hours and staffing needs
- **Efficiency Metrics:** Track prep time improvements
- **Proactive Alerts:** Get warned before queue gets overwhelming

### For Marketing Team
- **Campaign Effectiveness:** Track conversion rates and customer engagement
- **Product Strategy:** Data-driven menu optimization
- **Customer Behavior:** Understand preferences and patterns
- **A/B Testing:** Compare performance across different promotions

---

## 📚 Related Documentation

- [Datadog Custom Metrics Guide](https://docs.datadoghq.com/metrics/custom_metrics/)
- [APM Custom Instrumentation](https://docs.datadoghq.com/tracing/trace_collection/custom_instrumentation/nodejs/)
- [Creating Dashboards](https://docs.datadoghq.com/dashboards/)
- [Setting up Monitors](https://docs.datadoghq.com/monitors/)

---

## 🧪 Testing the Metrics

### Verify Metrics are Flowing

```bash
# Check if metrics are being emitted (wait 60 seconds after deployment)
# In Datadog UI: Metrics Explorer
# Search for: burger.*

# Or use Datadog API
curl "https://api.datadoghq.com/api/v1/metrics?from=$(date -u -d '1 hour ago' +%s)&prefix=burger" \
  -H "DD-API-KEY: ${DD_API_KEY}"
```

### Generate Test Data

```bash
# Place test order
curl -X POST https://burger-api-dev.platform-engineering-demo.dev/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","items":[{"burgerId":"burger-01","quantity":2,"extraToppingIds":["topping-01"]}]}'

# Browse menu
curl https://burger-api-dev.platform-engineering-demo.dev/api/burgers

# Cancel order
curl -X DELETE "https://burger-api-dev.platform-engineering-demo.dev/api/orders/ORDER_ID?userId=test-user"
```

### Check APM Spans

In Datadog UI:
1. Go to **APM** → **Traces**
2. Search: `service:burger-api operation_name:burger.order.create`
3. Click on a trace to see span tags
4. Verify all business tags are present

---

## 🎓 Best Practices

1. **Consistent Tagging:** Use the same tag names across spans and metrics
2. **Environment Filtering:** Always include `env` tag for dev/prod separation
3. **Cost Management:** Use sampling for high-volume metrics if needed
4. **Data Privacy:** Hash or truncate PII (user IDs, emails)
5. **Cardinality:** Limit unique tag values (e.g., burger_id, not burger_name)
6. **Documentation:** Keep this guide updated as metrics evolve

---

**Last Updated:** 2025-11-09
**Maintained by:** Bits Burger Store Team
