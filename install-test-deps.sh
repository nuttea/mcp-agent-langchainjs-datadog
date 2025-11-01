#!/bin/bash
set -e

echo "Installing test dependencies for burger-api..."
cd packages/burger-api
npm install --save-dev \
  jest@^29.7.0 \
  @types/jest@^29.5.0 \
  ts-jest@^29.1.0 \
  supertest@^6.3.0 \
  @types/supertest@^6.0.0

echo ""
echo "Installing test dependencies for agent-api..."
cd ../agent-api
npm install --save-dev \
  jest@^29.7.0 \
  @types/jest@^29.5.0 \
  ts-jest@^29.1.0 \
  supertest@^6.3.0 \
  @types/supertest@^6.0.0

echo ""
echo "Test dependencies installed successfully!"
echo "You can now run tests with: npm test"
