// Datadog Real User Monitoring (RUM) initialization
// This file initializes Datadog RUM for the burger webapp
// Reference: https://docs.datadoghq.com/real_user_monitoring/browser/

import { datadogRum } from '@datadog/browser-rum';

// Get environment from build or default to dev
const environment = import.meta.env.VITE_ENV || 'dev';

datadogRum.init({
  applicationId: '68dec847-5ab8-47a1-8f0f-48767b370d52',
  clientToken: 'pube5e4e2ead92d85670858d3c5017952c3',
  // `site` refers to the Datadog site parameter of your organization
  // see https://docs.datadoghq.com/getting_started/site/
  site: 'datadoghq.com',
  service: 'burgers-ai-agent',
  env: environment,
  // Trace sample rate is the percentage of requests to trace
  allowedTracingUrls: [
    { match:"https://dev.platform-engineering-demo.dev", propagatorTypes: ["tracecontext", "datadog"] },
    // Matches any subdomain of my-api-domain.com, such as https://foo.my-api-domain.com
    { match: /^https:\/\/[^\/]+\.dev\.platform-engineering-demo\.dev/, propagatorTypes: ["tracecontext", "datadog"] },
    // You can also use a function for advanced matching:
    { match: (url: string) => url.startsWith("https://dev.platform-engineering-demo.dev"), propagatorTypes: ["tracecontext", "datadog"] }
  ],
  traceSampleRate: 20,
  traceContextInjection: 'sampled',
  // Specify a version number to identify the deployed version of your application in Datadog
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  trackBfcacheViews: true,
  defaultPrivacyLevel: 'allow',
});

// Start tracking view changes
datadogRum.startSessionReplayRecording();

console.log('Datadog RUM initialized for burger-webapp:', {
  service: 'burgers-ai-agent',
  env: environment,
  version: '1.0.0',
});
