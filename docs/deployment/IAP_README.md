# Identity-Aware Proxy (IAP) Documentation

Complete documentation for implementing and managing Google Cloud Identity-Aware Proxy (IAP) authentication on the MCP Agent Platform deployed on GKE with Gateway API.

## 📚 Documentation Index

### Quick Start

- **[IAP_QUICK_START.md](IAP_QUICK_START.md)** - Get started with IAP in 5 steps
- **[IAP_QUICK_FIX.md](IAP_QUICK_FIX.md)** - 2-minute fix for OAuth redirect URIs
- **[IAP_DEPLOY_GUIDE.md](IAP_DEPLOY_GUIDE.md)** - Ready-to-deploy guide with commands

### Complete Setup

- **[IAP_SETUP.md](IAP_SETUP.md)** - Comprehensive setup guide (500+ lines)
  - OAuth 2.0 configuration
  - Kubernetes secret management
  - GCPBackendPolicy configuration
  - HealthCheckPolicy setup
  - Application code integration
  - Datadog monitoring setup
  - Security considerations

- **[IAP_COMPLETE_SETUP.md](IAP_COMPLETE_SETUP.md)** - Complete setup for both environments
  - Dev and prod configurations
  - Environment-specific differences
  - Backend service names
  - IAM permission commands

### Implementation Details

- **[IAP_IMPLEMENTATION_SUMMARY.md](IAP_IMPLEMENTATION_SUMMARY.md)** - Technical implementation overview
  - Architecture diagram
  - Code components
  - Data flow
  - Security boundaries
  - Configuration files

- **[IAP_DEPLOYMENT_CHECKLIST.md](IAP_DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment checklist
  - Pre-deployment verification
  - Deployment steps
  - Post-deployment testing
  - Monitoring setup
  - Sign-off template

### Troubleshooting

- **[IAP_REDIRECT_LOOP_TROUBLESHOOTING.md](IAP_REDIRECT_LOOP_TROUBLESHOOTING.md)** - Fix redirect loop issues
  - Root cause analysis
  - OAuth redirect URI configuration
  - Common mistakes
  - Verification steps

- **[IAP_HEALTH_CHECK_FIX.md](IAP_HEALTH_CHECK_FIX.md)** - Fix health check issues with IAP
  - Why health checks fail with IAP
  - Solution: /health endpoint
  - HealthCheckPolicy configuration
  - Implementation steps

### Testing & Verification

- **[IAP_TEST_RESULTS.md](IAP_TEST_RESULTS.md)** - Test results and verification
  - Component verification
  - Backend health status
  - OAuth flow testing
  - Datadog monitoring

- **[IAP_STATUS.md](IAP_STATUS.md)** - Current implementation status
  - Real-time deployment status
  - GitHub Actions build status
  - Configuration summary
  - Next steps

### Architecture

- **[../images/IAP_ARCHITECTURE.md](../images/IAP_ARCHITECTURE.md)** - Visual architecture diagrams
  - Authentication flow
  - Data flow
  - Security boundaries
  - Monitoring dashboards

## 🎯 Quick Navigation

### I want to...

**...get started quickly**
→ [IAP_QUICK_START.md](IAP_QUICK_START.md)

**...understand the complete setup**
→ [IAP_SETUP.md](IAP_SETUP.md)

**...fix the redirect loop**
→ [IAP_QUICK_FIX.md](IAP_QUICK_FIX.md) or [IAP_REDIRECT_LOOP_TROUBLESHOOTING.md](IAP_REDIRECT_LOOP_TROUBLESHOOTING.md)

**...fix health check issues**
→ [IAP_HEALTH_CHECK_FIX.md](IAP_HEALTH_CHECK_FIX.md)

**...deploy to production**
→ [IAP_DEPLOY_GUIDE.md](IAP_DEPLOY_GUIDE.md)

**...check implementation status**
→ [IAP_STATUS.md](IAP_STATUS.md)

**...review the architecture**
→ [IAP_IMPLEMENTATION_SUMMARY.md](IAP_IMPLEMENTATION_SUMMARY.md)

**...verify the deployment**
→ [IAP_TEST_RESULTS.md](IAP_TEST_RESULTS.md)

**...follow a deployment checklist**
→ [IAP_DEPLOYMENT_CHECKLIST.md](IAP_DEPLOYMENT_CHECKLIST.md)

## 🏗️ Implementation Overview

### What is IAP?

Identity-Aware Proxy (IAP) provides enterprise-level authentication and authorization for applications accessed via HTTPS. IAP verifies user identity and uses context to determine if a user should be allowed to access an application.

### Architecture Summary

```
User → Google OAuth → IAP → Gateway API → agent-webapp → agent-api
                                                              ↓
                                                    IAP Headers Extracted
                                                              ↓
                                                    User Context → PostgreSQL
                                                              ↓
                                                    Datadog APM Tags
```

### Key Components

1. **GCPBackendPolicy** - Enables IAP on backend services
2. **HealthCheckPolicy** - Configures health checks to use /health endpoint
3. **OAuth 2.0 Client** - Handles authentication flow
4. **IAP Middleware** - Extracts user headers in application
5. **Datadog Integration** - Monitors authenticated users

## 🔐 Security Features

- OAuth 2.0 authentication via Google Cloud
- IAM-based authorization
- Domain-restricted access
- User context propagation
- Audit logging via Datadog APM
- JWT assertion validation support

## 📊 Observability

### Datadog APM Tags

All authenticated requests include:
- `iap.user.email` - User's email address
- `iap.user.id` - User's unique ID
- `usr.email` - Datadog standard user tag
- `usr.id` - Datadog standard user ID tag

### Monitoring

- User activity tracking
- Authentication success/failure rates
- Performance metrics per user
- Database query correlation (DBM-APM)

## 🔗 External Resources

- [Google Cloud IAP Documentation](https://cloud.google.com/iap/docs)
- [GKE Gateway API Documentation](https://cloud.google.com/kubernetes-engine/docs/how-to/configure-gateway-resources)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [OAuth 2.0 Documentation](https://cloud.google.com/iap/docs/custom-oauth-configuration)

## 📋 Related Documentation

### Deployment Documentation
- [DEPLOY_TO_PROD.md](DEPLOY_TO_PROD.md) - Production deployment guide
- [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) - CI/CD setup
- [GKE_COMPLETE_SETUP.md](GKE_COMPLETE_SETUP.md) - GKE infrastructure

### Monitoring Documentation
- [../monitoring/](../monitoring/) - Datadog monitoring guides

### Testing Documentation
- [../testing/](../testing/) - Testing strategies

## 🎯 Getting Started

1. Start with [IAP_QUICK_START.md](IAP_QUICK_START.md)
2. Review [IAP_IMPLEMENTATION_SUMMARY.md](IAP_IMPLEMENTATION_SUMMARY.md)
3. Follow [IAP_DEPLOY_GUIDE.md](IAP_DEPLOY_GUIDE.md)
4. Use [IAP_DEPLOYMENT_CHECKLIST.md](IAP_DEPLOYMENT_CHECKLIST.md) during deployment
5. Refer to troubleshooting guides as needed

## 📅 Last Updated

November 8, 2025

## 🤖 Credits

Generated with [Claude Code](https://claude.com/claude-code)
