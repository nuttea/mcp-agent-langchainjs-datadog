// Datadog APM and LLM Observability tracing setup
// This file should be imported at the very beginning of your application
// Reference: https://docs.datadoghq.com/llm_observability/setup/sdk/nodejs/
//
// IMPORTANT: When using SSI (Single Step Instrumentation) with Datadog Cluster Agent,
// dd-trace is automatically initialized by the Kubernetes admission controller.
// This file provides access to the tracer instance and LLM Observability SDK
// without re-initializing, which would conflict with SSI.
//
// SSI automatically configures:
// - APM tracing for HTTP, Express, PostgreSQL
// - Log injection (DD_LOGS_INJECTION)
// - Runtime metrics (DD_RUNTIME_METRICS_ENABLED)
// - Profiling (DD_PROFILING_ENABLED)
// - Environment tagging (DD_ENV, DD_SERVICE, DD_VERSION)
//
// This file adds:
// - LLM Observability SDK for AI agent workflows
// - Access to tracer for custom spans

import tracer from 'dd-trace';

// Use the SSI-initialized tracer (do NOT call tracer.init() again)
// SSI has already configured APM, DBM, profiling, and runtime metrics
const ddTracer = tracer;

// Export the LLM Observability SDK
// LLM Observability is configured via environment variables in Kubernetes ConfigMap:
// - DD_LLMOBS_ENABLED=true
// - DD_LLMOBS_ML_APP=contoso-burgers-agent
// - DD_LLMOBS_AGENTLESS_ENABLED=false
export const llmobs = ddTracer.llmobs;
export { ddTracer };

// Log that we're using SSI-initialized tracer
console.log('Using Datadog tracer with SSI (Single Step Instrumentation):', {
  mlApp: process.env.DD_LLMOBS_ML_APP || 'contoso-burgers-agent',
  llmObsEnabled: process.env.DD_LLMOBS_ENABLED === 'true',
  site: process.env.DD_SITE || 'datadoghq.com',
  env: process.env.DD_ENV || 'dev',
  service: process.env.DD_SERVICE || 'agent-api',
  version: process.env.DD_VERSION || '1.0.0',
  logsInjection: process.env.DD_LOGS_INJECTION === 'true',
  profilingEnabled: process.env.DD_PROFILING_ENABLED === 'true',
  note: 'APM initialized via SSI - tracer.init() not called to avoid conflicts',
});
