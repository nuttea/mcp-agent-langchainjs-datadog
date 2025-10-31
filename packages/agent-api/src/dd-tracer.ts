// Datadog APM and LLM Observability tracing setup
// This file should be imported at the very beginning of your application
// Reference: https://docs.datadoghq.com/llm_observability/setup/sdk/nodejs/

import tracer from 'dd-trace';

// Initialize Datadog tracer with LLM Observability
// Note: DD_SITE, DD_TRACE_DEBUG, and other settings can be set via environment variables
// Reference: https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/
const ddTracer = tracer.init({
  // LLM Observability configuration
  llmobs: {
    mlApp: process.env.DD_LLMOBS_ML_APP || 'contoso-burgers-agent', // Name for your LLM application
    agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === 'true', // Enable agentless mode (sends directly to Datadog)
  },

  // Environment configuration (these can also be set via DD_ENV, DD_SERVICE, DD_VERSION env vars)
  env: process.env.DD_ENV || process.env.NODE_ENV || 'dev',
  service: process.env.DD_SERVICE || 'agent-api',
  version: process.env.DD_VERSION || '1.0.0',

  // APM configuration (logInjection, runtimeMetrics, profiling are set via environment variables)
  logInjection: process.env.DD_LOGS_INJECTION === 'true',
  runtimeMetrics: process.env.DD_RUNTIME_METRICS_ENABLED === 'true',
  profiling: process.env.DD_PROFILING_ENABLED === 'true',
});

// Export the LLM Observability SDK
export const llmobs = ddTracer.llmobs;
export { ddTracer };

// Log initialization
console.log('Datadog LLM Observability initialized:', {
  mlApp: process.env.DD_LLMOBS_ML_APP || 'contoso-burgers-agent',
  site: process.env.DD_SITE || 'datadoghq.com',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  service: process.env.DD_SERVICE || 'agent-api',
  agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === 'true',
});
