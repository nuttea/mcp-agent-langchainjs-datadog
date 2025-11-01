// Test setup file
// This runs before all tests

// Mock dd-trace to avoid initialization issues in tests
jest.mock('dd-trace', () => ({
  init: jest.fn(() => ({
    trace: jest.fn(),
    wrap: jest.fn(),
    use: jest.fn(),
  })),
  tracer: {
    trace: jest.fn(),
    wrap: jest.fn(),
  },
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'burgerapp';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'burgerdb';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'test_password';

// Mock OpenAI API key
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
