// Datadog APM and LLM Observability tracing setup
// This file should be imported at the very beginning of your application
// Reference: https://docs.datadoghq.com/llm_observability/setup/sdk/nodejs/
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
// - LLM Observability for AI agent workflows

import tracer from 'dd-trace';

// Initialize tracer with explicit configuration
const ddTracer = tracer.init({
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  dbmPropagationMode: 'full',
  // Service/env/version come from environment variables (DD_SERVICE, DD_ENV, DD_VERSION)
});

// Export the LLM Observability SDK
// LLM Observability is configured via environment variables in Kubernetes ConfigMap:
// - DD_LLMOBS_ENABLED=true
// - DD_LLMOBS_ML_APP=contoso-burgers-agent
// - DD_LLMOBS_AGENTLESS_ENABLED=false
export const llmobs = ddTracer.llmobs;
export { ddTracer };

// Log tracer initialization
console.log('Datadog tracer initialized (code-based):', {
  mlApp: process.env.DD_LLMOBS_ML_APP || 'contoso-burgers-agent',
  llmObsEnabled: process.env.DD_LLMOBS_ENABLED === 'true',
  site: process.env.DD_SITE || 'datadoghq.com',
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'agent-api',
  version: process.env.DD_VERSION || '1.0.0',
  logsInjection: true,
  profilingEnabled: true,
  dbmPropagationMode: 'full',
});
