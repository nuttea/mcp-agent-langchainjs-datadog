import pino from 'pino';

// When using SSI (Single Step Instrumentation), dd-trace is already initialized
// by the Datadog Cluster Agent. Pino automatically gets trace IDs injected
// when DD_LOGS_INJECTION=true is set in the environment.
//
// This logger provides structured JSON logging that correlates with APM traces.

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
