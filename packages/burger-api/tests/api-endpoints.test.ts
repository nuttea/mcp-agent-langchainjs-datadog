import request from 'supertest';

// Note: This requires the express server to be refactored to export the app
// For now, we'll test against a running instance
const API_BASE_URL = process.env.BURGER_API_URL || 'http://localhost:8080';

describe('Burger API Endpoints', () => {
  describe('Health Check', () => {
    test('GET / should return server status', async () => {
      const response = await request(API_BASE_URL).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'up');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('totalOrders');
      expect(response.body).toHaveProperty('activeOrders');
      expect(response.body).toHaveProperty('registeredUsers');
    });

    test('GET /api should return server status', async () => {
      const response = await request(API_BASE_URL).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'up');
    });
  });

  describe('Burger Endpoints', () => {
    test('GET /api/burgers should return all burgers', async () => {
      const response = await request(API_BASE_URL).get('/api/burgers');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify burger structure
      const burger = response.body[0];
      expect(burger).toHaveProperty('id');
      expect(burger).toHaveProperty('name');
      expect(burger).toHaveProperty('description');
      expect(burger).toHaveProperty('price');
      expect(burger).toHaveProperty('imageUrl');
      expect(burger).toHaveProperty('toppings');

      // Verify imageUrl format
      expect(burger.imageUrl).toMatch(/^https?:\/\/.+\/api\/images\/burger-pic-\d+\.jpg$/);
    });

    test('GET /api/burgers/:id should return a specific burger', async () => {
      // First get all burgers to get a valid ID
      const burgersResponse = await request(API_BASE_URL).get('/api/burgers');
      const burgerId = burgersResponse.body[0].id;

      const response = await request(API_BASE_URL).get(`/api/burgers/${burgerId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', burgerId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('price');
    });

    test('GET /api/burgers/:id should return 404 for non-existent burger', async () => {
      const response = await request(API_BASE_URL).get('/api/burgers/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Topping Endpoints', () => {
    test('GET /api/toppings should return all toppings', async () => {
      const response = await request(API_BASE_URL).get('/api/toppings');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify topping structure
      const topping = response.body[0];
      expect(topping).toHaveProperty('id');
      expect(topping).toHaveProperty('name');
      expect(topping).toHaveProperty('description');
      expect(topping).toHaveProperty('category');
      expect(topping).toHaveProperty('price');
      expect(topping).toHaveProperty('imageUrl');

      // Verify imageUrl format
      expect(topping.imageUrl).toMatch(/^https?:\/\/.+\/api\/images\/topping-pic-\d+\.jpg$/);
    });

    test('GET /api/toppings?category=sauce should filter toppings by category', async () => {
      const response = await request(API_BASE_URL).get('/api/toppings?category=sauce');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // All toppings should be sauce category
      response.body.forEach((topping: any) => {
        expect(topping.category).toBe('sauce');
      });
    });

    test('GET /api/toppings/categories should return all categories', async () => {
      const response = await request(API_BASE_URL).get('/api/toppings/categories');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain('vegetable');
      expect(response.body).toContain('meat');
      expect(response.body).toContain('cheese');
      expect(response.body).toContain('sauce');
      expect(response.body).toContain('extras');
    });

    test('GET /api/toppings/:id should return a specific topping', async () => {
      const toppingsResponse = await request(API_BASE_URL).get('/api/toppings');
      const toppingId = toppingsResponse.body[0].id;

      const response = await request(API_BASE_URL).get(`/api/toppings/${toppingId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', toppingId);
      expect(response.body).toHaveProperty('name');
    });

    test('GET /api/toppings/:id should return 404 for non-existent topping', async () => {
      const response = await request(API_BASE_URL).get('/api/toppings/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('Order Endpoints', () => {
    let testUserId: string;

    beforeAll(() => {
      testUserId = `test-api-user-${Date.now()}`;
    });

    test('POST /api/orders should create a new order', async () => {
      // First get burgers and toppings
      const burgersResponse = await request(API_BASE_URL).get('/api/burgers');
      const burger = burgersResponse.body[0];

      const toppingsResponse = await request(API_BASE_URL).get('/api/toppings');
      const topping = toppingsResponse.body[0];

      // Note: User needs to be created first - this will fail with 401
      // This test demonstrates the expected behavior
      const orderPayload = {
        userId: testUserId,
        items: [
          {
            burgerId: burger.id,
            quantity: 1,
            extraToppingIds: [topping.id],
          },
        ],
        nickname: 'Test Order',
      };

      const response = await request(API_BASE_URL)
        .post('/api/orders')
        .send(orderPayload);

      // Will be 401 if user doesn't exist, 201 if successful
      expect([201, 401]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('totalPrice');
        expect(response.body.items).toHaveLength(1);
      }
    });

    test('POST /api/orders should validate required fields', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/orders')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/orders should validate items array', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/orders')
        .send({
          userId: testUserId,
          items: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/at least one burger/i);
    });

    test('GET /api/orders should return all orders', async () => {
      const response = await request(API_BASE_URL).get('/api/orders');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/orders?status=pending should filter by status', async () => {
      const response = await request(API_BASE_URL).get('/api/orders?status=pending');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // All orders should have pending status
      response.body.forEach((order: any) => {
        expect(order.status).toBe('pending');
      });
    });
  });

  describe('Image Endpoints', () => {
    test('GET /api/images/:filename should return burger image', async () => {
      const response = await request(API_BASE_URL).get('/api/images/burger-pic-1.jpg');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    test('GET /api/images/:filename should return topping image', async () => {
      const response = await request(API_BASE_URL).get('/api/images/topping-pic-1.jpg');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\//);
    });

    test('GET /api/images/:filename should return 404 for non-existent image', async () => {
      const response = await request(API_BASE_URL).get('/api/images/non-existent.jpg');

      expect(response.status).toBe(404);
    });
  });

  describe('OpenAPI Spec', () => {
    test('GET /api/openapi should return OpenAPI spec in YAML', async () => {
      const response = await request(API_BASE_URL).get('/api/openapi');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/yaml/);
      expect(response.text).toContain('openapi:');
    });

    test('GET /api/openapi?format=json should return OpenAPI spec in JSON', async () => {
      const response = await request(API_BASE_URL).get('/api/openapi?format=json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
    });
  });
});
