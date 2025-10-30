import tracer from 'dd-trace';
import pino from 'pino';

// Initialize Datadog tracer with log injection BEFORE creating logger
// This ensures trace IDs are automatically injected into logs
tracer.init({
  logInjection: true,
  env: process.env.DD_ENV || 'development',
  service: process.env.DD_SERVICE || 'agent-api',
  version: process.env.DD_VERSION || '1.0.0',
  // Enable profiling for better performance insights
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
  // Enable runtime metrics
  runtimeMetrics: true,
});

// Create pino logger with structured logging
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Use pino-pretty for local development only
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Export tracer for advanced usage if needed
export { tracer };
