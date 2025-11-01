import { DbService } from '../src/db-service';
import { OrderStatus } from '../src/order';
import { ToppingCategory } from '../src/topping';

describe('DbService - Database Integration Tests', () => {
  let dbService: DbService;

  beforeAll(async () => {
    // Set test environment variables if PostgreSQL is available
    process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
    process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
    process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'burgerapp';
    process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'burgerdb';
    process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'test_password';

    dbService = await DbService.getInstance();
  });

  afterAll(async () => {
    await dbService.close();
  });

  describe('Burger Operations', () => {
    test('should retrieve all burgers', async () => {
      const burgers = await dbService.getBurgers();

      expect(burgers).toBeDefined();
      expect(Array.isArray(burgers)).toBe(true);
      expect(burgers.length).toBeGreaterThan(0);

      // Verify burger structure
      const burger = burgers[0];
      expect(burger).toHaveProperty('id');
      expect(burger).toHaveProperty('name');
      expect(burger).toHaveProperty('description');
      expect(burger).toHaveProperty('price');
      expect(burger).toHaveProperty('imageUrl');
      expect(burger).toHaveProperty('toppings');
      expect(Array.isArray(burger.toppings)).toBe(true);
    });

    test('should retrieve a specific burger by ID', async () => {
      const burgers = await dbService.getBurgers();
      const firstBurgerId = burgers[0].id;

      const burger = await dbService.getBurger(firstBurgerId);

      expect(burger).toBeDefined();
      expect(burger?.id).toBe(firstBurgerId);
      expect(burger?.name).toBeDefined();
      expect(burger?.price).toBeGreaterThan(0);
    });

    test('should return undefined for non-existent burger', async () => {
      const burger = await dbService.getBurger('non-existent-id');
      expect(burger).toBeUndefined();
    });

    test('burger images should have correct format', async () => {
      const burgers = await dbService.getBurgers();
      const burger = burgers[0];

      // Image URL should not start with /images/ (stripped in db-service)
      expect(burger.imageUrl).not.toMatch(/^\/images\//);
      // Should be just the filename
      expect(burger.imageUrl).toMatch(/^burger-pic-\d+\.jpg$/);
    });
  });

  describe('Topping Operations', () => {
    test('should retrieve all toppings', async () => {
      const toppings = await dbService.getToppings();

      expect(toppings).toBeDefined();
      expect(Array.isArray(toppings)).toBe(true);
      expect(toppings.length).toBeGreaterThan(0);

      // Verify topping structure
      const topping = toppings[0];
      expect(topping).toHaveProperty('id');
      expect(topping).toHaveProperty('name');
      expect(topping).toHaveProperty('description');
      expect(topping).toHaveProperty('category');
      expect(topping).toHaveProperty('price');
      expect(topping).toHaveProperty('imageUrl');
    });

    test('should retrieve a specific topping by ID', async () => {
      const toppings = await dbService.getToppings();
      const firstToppingId = toppings[0].id;

      const topping = await dbService.getTopping(firstToppingId);

      expect(topping).toBeDefined();
      expect(topping?.id).toBe(firstToppingId);
      expect(topping?.name).toBeDefined();
      expect(topping?.price).toBeGreaterThanOrEqual(0);
    });

    test('should return undefined for non-existent topping', async () => {
      const topping = await dbService.getTopping('non-existent-id');
      expect(topping).toBeUndefined();
    });

    test('should filter toppings by category', async () => {
      const sauceToppings = await dbService.getToppingsByCategory(ToppingCategory.Sauce);

      expect(sauceToppings).toBeDefined();
      expect(Array.isArray(sauceToppings)).toBe(true);

      // All returned toppings should be in sauce category
      sauceToppings.forEach(topping => {
        expect(topping.category).toBe(ToppingCategory.Sauce);
      });
    });

    test('topping images should have correct format', async () => {
      const toppings = await dbService.getToppings();
      const topping = toppings[0];

      // Image URL should be just the filename
      expect(topping.imageUrl).toMatch(/^topping-pic-\d+\.jpg$/);
    });
  });

  describe('Order Operations', () => {
    let testUserId: string;
    let testOrderId: string;

    beforeAll(async () => {
      testUserId = `test-user-${Date.now()}`;
      await dbService.createUser(testUserId, 'Test User');
    });

    test('should create a new order', async () => {
      const burgers = await dbService.getBurgers();
      const burger = burgers[0];
      const toppings = await dbService.getToppings();
      const topping = toppings[0];

      const order = await dbService.createOrder({
        id: `test-order-${Date.now()}`,
        userId: testUserId,
        createdAt: new Date().toISOString(),
        items: [
          {
            burgerId: burger.id,
            quantity: 1,
            extraToppingIds: [topping.id],
          },
        ],
        estimatedCompletionAt: new Date(Date.now() + 600000).toISOString(),
        totalPrice: burger.price + topping.price,
        status: OrderStatus.Pending,
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.status).toBe(OrderStatus.Pending);
      expect(order.items).toHaveLength(1);
      expect(order.totalPrice).toBeGreaterThan(0);

      testOrderId = order.id;
    });

    test('should retrieve orders for a user', async () => {
      const orders = await dbService.getOrders(testUserId);

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);

      // Verify order structure
      const order = orders[0];
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('createdAt');
      expect(order).toHaveProperty('items');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('totalPrice');
    });

    test('should retrieve a specific order by ID', async () => {
      const order = await dbService.getOrder(testOrderId, testUserId);

      expect(order).toBeDefined();
      expect(order?.id).toBe(testOrderId);
    });

    test('should update order status', async () => {
      const updatedOrder = await dbService.updateOrderStatus(
        testOrderId,
        OrderStatus.InPreparation,
        testUserId
      );

      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.status).toBe(OrderStatus.InPreparation);
    });

    test('should update order', async () => {
      const updatedOrder = await dbService.updateOrder(testOrderId, {
        status: OrderStatus.Ready,
      });

      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.status).toBe(OrderStatus.Ready);
    });

    test('should delete an order', async () => {
      const deleted = await dbService.deleteOrder(testOrderId, testUserId);
      expect(deleted).toBe(true);

      // Verify order is deleted
      const order = await dbService.getOrder(testOrderId, testUserId);
      expect(order).toBeUndefined();
    });
  });

  describe('User Operations', () => {
    const testUserId = `test-user-ops-${Date.now()}`;
    const testUserName = 'Test User Operations';

    test('should create a new user', async () => {
      await expect(
        dbService.createUser(testUserId, testUserName)
      ).resolves.not.toThrow();
    });

    test('should check if user exists', async () => {
      const exists = await dbService.userExists(testUserId);
      expect(exists).toBe(true);
    });

    test('should retrieve user name', async () => {
      const name = await dbService.getUserName(testUserId);
      expect(name).toBe(testUserName);
    });

    test('should return false for non-existent user', async () => {
      const exists = await dbService.userExists('non-existent-user');
      expect(exists).toBe(false);
    });

    test('should count registered users', async () => {
      const count = await dbService.getRegisteredUsers();
      expect(count).toBeGreaterThan(0);
    });
  });
});
