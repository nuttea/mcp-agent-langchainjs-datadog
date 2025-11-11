import tracer from 'dd-trace';
import pino from 'pino';

// When using SSI (Single Step Instrumentation), dd-trace is already initialized
// by the Datadog Cluster Agent. We just import and use the tracer directly.
// SSI automatically enables:
// - Log injection (DD_LOGS_INJECTION=true)
// - Profiling (DD_PROFILING_ENABLED=true)
// - Runtime metrics (DD_RUNTIME_METRICS_ENABLED=true)
//
// No need to call tracer.init() - it would conflict with SSI.

// Create pino logger with structured logging
// SSI automatically injects trace IDs into pino logs when DD_LOGS_INJECTION=true
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

// Export tracer for advanced usage (custom spans)
export { tracer };
