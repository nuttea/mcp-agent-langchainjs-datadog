// Datadog Real User Monitoring (RUM) initialization
// This file initializes Datadog RUM for the burger webapp
// Reference: https://docs.datadoghq.com/real_user_monitoring/browser/

import { datadogRum } from '@datadog/browser-rum';

// Get environment and API base URL from build environment
const environment = import.meta.env.VITE_ENV || 'dev';
const apiBaseUrl = import.meta.env.VITE_BURGER_API_BASE_URL || 'https://burger-api-dev.platform-engineering-demo.dev';

// Parse base URL for tracing configuration
const baseUrlPattern = new RegExp(`^${apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

datadogRum.init({
  applicationId: '68dec847-5ab8-47a1-8f0f-48767b370d52',
  clientToken: 'pube5e4e2ead92d85670858d3c5017952c3',
  // `site` refers to the Datadog site parameter of your organization
  // see https://docs.datadoghq.com/getting_started/site/
  site: 'datadoghq.com',
  service: 'burger-webapp', // Unique service name for this webapp
  env: environment,
  // Trace sample rate is the percentage of requests to trace
  // Using environment-based URLs for better portability across dev/prod
  allowedTracingUrls: [
    { match: baseUrlPattern, propagatorTypes: ["tracecontext", "datadog"] },
  ],
  traceSampleRate: 100, // Increased from 20 to 100 for full visibility
  traceContextInjection: 'sampled',
  // Specify a version number to identify the deployed version of your application in Datadog
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: environment === 'prod' ? 20 : 100, // Lower replay rate in prod to reduce costs
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  trackBfcacheViews: true,
  defaultPrivacyLevel: 'allow',
});

// Start tracking view changes
datadogRum.startSessionReplayRecording();

console.log('Datadog RUM initialized for burger-webapp:', {
  service: 'burger-webapp',
  env: environment,
  version: '1.0.0',
  apiBaseUrl,
  traceSampleRate: 100,
});
