import { metrics } from 'dd-trace';

/**
 * Business metrics for Burger API
 * These metrics power dashboards for Store Owners, Chefs, and Marketing teams
 *
 * SSI (Single Step Instrumentation) automatically handles APM tracing.
 * This file adds custom business metrics for dashboards and alerting.
 */
export class BurgerMetrics {
  private static env = process.env.DD_ENV || 'dev';

  /**
   * Record a new order placement
   * Used by: Store Owner (revenue), Chef (queue), Marketing (conversion)
   */
  static recordOrderPlaced(order: {
    totalPrice: number;
    burgerCount: number;
    toppingCount: number;
    hasNickname: boolean;
    burgerIds: string[];
  }) {
    // Count metric: Total orders placed
    metrics.increment('burger.order.placed', 1, {
      env: this.env,
      has_nickname: order.hasNickname ? 'true' : 'false',
      has_toppings: order.toppingCount > 0 ? 'true' : 'false',
    });

    // Distribution metric: Order value (for revenue tracking)
    metrics.histogram('burger.order.value', order.totalPrice, {
      env: this.env,
    });

    // Distribution metric: Burgers per order (for kitchen capacity planning)
    metrics.histogram('burger.order.burger_count', order.burgerCount, {
      env: this.env,
    });

    // Distribution metric: Toppings per order (for inventory management)
    metrics.histogram('burger.order.topping_count', order.toppingCount, {
      env: this.env,
    });

    // Track individual burger popularity
    for (const burgerId of order.burgerIds) {
      metrics.increment('burger.item.ordered', 1, {
        env: this.env,
        burger_id: burgerId,
      });
    }

    // Revenue tracking
    metrics.increment('burger.revenue.total', order.totalPrice, {
      env: this.env,
      source: 'order_placed',
    });
  }

  /**
   * Record order status transitions
   * Used by: Chef (prep time), Store Owner (efficiency)
   */
  static recordOrderStatusTransition(
    from: string,
    to: string,
    durationMinutes?: number
  ) {
    metrics.increment('burger.order.status_transition', 1, {
      env: this.env,
      from_status: from,
      to_status: to,
    });

    if (durationMinutes !== undefined) {
      metrics.histogram('burger.order.status_duration', durationMinutes * 60, {
        env: this.env,
        from_status: from,
        to_status: to,
      });
    }
  }

  /**
   * Record order cancellation
   * Used by: Store Owner (lost revenue), Marketing (churn analysis)
   */
  static recordOrderCancelled(
    status: string,
    orderValue: number,
    ageMinutes: number
  ) {
    metrics.increment('burger.order.cancelled', 1, {
      env: this.env,
      cancelled_from_status: status,
    });

    metrics.histogram('burger.order.cancelled_value', orderValue, {
      env: this.env,
    });

    metrics.histogram('burger.order.cancelled_age_minutes', ageMinutes, {
      env: this.env,
    });

    // Track lost revenue
    metrics.increment('burger.revenue.lost', orderValue, {
      env: this.env,
      reason: 'cancellation',
    });
  }

  /**
   * Record menu browsing
   * Used by: Marketing (engagement), Store Owner (traffic)
   */
  static recordMenuViewed() {
    metrics.increment('burger.menu.viewed', 1, {
      env: this.env,
    });
  }

  /**
   * Record individual burger view
   * Used by: Marketing (product interest)
   */
  static recordBurgerViewed(burgerId: string) {
    metrics.increment('burger.item.viewed', 1, {
      env: this.env,
      burger_id: burgerId,
    });
  }

  /**
   * Record toppings catalog view
   * Used by: Marketing (customization interest)
   */
  static recordToppingsViewed(category?: string) {
    metrics.increment('burger.toppings.viewed', 1, {
      env: this.env,
      category: category || 'all',
    });
  }

  /**
   * Record queue depth (called by status update worker)
   * Used by: Chef (capacity planning), Store Owner (staffing)
   */
  static recordQueueDepth(queueStats: {
    pending: number;
    inPreparation: number;
    ready: number;
    completed: number;
    cancelled: number;
  }) {
    metrics.gauge('burger.queue.pending', queueStats.pending, {
      env: this.env,
    });

    metrics.gauge('burger.queue.in_preparation', queueStats.inPreparation, {
      env: this.env,
    });

    metrics.gauge('burger.queue.ready', queueStats.ready, {
      env: this.env,
    });

    const totalActive = queueStats.pending + queueStats.inPreparation + queueStats.ready;
    metrics.gauge('burger.queue.total_active', totalActive, {
      env: this.env,
    });

    // Historical counters
    metrics.gauge('burger.orders.completed_today', queueStats.completed, {
      env: this.env,
    });

    metrics.gauge('burger.orders.cancelled_today', queueStats.cancelled, {
      env: this.env,
    });
  }

  /**
   * Record agent interaction (AI assistant actions)
   * Used by: Marketing (AI adoption), Store Owner (automation ROI)
   */
  static recordAgentInteraction(action: string, success: boolean) {
    metrics.increment('burger.agent.interaction', 1, {
      env: this.env,
      action,
      success: success ? 'true' : 'false',
    });
  }

  /**
   * Record MCP tool execution
   * Used by: Engineering (MCP performance), Store Owner (system health)
   */
  static recordMcpToolCall(toolName: string, durationMs: number, success: boolean) {
    metrics.increment('mcp.tool.called', 1, {
      env: this.env,
      tool_name: toolName,
      status: success ? 'success' : 'error',
    });

    metrics.histogram('mcp.tool.duration', durationMs, {
      env: this.env,
      tool_name: toolName,
    });
  }
}
