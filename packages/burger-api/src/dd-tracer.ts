// Datadog Tracer Configuration for Burger API
//
// This service uses code-based tracer initialization (not SSI)
// SSI is reserved for simpler services like burger-mcp
//
// We initialize the tracer with:
// - APM tracing for HTTP, Express, PostgreSQL
// - Log injection (DD_LOGS_INJECTION)
// - Runtime metrics (DD_RUNTIME_METRICS_ENABLED)
// - Profiling (DD_PROFILING_ENABLED)
// - DBM integration for PostgreSQL query correlation
// - Custom business metrics via DogStatsD

import tracer from 'dd-trace';

// Initialize tracer with explicit configuration
const ddTracer = tracer.init({
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  dbmPropagationMode: 'full',
  // Service/env/version come from environment variables (DD_SERVICE, DD_ENV, DD_VERSION)
});

export { ddTracer };

// Log tracer initialization
console.log('Datadog tracer initialized (code-based):', {
  site: process.env.DD_SITE || 'datadoghq.com',
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'burger-api',
  version: process.env.DD_VERSION || 'unknown',
  logsInjection: true,
  profilingEnabled: true,
  dbmPropagationMode: 'full',
});
