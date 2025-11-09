// Datadog Tracer Configuration for Burger MCP
//
// IMPORTANT: When using SSI (Single Step Instrumentation) with Datadog Cluster Agent,
// dd-trace is automatically initialized by the Kubernetes admission controller.
// This file provides access to the tracer instance without re-initializing.
//
// SSI automatically configures:
// - APM tracing for HTTP, Express
// - Log injection (DD_LOGS_INJECTION)
// - Runtime metrics (DD_RUNTIME_METRICS_ENABLED)
// - Profiling (DD_PROFILING_ENABLED)
// - Environment tagging (DD_ENV, DD_SERVICE, DD_VERSION)

import tracer from 'dd-trace';

// Use the SSI-initialized tracer (do NOT call tracer.init() again)
// SSI has already configured APM, profiling, and runtime metrics
const ddTracer = tracer;

export { ddTracer };

// Log that we're using SSI-initialized tracer
console.log('Using Datadog tracer with SSI (Single Step Instrumentation):', {
  site: process.env.DD_SITE || 'datadoghq.com',
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'burger-mcp',
  version: process.env.DD_VERSION || 'unknown',
  logsInjection: process.env.DD_LOGS_INJECTION === 'true',
  profilingEnabled: process.env.DD_PROFILING_ENABLED === 'true',
  note: 'APM initialized via SSI - tracer.init() not called to avoid conflicts',
});
