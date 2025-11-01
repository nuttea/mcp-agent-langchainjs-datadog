# Testing Guide

This document describes the testing strategy and instructions for running tests for the burger-api and agent-api services.

## Overview

The project includes comprehensive test suites for both APIs:

- **burger-api**: Database integration tests, API endpoint tests, image serving tests
- **agent-api**: Chat history tests, PostgreSQL integration tests

## Test Framework

- **Jest**: Primary testing framework
- **Supertest**: HTTP endpoint testing
- **ts-jest**: TypeScript support for Jest

## Prerequisites

### Install Dependencies

Install test dependencies for both packages:

```bash
# Install burger-api test dependencies
cd packages/burger-api
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest

# Install agent-api test dependencies
cd packages/agent-api
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### PostgreSQL Database

Tests require a PostgreSQL database. You can use:

1. **Local PostgreSQL**:
   ```bash
   docker run --name postgres-test -e POSTGRES_PASSWORD=test_password -e POSTGRES_DB=burgerdb -e POSTGRES_USER=burgerapp -p 5432:5432 -d postgres:15
   ```

2. **GKE PostgreSQL** (via port-forward):
   ```bash
   kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432
   ```

### Environment Variables

Create `.env.test` files in each package:

**packages/burger-api/.env.test**:
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=burgerapp
POSTGRES_PASSWORD=your_password
POSTGRES_DB=burgerdb
```

**packages/agent-api/.env.test**:
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=burgerapp
POSTGRES_PASSWORD=your_password
POSTGRES_DB=burgerdb
OPENAI_API_KEY=your_openai_key
```

## Running Tests

### burger-api Tests

```bash
cd packages/burger-api

# Run all tests
npm test

# Run specific test file
npm test -- db-service.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### agent-api Tests

```bash
cd packages/agent-api

# Run all tests
npm test

# Run specific test file
npm test -- user-db-service.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Test Structure

### burger-api Tests

```
packages/burger-api/tests/
├── db-service.test.ts          # Database service tests
│   ├── Burger Operations
│   ├── Topping Operations
│   ├── Order Operations
│   └── User Operations
└── api-endpoints.test.ts       # API endpoint tests
    ├── Health Check
    ├── Burger Endpoints
    ├── Topping Endpoints
    ├── Order Endpoints
    ├── Image Endpoints
    └── OpenAPI Spec
```

### agent-api Tests

```
packages/agent-api/tests/
├── setup.ts                    # Test configuration
└── user-db-service.test.ts     # Chat history tests
    ├── Chat History Operations
    └── PostgreSQL Connection
```

## Test Coverage

### burger-api Coverage

- ✅ Database CRUD operations for burgers, toppings, orders, users
- ✅ Image URL formatting and validation
- ✅ Order lifecycle management
- ✅ API endpoint responses and status codes
- ✅ Query parameter filtering
- ✅ Error handling (404, 400, 401)
- ✅ Image serving and content types
- ✅ OpenAPI specification generation

### agent-api Coverage

- ✅ Chat history save and retrieve operations
- ✅ Message type validation (human/ai)
- ✅ Session management
- ✅ Special character handling
- ✅ Long message handling
- ✅ Concurrent operations
- ✅ PostgreSQL connection pooling

## Integration Testing

### Testing Against Running Services

For API endpoint tests, you can test against running services:

```bash
# Set the API URL
export BURGER_API_URL=http://localhost:8080
export AGENT_API_URL=http://localhost:8081

# Run API tests
cd packages/burger-api
npm test -- api-endpoints.test.ts
```

### Testing Against GKE Deployment

```bash
# Port forward services
kubectl port-forward -n mcp-agent-dev svc/burger-api 8080:8080 &
kubectl port-forward -n mcp-agent-dev svc/agent-api 8081:8080 &
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432 &

# Run tests
export BURGER_API_URL=http://localhost:8080
export AGENT_API_URL=http://localhost:8081
export POSTGRES_HOST=localhost

cd packages/burger-api && npm test
cd packages/agent-api && npm test
```

## CI/CD Integration

Add these scripts to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: burgerdb
          POSTGRES_USER: burgerapp
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - name: Install dependencies
        run: npm ci
      - name: Run burger-api tests
        run: cd packages/burger-api && npm test
      - name: Run agent-api tests
        run: cd packages/agent-api && npm test
```

## Datadog Integration Testing

Tests automatically include Datadog observability when running against instrumented services:

- **APM Traces**: API calls generate traces
- **DBM Queries**: Database operations tracked
- **Logs**: Test execution logged

Monitor test runs in Datadog:
```
service:burger-api env:test
service:agent-api env:test
```

## Troubleshooting

### Database Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running and accessible:
```bash
psql -h localhost -U burgerapp -d burgerdb -c "SELECT 1"
```

### Image Not Found Errors

```
Error: Local file 'burger-pic-1.jpg' not found
```

**Solution**: Ensure data/images directory exists with image files.

### OpenAI API Key Missing

```
Error: OPENAI_API_KEY is required
```

**Solution**: Set the environment variable or use a test key:
```bash
export OPENAI_API_KEY=test-key
```

## Best Practices

1. **Isolated Test Data**: Use unique IDs (timestamps) for test data
2. **Cleanup**: Always clean up test data in `afterAll` hooks
3. **Idempotency**: Tests should be runnable multiple times
4. **Parallelization**: Use `--runInBand` for serial execution if needed
5. **Mocking**: Mock external services (OpenAI, Datadog) in unit tests
6. **Integration**: Test against real services for integration tests

## Writing New Tests

### Template for New Test File

```typescript
import { DbService } from '../src/db-service';

describe('Feature Name', () => {
  let dbService: DbService;

  beforeAll(async () => {
    dbService = await DbService.getInstance();
  });

  afterAll(async () => {
    // Cleanup
    await dbService.close();
  });

  describe('Functionality', () => {
    test('should do something', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await dbService.someMethod(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

## Test Maintenance

- Update tests when API contracts change
- Add tests for new features before implementation (TDD)
- Keep test coverage above 80%
- Review and remove obsolete tests
- Document complex test scenarios

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)
