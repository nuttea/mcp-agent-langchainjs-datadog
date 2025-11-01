# Test Quick Start Guide

Get up and running with tests in 5 minutes!

## 1. Install Test Dependencies

```bash
# Run the installation script
./install-test-deps.sh

# Or install manually
cd packages/burger-api && npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
cd packages/agent-api && npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

## 2. Set Up PostgreSQL

**Option A: Use GKE PostgreSQL (Recommended)**

```bash
# Port forward PostgreSQL from GKE
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432
```

**Option B: Local PostgreSQL**

```bash
# Run PostgreSQL in Docker
docker run --name postgres-test \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=burgerdb \
  -e POSTGRES_USER=burgerapp \
  -p 5432:5432 \
  -d postgres:15
```

## 3. Configure Environment

Create `.env.test` files:

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
OPENAI_API_KEY=test-key
```

## 4. Run Tests

### burger-api Tests

```bash
cd packages/burger-api
npm test
```

Expected output:
```
PASS tests/db-service.test.ts
  ✓ Burger Operations (5 tests)
  ✓ Topping Operations (4 tests)
  ✓ Order Operations (7 tests)
  ✓ User Operations (5 tests)

Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

### agent-api Tests

```bash
cd packages/agent-api
npm test
```

Expected output:
```
PASS tests/user-db-service.test.ts
  ✓ Chat History Operations (8 tests)
  ✓ PostgreSQL Connection (2 tests)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## 5. Run API Endpoint Tests

First, start the services or port-forward from GKE:

```bash
# Port forward burger-api
kubectl port-forward -n mcp-agent-dev svc/burger-api 8080:8080

# In another terminal, set the URL and run tests
export BURGER_API_URL=http://localhost:8080
cd packages/burger-api
npm test -- api-endpoints.test.ts
```

## Test Commands Cheat Sheet

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run specific test file
npm test -- db-service.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="Burger"

# Run in CI mode
npm run test:ci
```

## Troubleshooting

### "Cannot connect to database"

✅ **Solution**: Verify PostgreSQL is running
```bash
psql -h localhost -U burgerapp -d burgerdb -c "SELECT 1"
```

### "OPENAI_API_KEY is required"

✅ **Solution**: Add to .env.test or use test key
```bash
export OPENAI_API_KEY=test-key
```

### "Port 5432 already in use"

✅ **Solution**: Kill existing connection
```bash
lsof -ti:5432 | xargs kill -9
```

## What Gets Tested?

### burger-api
- ✅ Database operations (burgers, toppings, orders, users)
- ✅ API endpoints (/api/burgers, /api/toppings, /api/orders)
- ✅ Image serving
- ✅ OpenAPI specification
- ✅ Error handling

### agent-api
- ✅ Chat history persistence
- ✅ PostgreSQL integration
- ✅ Session management
- ✅ Concurrent operations

## Next Steps

1. ✅ Run tests locally
2. ✅ Check test coverage: `npm run test:coverage`
3. ✅ Add tests for new features
4. ✅ Integrate with CI/CD
5. ✅ Monitor test results in Datadog

See [TESTING.md](TESTING.md) for detailed documentation.
