import express, { type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { DbService } from './db-service.js';
import { BlobService } from './blob-service.js';
import { ToppingCategory } from './topping.js';
import { OrderStatus, type OrderItem } from './order.js';
import { featureFlags } from './feature-flags.js';
import { logger } from './logger.js';
import tracer from 'dd-trace';
import { BurgerMetrics } from './metrics.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get the base URL for constructing image URLs
// Prefers PUBLIC_BASE_URL environment variable, falls back to request host
function getBaseUrl(req: Request): string {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// Helper function to transform burger image URLs
function transformBurgerImageUrl(burger: any, baseUrl: string) {
  return {
    ...burger,
    imageUrl: `${baseUrl}/api/images/${burger.imageUrl}`,
  };
}

// 🚨 PERFORMANCE ISSUE: CPU Blocking Helper
// Inject synchronous blocking operations when feature flag is enabled
function injectCpuBlockingIfEnabled() {
  if (featureFlags.shouldAddCpuBlocking()) {
    const duration = featureFlags.getCpuBlockingDuration();
    logger.warn({ duration }, '⚠️  Injecting CPU blocking: synchronous operation');

    // Intentionally block the event loop with CPU-intensive work
    const start = Date.now();
    let result = 0;

    // Perform useless computation to burn CPU cycles
    while (Date.now() - start < duration) {
      // Fibonacci-like calculation to keep CPU busy
      result += Math.sqrt(Math.random() * 1000000);
    }

    // Force the result to be used (prevent optimization)
    if (result < 0) logger.debug({ result }, 'CPU blocking result');
  }
}

// Routes

// Health check (root endpoint)
app.get('/', async (_req: Request, res: Response) => {
  try {
    const dataService = await DbService.getInstance();
    const orders = await dataService.getOrders();
    const registeredUsers = await dataService.getRegisteredUsers();

    // Count active orders (orders that are not completed or cancelled)
    const activeOrders = orders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );

    res.status(200).json({
      status: 'up',
      activeOrders: activeOrders.length,
      totalOrders: orders.length,
      registeredUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error processing server status request');
    res.status(200).json({
      status: 'up',
      error: 'Error retrieving order information',
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check (/api endpoint)
app.get('/api', async (_req: Request, res: Response) => {
  try {
    const dataService = await DbService.getInstance();
    const orders = await dataService.getOrders();
    const registeredUsers = await dataService.getRegisteredUsers();

    // Count active orders (orders that are not completed or cancelled)
    const activeOrders = orders.filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled',
    );

    res.status(200).json({
      status: 'up',
      activeOrders: activeOrders.length,
      totalOrders: orders.length,
      registeredUsers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error processing server status request');
    res.status(200).json({
      status: 'up',
      error: 'Error retrieving order information',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get all burgers
app.get('/api/burgers', async (req: Request, res: Response) => {
  const span = tracer.startSpan('burger.menu.browse');
  span.setTag('resource.name', 'get_all_burgers');

  try {
    // Inject CPU blocking if feature flag is enabled
    injectCpuBlockingIfEnabled();

    const dataService = await DbService.getInstance();
    const burgers = await dataService.getBurgers();

    // Tag span with menu metrics
    span.setTag('menu.burger_count', burgers.length);
    const totalMenuValue = burgers.reduce((sum, b) => sum + b.price, 0);
    span.setTag('menu.total_value', totalMenuValue);

    // Record menu view metric
    BurgerMetrics.recordMenuViewed();

    const baseUrl = getBaseUrl(req);
    const burgersWithFullUrls = burgers.map((burger) =>
      transformBurgerImageUrl(burger, baseUrl)
    );

    res.json(burgersWithFullUrls);
  } catch (error) {
    span.setTag('error', error);
    logger.error({ err: error }, 'Error getting burgers');
    res.status(500).json({ error: 'Failed to get burgers' });
  } finally {
    span.finish();
  }
});

// Get burger by ID
app.get('/api/burgers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dataService = await DbService.getInstance();
    const burger = await dataService.getBurger(id);

    if (!burger) {
      res.status(404).json({ message: 'Burger not found' });
      return;
    }

    // Record burger view for popularity tracking
    BurgerMetrics.recordBurgerViewed(burger.id);

    const baseUrl = getBaseUrl(req);
    const burgerWithFullUrl = transformBurgerImageUrl(burger, baseUrl);

    res.json(burgerWithFullUrl);
  } catch (error) {
    logger.error({ err: error }, 'Error getting burger');
    res.status(500).json({ error: 'Failed to get burger' });
  }
});

// Helper function to transform topping imageUrl with full URL
function transformToppingImageUrl(topping: any, baseUrl: string) {
  return {
    ...topping,
    imageUrl: `${baseUrl}/api/images/${topping.imageUrl}`,
  };
}

// Get topping categories - implements the same logic as topping-categories-get Azure Function
app.get('/api/toppings/categories', async (_req: Request, res: Response) => {
  res.status(200).json(Object.values(ToppingCategory));
});

// Get all toppings - implements the same logic as toppings-get Azure Function
app.get('/api/toppings', async (req: Request, res: Response) => {
  logger.info({ query: req.query }, 'Processing request to get toppings');

  try {
    const dataService = await DbService.getInstance();
    const categoryParameter = req.query.category as string | undefined;

    // Record toppings view metric
    BurgerMetrics.recordToppingsViewed(categoryParameter);

    const baseUrl = getBaseUrl(req);

    // If a category is specified, filter toppings by category
    if (categoryParameter && Object.values(ToppingCategory).includes(categoryParameter as ToppingCategory)) {
      const toppings = await dataService.getToppingsByCategory(categoryParameter as ToppingCategory);
      const toppingsWithFullUrls = toppings.map((topping) => transformToppingImageUrl(topping, baseUrl));
      res.status(200).json(toppingsWithFullUrls);
      return;
    }

    // Otherwise return all toppings
    const toppings = await dataService.getToppings();
    const toppingsWithFullUrls = toppings.map((topping) => transformToppingImageUrl(topping, baseUrl));
    res.status(200).json(toppingsWithFullUrls);
  } catch (error) {
    logger.error({ err: error }, 'Error getting toppings');
    res.status(500).json({ error: 'Failed to get toppings' });
  }
});

// Get topping by ID - implements the same logic as topping-get-by-id Azure Function
app.get('/api/toppings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dataService = await DbService.getInstance();
    const topping = await dataService.getTopping(id);

    if (!topping) {
      res.status(404).json({ error: 'Topping not found' });
      return;
    }

    const baseUrl = getBaseUrl(req);
    const toppingWithFullUrl = transformToppingImageUrl(topping, baseUrl);
    res.status(200).json(toppingWithFullUrl);
  } catch (error) {
    logger.error({ err: error }, 'Error getting topping');
    res.status(500).json({ error: 'Failed to get topping' });
  }
});

// Get all orders - implements the same logic as orders-get Azure Function with query parameter support
app.get('/api/orders', async (req: Request, res: Response) => {
  logger.info('Processing request to get all orders');

  try {
    // Parse filters from query
    const userId = (req.query.userId as string) ?? undefined;
    const statusParameter = req.query.status as string | undefined;
    const lastParameter = req.query.last as string | undefined;
    let statuses: string[] | undefined;
    if (statusParameter) {
      statuses = statusParameter.split(',').map((s) => s.trim().toLowerCase());
    }

    let lastMs: number | undefined;
    if (lastParameter) {
      const match = /^(\d+)([mh])$/i.exec(lastParameter);
      if (match) {
        const value = Number.parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit === 'm') lastMs = value * 60 * 1000;
        if (unit === 'h') lastMs = value * 60 * 60 * 1000;
      }
    }

    const dataService = await DbService.getInstance();
    const allOrders = await dataService.getOrders(userId);

    // Filter by status if provided
    let filteredOrders = allOrders;
    if (statuses && statuses.length > 0) {
      filteredOrders = allOrders.filter((order) => statuses.includes(order.status));
    }

    // Filter by time if provided
    if (lastMs) {
      const cutoffTime = new Date(Date.now() - lastMs);
      filteredOrders = filteredOrders.filter((order) => new Date(order.createdAt) >= cutoffTime);
    }

    res.status(200).json(filteredOrders);
  } catch (error) {
    logger.error({ err: error }, 'Error getting orders');
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get order by ID - implements the same logic as orders-get-by-id Azure Function
app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }

    const dataService = await DbService.getInstance();
    const order = await dataService.getOrder(orderId);

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.status(200).json(order);
  } catch (error) {
    logger.error({ err: error }, 'Error getting order');
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Helper function for topping validation
async function validateAndCalculateToppingsPrice(
  dataService: DbService,
  toppingIds?: string[],
): Promise<number | { status: number; error: string }> {
  if (!toppingIds || toppingIds.length === 0) {
    return 0;
  }

  // Validate all toppings exist in parallel
  const toppingPromises = toppingIds.map(async (toppingId) => {
    const topping = await dataService.getTopping(toppingId);
    if (!topping) {
      throw new Error(`Topping with ID ${toppingId} not found`);
    }
    return topping.price;
  });

  try {
    const toppingPrices = await Promise.all(toppingPromises);
    return toppingPrices.reduce((sum, price) => sum + price, 0);
  } catch (error) {
    return {
      status: 400,
      error: (error as Error).message,
    };
  }
}

// Create new order - implements the same logic as orders-post Azure Function
app.post('/api/orders', async (req: Request, res: Response) => {
  // Create custom span for business-level order tracking
  const orderSpan = tracer.startSpan('burger.order.create');
  orderSpan.setTag('resource.name', 'order_placement');

  logger.info('Processing order creation request');

  try {
    const dataService = await DbService.getInstance();
    const requestBody = req.body;
    logger.debug({ requestBody }, 'Order creation request body');

    // Tag span with user context (anonymized)
    if (requestBody.userId) {
      const userHash = requestBody.userId.slice(0, 8);
      orderSpan.setTag('order.user_hash', userHash);
    }

    // Validate userId is provided
    if (!requestBody.userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Check if userId exists in the database
    const userExists = await dataService.userExists(requestBody.userId);
    if (!userExists) {
      const registrationUrl = process.env.AGENT_WEBAPP_URL ?? '<unspecified>';
      res.status(401).json({
        error: `The specified userId is not registered. Please login to get a valid userId at: ${registrationUrl}`,
      });
      return;
    }

    if (!requestBody.items || !Array.isArray(requestBody.items) || requestBody.items.length === 0) {
      res.status(400).json({ error: 'Order must contain at least one burger' });
      return;
    }

    // Limit: max 5 active orders per user
    const activeOrders = await dataService.getOrders(requestBody.userId);
    const activeOrdersFiltered = activeOrders.filter(
      (order) => order.status === OrderStatus.Pending || order.status === OrderStatus.InPreparation,
    );
    if (activeOrdersFiltered.length >= 5) {
      res.status(429).json({ error: 'Too many active orders: limit is 5 per user' });
      return;
    }

    // Convert request items to order items
    let totalPrice = 0;

    // Calculate total burger count and validate limit
    const totalBurgerCount = requestBody.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    if (totalBurgerCount > 50) {
      res.status(400).json({ error: 'Order cannot exceed 50 burgers in total' });
      return;
    }

    // Validate and process items in parallel
    const itemValidationPromises = requestBody.items.map(async (item: any) => {
      // Validate quantity is a positive integer
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Quantity for burgerId ${item.burgerId} must be a positive integer`);
      }

      const burger = await dataService.getBurger(item.burgerId);
      if (!burger) {
        throw new Error(`Burger with ID ${item.burgerId} not found`);
      }

      // Validate all extra toppings exist
      const extraToppingsPrice = await validateAndCalculateToppingsPrice(dataService, item.extraToppingIds);
      if (typeof extraToppingsPrice === 'object') {
        throw new TypeError(extraToppingsPrice.error);
      }

      const itemPrice = (burger.price + extraToppingsPrice) * item.quantity;

      return {
        orderItem: {
          burgerId: item.burgerId,
          quantity: item.quantity,
          extraToppingIds: item.extraToppingIds,
        },
        itemPrice,
      };
    });

    let validatedItems;
    try {
      validatedItems = await Promise.all(itemValidationPromises);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    // Calculate total price and build order items
    const orderItems: OrderItem[] = [];
    for (const { orderItem, itemPrice } of validatedItems) {
      totalPrice += itemPrice;
      orderItems.push(orderItem);
    }

    // Calculate estimated completion time based on burger count
    const now = new Date();
    const burgerCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    let minMinutes = 3;
    let maxMinutes = 5;
    if (burgerCount > 2) {
      minMinutes += burgerCount - 2;
      maxMinutes += burgerCount - 2;
    }

    // Random estimated time between min and max
    const estimatedMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    const estimatedCompletionAt = new Date(now.getTime() + estimatedMinutes * 60_000);

    // Create the order
    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const order = await dataService.createOrder({
      id: orderId,
      userId: requestBody.userId,
      createdAt: now.toISOString(),
      items: orderItems,
      estimatedCompletionAt: estimatedCompletionAt.toISOString(),
      totalPrice,
      status: OrderStatus.Pending,
      nickname: requestBody.nickname,
      completedAt: undefined,
    });

    // Tag span with business metrics
    const toppingCount = orderItems.reduce((sum, item) => sum + (item.extraToppingIds?.length || 0), 0);
    const burgerIds = orderItems.map(item => item.burgerId);

    orderSpan.setTag('order.id', orderId);
    orderSpan.setTag('order.total_price', totalPrice);
    orderSpan.setTag('order.burger_count', burgerCount);
    orderSpan.setTag('order.topping_count', toppingCount);
    orderSpan.setTag('order.items', orderItems.length);
    orderSpan.setTag('order.estimated_minutes', estimatedMinutes);
    orderSpan.setTag('order.has_nickname', !!requestBody.nickname);
    orderSpan.setTag('order.burger_ids', burgerIds.join(','));
    orderSpan.setTag('order.status', 'created');

    // Record business metrics for dashboards
    BurgerMetrics.recordOrderPlaced({
      totalPrice,
      burgerCount,
      toppingCount,
      hasNickname: !!requestBody.nickname,
      burgerIds,
    });

    res.status(201).json(order);
  } catch (error) {
    orderSpan.setTag('error', error);
    logger.error({ err: error }, 'Error creating order');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    orderSpan.finish();
  }
});

// Delete order - implements the same logic as orders-delete Azure Function
app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  const cancelSpan = tracer.startSpan('burger.order.cancel');
  cancelSpan.setTag('resource.name', req.params?.id || 'unknown');

  logger.info({ params: req.params, query: req.query }, 'Processing order cancellation request');

  try {
    const id = req.params?.id;

    if (!id) {
      res.status(400).json({ error: 'Order ID is required' });
      return;
    }

    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'userId is required as a query parameter' });
      return;
    }

    cancelSpan.setTag('order.id', id);
    cancelSpan.setTag('order.user_hash', userId.slice(0, 8));

    const dataService = await DbService.getInstance();

    // Check if userId matches the order's userId
    const order = await dataService.getOrder(id, userId);
    if (!order) {
      cancelSpan.setTag('cancel.result', 'not_found');
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Tag span with order details
    cancelSpan.setTag('order.status_before', order.status);
    cancelSpan.setTag('order.value', order.totalPrice);
    const ageMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
    cancelSpan.setTag('order.age_minutes', ageMinutes);

    const deletedSuccessfully = await dataService.deleteOrder(id, userId);

    if (!deletedSuccessfully) {
      cancelSpan.setTag('cancel.result', 'failed');
      res.status(404).json({ error: 'Order not found or cannot be cancelled' });
      return;
    }

    cancelSpan.setTag('cancel.result', 'success');

    // Record cancellation metrics
    BurgerMetrics.recordOrderCancelled(order.status, order.totalPrice, ageMinutes);

    res.status(200).json({ message: 'Order cancelled successfully', orderId: id });
  } catch (error) {
    cancelSpan.setTag('error', error);
    logger.error({ err: error }, 'Error cancelling order');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    cancelSpan.finish();
  }
});

// Get images (using regex to match nested paths)
app.get(/^\/api\/images\/(.+)$/, async (req: Request, res: Response) => {
  try {
    // Extract filepath from the URL using regex capture group
    const filepath = req.params[0];

    if (!filepath) {
      res.status(400).json({ error: 'Image path is required' });
      return;
    }

    const blobService = await BlobService.getInstance();
    const imageBuffer = await blobService.getBlob(filepath);

    if (!imageBuffer) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    // Get content type based on file extension
    const contentType = blobService.getContentType(filepath);

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(imageBuffer);
  } catch (error) {
    logger.error({ err: error }, 'Error getting image');
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Get OpenAPI spec - implements the same logic as openapi-get Azure Function
app.get('/api/openapi', async (req: Request, res: Response) => {
  logger.info('Processing request to get OpenAPI specification');

  try {
    const openapiPath = path.join(process.cwd(), 'packages/burger-api/openapi.yaml');
    const openapiContent = await fs.readFile(openapiPath, 'utf8');

    const requestUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const defaultPort = requestUrl.protocol === 'https:' ? '443' : '80';
    const portSegment = requestUrl.port && requestUrl.port !== defaultPort ? `:${requestUrl.port}` : '';
    const burgerApiHost = `${requestUrl.protocol}//${requestUrl.hostname}${portSegment}`;
    logger.info({ burgerApiHost }, 'Replacing <BURGER_API_HOST> in OpenAPI specification');

    // Replace BURGER_API_HOST placeholder with actual host URL
    const processedContent = openapiContent.replace('<BURGER_API_HOST>', burgerApiHost);

    const wantsJson =
      req.query.format?.toString().toLowerCase() === 'json' ||
      (req.headers.accept?.toLowerCase().includes('json') ?? false);

    if (wantsJson) {
      try {
        const json = yaml.load(processedContent);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(json);
      } catch (error) {
        logger.error({ err: error }, 'YAML to JSON conversion failed');
        res.status(500).json({ error: 'YAML to JSON conversion failed.' });
      }
    } else {
      res.setHeader('Content-Type', 'text/yaml');
      res.status(200).send(processedContent);
    }
  } catch (error) {
    logger.error({ err: error }, 'Error reading OpenAPI specification file');
    res.status(500).json({ error: 'Error reading OpenAPI specification' });
  }
});

// Background worker for order state transitions (mimics Azure Functions timer)
async function updateOrderStatuses() {
  const workerSpan = tracer.startSpan('burger.orders.status_update_worker');
  workerSpan.setTag('resource.name', 'background_job');

  try {
    const db = await DbService.getInstance();
    const startTime = Date.now();
    const now = new Date();

    const allOrders = await db.getOrders();

    // Calculate queue statistics for business metrics
    const queueStats = {
      pending: allOrders.filter(o => o.status === OrderStatus.Pending).length,
      inPreparation: allOrders.filter(o => o.status === OrderStatus.InPreparation).length,
      ready: allOrders.filter(o => o.status === OrderStatus.Ready).length,
      completed: allOrders.filter(o => o.status === OrderStatus.Completed).length,
      cancelled: allOrders.filter(o => o.status === OrderStatus.Cancelled).length,
    };

    workerSpan.setTag('worker.total_orders', allOrders.length);
    workerSpan.setTag('worker.queue.pending', queueStats.pending);
    workerSpan.setTag('worker.queue.in_preparation', queueStats.inPreparation);
    workerSpan.setTag('worker.queue.ready', queueStats.ready);

    // Record queue depth metrics for Chef Dashboard
    BurgerMetrics.recordQueueDepth(queueStats);

    const orders = allOrders.filter((order) =>
      [OrderStatus.Pending, OrderStatus.InPreparation, OrderStatus.Ready].includes(order.status),
    );

    const updateTasks = [];
    let transitionCounts = {
      pending_to_prep: 0,
      prep_to_ready: 0,
      ready_to_completed: 0,
    };
    for (const order of orders) {
      switch (order.status) {
        case OrderStatus.Pending: {
          const minutesSinceCreated = (now.getTime() - new Date(order.createdAt).getTime()) / 60_000;
          if (minutesSinceCreated > 3 || (minutesSinceCreated >= 1 && Math.random() < 0.5)) {
            updateTasks.push({
              orderId: order.id,
              update: { status: OrderStatus.InPreparation },
              statusName: 'in-preparation',
            });
            transitionCounts.pending_to_prep++;
            // Record transition timing
            BurgerMetrics.recordOrderStatusTransition(
              OrderStatus.Pending,
              OrderStatus.InPreparation,
              minutesSinceCreated
            );
          }
          break;
        }

        case OrderStatus.InPreparation: {
          const estimatedCompletionAt = new Date(order.estimatedCompletionAt);
          const diffMinutes = (now.getTime() - estimatedCompletionAt.getTime()) / 60_000;
          if (diffMinutes > 3 || (Math.abs(diffMinutes) <= 3 && Math.random() < 0.5)) {
            updateTasks.push({
              orderId: order.id,
              update: { status: OrderStatus.Ready, readyAt: now.toISOString() },
              statusName: 'ready',
            });
            transitionCounts.prep_to_ready++;
            const minutesSinceCreated = (now.getTime() - new Date(order.createdAt).getTime()) / 60_000;
            BurgerMetrics.recordOrderStatusTransition(
              OrderStatus.InPreparation,
              OrderStatus.Ready,
              minutesSinceCreated
            );
          }
          break;
        }

        case OrderStatus.Ready: {
          if (order.readyAt) {
            const readyAt = new Date(order.readyAt);
            const minutesSinceReady = (now.getTime() - readyAt.getTime()) / 60_000;
            if (minutesSinceReady >= 1 && (minutesSinceReady > 2 || Math.random() < 0.5)) {
              updateTasks.push({
                orderId: order.id,
                update: { status: OrderStatus.Completed, completedAt: now.toISOString() },
                statusName: 'completed',
              });
              transitionCounts.ready_to_completed++;
              BurgerMetrics.recordOrderStatusTransition(
                OrderStatus.Ready,
                OrderStatus.Completed,
                minutesSinceReady
              );
            }
          }
          break;
        }
        // No default
      }
    }

    const updatePromises = updateTasks.map(async (task) => {
      try {
        await db.updateOrder(task.orderId, task.update);
        return { id: task.orderId, status: task.statusName, success: true };
      } catch (error) {
        logger.error({ err: error, orderId: task.orderId, statusName: task.statusName }, 'Failed to update order status');
        return { id: task.orderId, status: task.statusName, success: false, error: error as Error };
      }
    });

    const results = await Promise.all(updatePromises);

    const updated = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const elapsedMs = Date.now() - startTime;

    // Tag span with worker results
    workerSpan.setTag('worker.updates_attempted', updateTasks.length);
    workerSpan.setTag('worker.updates_success', updated);
    workerSpan.setTag('worker.updates_failed', failed);
    workerSpan.setTag('worker.elapsed_ms', elapsedMs);
    workerSpan.setTag('worker.transitions.pending_to_prep', transitionCounts.pending_to_prep);
    workerSpan.setTag('worker.transitions.prep_to_ready', transitionCounts.prep_to_ready);
    workerSpan.setTag('worker.transitions.ready_to_completed', transitionCounts.ready_to_completed);

    if (updated > 0 || failed > 0) {
      logger.info({ updated, failed, elapsedMs, transitionCounts }, 'Order status updates completed');
    }
  } catch (error) {
    workerSpan.setTag('error', error);
    logger.error({ err: error }, 'Error in order status update worker');
  } finally {
    workerSpan.finish();
  }
}

// Start the background worker (runs every 40 seconds, matching Azure Functions timer)
const ORDER_STATUS_UPDATE_INTERVAL = 40_000; // 40 seconds
logger.info('Starting order status update background worker');
setInterval(updateOrderStatuses, ORDER_STATUS_UPDATE_INTERVAL);
// Run once immediately on startup
updateOrderStatuses();

// Start server
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Burger API server listening');
});

export default app;
