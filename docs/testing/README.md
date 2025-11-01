# Testing Documentation

Comprehensive guides for testing the MCP Agent application.

## Quick Start

Get started testing in 5 minutes:

**[TEST_QUICKSTART.md](TEST_QUICKSTART.md)** - Quick start guide for running tests

## Documentation

- **[TESTING.md](TESTING.md)** - Complete testing documentation

## Test Coverage

### burger-api Tests

**20 tests covering:**
- Burger operations (retrieval, filtering, image URLs)
- Topping operations (CRUD, categories, filtering)
- Order operations (create, update, delete, status)
- User operations (create, check existence, retrieve)

**Location:** `packages/burger-api/tests/`

### agent-api Tests

**11 tests covering:**
- PostgreSQL connection validation
- User CRUD operations
- Concurrent operations
- Special characters and edge cases
- Long data handling

**Location:** `packages/agent-api/tests/`

## Running Tests

### Prerequisites

```bash
# Install test dependencies
cd packages/burger-api
npm install

cd ../agent-api
npm install
```

### Start PostgreSQL

```bash
# Port forward from GKE
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432 &

# Or use local PostgreSQL
docker-compose up -d postgres
```

### Run Tests

```bash
# burger-api tests (20 tests)
cd packages/burger-api
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=burgerapp \
POSTGRES_PASSWORD=changeme123 \
POSTGRES_DB=burgerdb \
npm test

# agent-api tests (11 tests)
cd packages/agent-api
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=burgerapp \
POSTGRES_PASSWORD=changeme123 \
POSTGRES_DB=burgerdb \
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/db-service.test.ts

# Watch mode
npm test -- --watch
```

## Test Structure

### burger-api Tests

```
packages/burger-api/tests/
├── db-service.test.ts       # Database integration tests (20 tests)
└── api-endpoints.test.ts    # HTTP endpoint tests (requires running server)
```

### agent-api Tests

```
packages/agent-api/tests/
├── setup.ts                 # Test environment setup
└── user-db-service.test.ts  # User service tests (11 tests)
```

## Test Categories

### Integration Tests

Tests that interact with real databases and services:
- Database CRUD operations
- Connection pooling
- Transaction handling
- Concurrent operations

### API Tests

Tests for HTTP endpoints (requires running server):
- GET, POST, PUT, DELETE endpoints
- Request validation
- Response formats
- Error handling

### Unit Tests

Tests for individual functions and classes:
- Business logic
- Data transformations
- Utility functions

## Common Issues

### PostgreSQL Connection Failed

**Problem:** Tests fail with connection errors

**Solution:**
```bash
# Verify PostgreSQL is running
kubectl get pods -n mcp-agent-dev | grep postgres

# Check port forwarding
lsof -i :5432

# Restart port forwarding
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432
```

### Wrong Credentials

**Problem:** Authentication failed errors

**Solution:**
```bash
# Get correct credentials from secrets
kubectl get secret postgres-secret -n mcp-agent-dev -o jsonpath='{.data.POSTGRES_USER}' | base64 -d
kubectl get secret postgres-secret -n mcp-agent-dev -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
kubectl get secret postgres-secret -n mcp-agent-dev -o jsonpath='{.data.POSTGRES_DB}' | base64 -d
```

### Tests Hang or Timeout

**Problem:** Tests don't complete

**Solution:**
- Increase timeout in jest.config.js
- Check for open connections not being closed
- Run with `--detectOpenHandles` flag

```bash
npm test -- --detectOpenHandles
```

## Best Practices

1. **Use unique IDs** for test data (timestamps, UUIDs)
2. **Clean up after tests** in afterAll/afterEach hooks
3. **Mock external services** when possible
4. **Test edge cases** (empty strings, special characters, very long inputs)
5. **Use descriptive test names** that explain what is being tested
6. **Group related tests** with describe blocks
7. **Keep tests independent** - each test should be able to run alone
8. **Test both success and failure** cases

## Writing New Tests

### Example Test Structure

```typescript
import { UserDbService } from '../src/user-db-service';

describe('UserDbService - Feature Tests', () => {
  let dbService: UserDbService;

  beforeAll(async () => {
    dbService = await UserDbService.getInstance();
  });

  afterAll(async () => {
    await dbService.close();
  });

  describe('Feature Name', () => {
    test('should do something successfully', async () => {
      // Arrange
      const input = 'test-data';

      // Act
      const result = await dbService.someMethod(input);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
    });

    test('should handle error case', async () => {
      // Test error scenarios
      await expect(
        dbService.someMethod(null)
      ).rejects.toThrow();
    });
  });
});
```

## CI/CD Integration

Tests can be run in GitHub Actions or other CI systems:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: burgerapp
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: burgerdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --ci --coverage
        env:
          POSTGRES_HOST: postgres
          POSTGRES_PORT: 5432
          POSTGRES_USER: burgerapp
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: burgerdb
```

## Test Results

Expected output when all tests pass:

```
burger-api tests:
  PASS tests/db-service.test.ts
    ✓ 20 tests passed

agent-api tests:
  PASS tests/user-db-service.test.ts
    ✓ 11 tests passed

Total: 31 tests passed
```

## Next Steps

- Deploy application: See [../deployment/](../deployment/)
- Set up monitoring: See [../monitoring/](../monitoring/)
- Review architecture: See [../architecture/](../architecture/)
