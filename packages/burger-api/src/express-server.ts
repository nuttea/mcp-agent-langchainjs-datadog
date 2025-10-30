import express, { type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { DbService } from './db-service.js';
import { BlobService } from './blob-service.js';
import { ToppingCategory } from './topping.js';
import { OrderStatus, type OrderItem } from './order.js';

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
    console.error('Error processing server status request:', error);
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
    console.error('Error processing server status request:', error);
    res.status(200).json({
      status: 'up',
      error: 'Error retrieving order information',
      timestamp: new Date().toISOString(),
    });
  }
});

// Get all burgers
app.get('/api/burgers', async (req: Request, res: Response) => {
  try {
    const dataService = await DbService.getInstance();
    const burgers = await dataService.getBurgers();

    const baseUrl = getBaseUrl(req);
    const burgersWithFullUrls = burgers.map((burger) =>
      transformBurgerImageUrl(burger, baseUrl)
    );

    res.json(burgersWithFullUrls);
  } catch (error) {
    console.error('Error getting burgers:', error);
    res.status(500).json({ error: 'Failed to get burgers' });
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

    const baseUrl = getBaseUrl(req);
    const burgerWithFullUrl = transformBurgerImageUrl(burger, baseUrl);

    res.json(burgerWithFullUrl);
  } catch (error) {
    console.error('Error getting burger:', error);
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
  console.log('Processing request to get toppings...');
  console.log('Request query:', req.query);

  try {
    const dataService = await DbService.getInstance();
    const categoryParameter = req.query.category as string | undefined;

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
    console.error('Error getting toppings:', error);
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
    console.error('Error getting topping:', error);
    res.status(500).json({ error: 'Failed to get topping' });
  }
});

// Get all orders - implements the same logic as orders-get Azure Function with query parameter support
app.get('/api/orders', async (req: Request, res: Response) => {
  console.log('Processing request to get all orders...');

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
    console.error('Error getting orders:', error);
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
    console.error('Error getting order:', error);
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
  console.log('Processing order creation request...');

  try {
    const dataService = await DbService.getInstance();
    const requestBody = req.body;
    console.log('Request body:', requestBody);

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

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete order - implements the same logic as orders-delete Azure Function
app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  console.log('Processing order cancellation request...');
  console.log('Request params:', req.params);
  console.log('Request query:', req.query);

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

    const dataService = await DbService.getInstance();

    // Check if userId matches the order's userId
    const order = await dataService.getOrder(id, userId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const deletedSuccessfully = await dataService.deleteOrder(id, userId);

    if (!deletedSuccessfully) {
      res.status(404).json({ error: 'Order not found or cannot be cancelled' });
      return;
    }

    res.status(200).json({ message: 'Order cancelled successfully', orderId: id });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    console.error('Error getting image:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Get OpenAPI spec - implements the same logic as openapi-get Azure Function
app.get('/api/openapi', async (req: Request, res: Response) => {
  console.log('Processing request to get OpenAPI specification...');

  try {
    const openapiPath = path.join(process.cwd(), 'packages/burger-api/openapi.yaml');
    const openapiContent = await fs.readFile(openapiPath, 'utf8');

    const requestUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const defaultPort = requestUrl.protocol === 'https:' ? '443' : '80';
    const portSegment = requestUrl.port && requestUrl.port !== defaultPort ? `:${requestUrl.port}` : '';
    const burgerApiHost = `${requestUrl.protocol}//${requestUrl.hostname}${portSegment}`;
    console.log('Burger API host:', burgerApiHost);

    // Replace BURGER_API_HOST placeholder with actual host URL
    console.log('Replacing <BURGER_API_HOST> in OpenAPI specification...');
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
        console.error('YAML to JSON conversion failed:', error);
        res.status(500).json({ error: 'YAML to JSON conversion failed.' });
      }
    } else {
      res.setHeader('Content-Type', 'text/yaml');
      res.status(200).send(processedContent);
    }
  } catch (error) {
    console.error('Error reading OpenAPI specification file:', error);
    res.status(500).json({ error: 'Error reading OpenAPI specification' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Burger API server listening on port ${PORT}`);
});

export default app;
