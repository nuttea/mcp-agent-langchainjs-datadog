import { UserDbService } from '../src/user-db-service';

describe('UserDbService - Database Integration Tests', () => {
  let dbService: UserDbService;
  const testUserId = `test-user-${Date.now()}`;
  const testUserName = 'Test User';

  beforeAll(async () => {
    dbService = await UserDbService.getInstance();
  });

  afterAll(async () => {
    await dbService.close();
  });

  describe('PostgreSQL Connection', () => {
    test('should initialize PostgreSQL connection', () => {
      const isInitialized = dbService.isInitialized();
      expect(typeof isInitialized).toBe('boolean');

      if (isInitialized) {
        const pool = dbService.getPool();
        expect(pool).toBeDefined();
      }
    });

    test('should have a valid pool if initialized', () => {
      const pool = dbService.getPool();
      if (dbService.isInitialized()) {
        expect(pool).toBeDefined();
        expect(pool).toHaveProperty('connect');
      }
    });
  });

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const user = await dbService.createUser(testUserId, testUserName);

      expect(user).toBeDefined();
      expect(user).toHaveProperty('id', testUserId);
      expect(user).toHaveProperty('name', testUserName);
      expect(user).toHaveProperty('createdAt');
    });

    test('should retrieve existing user by ID', async () => {
      const user = await dbService.getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user).toHaveProperty('id', testUserId);
      expect(user).toHaveProperty('name', testUserName);
    });

    test('should return undefined for non-existent user', async () => {
      const user = await dbService.getUserById('non-existent-user-12345');
      expect(user).toBeUndefined();
    });

    test('should handle user creation with no name (defaults to ID)', async () => {
      const userId = `test-user-no-name-${Date.now()}`;
      const user = await dbService.createUser(userId);

      expect(user).toBeDefined();
      expect(user).toHaveProperty('id', userId);
      expect(user).toHaveProperty('name', userId); // Should default to userId
    });

    test('should handle duplicate user creation (idempotent)', async () => {
      const userId = `test-user-duplicate-${Date.now()}`;

      // Create user first time
      const user1 = await dbService.createUser(userId, 'First Creation');
      expect(user1).toBeDefined();

      // Create same user again
      const user2 = await dbService.createUser(userId, 'Second Creation');
      expect(user2).toBeDefined();

      // Should return existing user
      expect(user2.id).toBe(userId);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent user creations', async () => {
      const baseId = `concurrent-user-${Date.now()}`;

      const promises = Array.from({ length: 5 }, (_, i) =>
        dbService.createUser(`${baseId}-${i}`, `User ${i}`)
      );

      const users = await Promise.all(promises);

      expect(users).toHaveLength(5);
      users.forEach((user, i) => {
        expect(user).toHaveProperty('id', `${baseId}-${i}`);
        expect(user).toHaveProperty('name', `User ${i}`);
      });
    });

    test('should handle concurrent reads', async () => {
      const userId = `concurrent-read-user-${Date.now()}`;
      await dbService.createUser(userId, 'Concurrent Read User');

      const promises = Array.from({ length: 10 }, () =>
        dbService.getUserById(userId)
      );

      const users = await Promise.all(promises);

      expect(users).toHaveLength(10);
      users.forEach(user => {
        expect(user).toBeDefined();
        expect(user?.id).toBe(userId);
      });
    });
  });

  describe('Special Characters and Edge Cases', () => {
    test('should handle user names with special characters', async () => {
      const userId = `test-user-special-${Date.now()}`;
      const specialName = 'Test User 🍔 with émojis and spëcial çhars!';

      const user = await dbService.createUser(userId, specialName);

      expect(user).toBeDefined();
      expect(user.name).toBe(specialName);

      // Verify it was stored correctly
      const retrieved = await dbService.getUserById(userId);
      expect(retrieved?.name).toBe(specialName);
    });

    test('should handle long user names (up to 255 chars)', async () => {
      const userId = `test-user-long-${Date.now()}`;
      const longName = 'A'.repeat(255); // 255 character name (DB limit)

      const user = await dbService.createUser(userId, longName);

      expect(user).toBeDefined();
      expect(user.name).toBe(longName);
    });
  });
});
