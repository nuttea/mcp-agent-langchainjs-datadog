# MCP Agent Documentation

Complete documentation for the MCP Agent LangChain.js + Datadog demonstration project.

## Quick Links

- **[Testing Quick Start](testing/TEST_QUICKSTART.md)** - Get started with tests in 5 minutes
- **[GKE Deployment Quick Start](deployment/QUICKSTART_GKE_UPDATED.md)** - Deploy to GKE quickly
- **[Production Deployment](deployment/DEPLOY_TO_PROD_QUICKSTART.md)** - Deploy to production

## Documentation Structure

### 🚀 Deployment

Guides for deploying the application to Google Kubernetes Engine (GKE):

- **[QUICKSTART_GKE_UPDATED.md](deployment/QUICKSTART_GKE_UPDATED.md)** - Latest quick start guide for GKE deployment
- **[QUICKSTART_GKE.md](deployment/QUICKSTART_GKE.md)** - Original quick start guide
- **[DEPLOY_GKE.md](deployment/DEPLOY_GKE.md)** - Detailed GKE deployment instructions
- **[GKE_COMPLETE_SETUP.md](deployment/GKE_COMPLETE_SETUP.md)** - Complete setup guide with all configurations
- **[GKE_DEPLOYMENT_SUMMARY.md](deployment/GKE_DEPLOYMENT_SUMMARY.md)** - Summary of GKE deployment
- **[DEPLOYMENT_SUMMARY.md](deployment/DEPLOYMENT_SUMMARY.md)** - General deployment summary
- **[BRANCH_DEPLOYMENT_SUMMARY.md](deployment/BRANCH_DEPLOYMENT_SUMMARY.md)** - Branch-specific deployment details
- **[DEV_DEPLOYMENT_TEST.md](deployment/DEV_DEPLOYMENT_TEST.md)** - Development environment testing
- **[DEPLOY_TO_PROD.md](deployment/DEPLOY_TO_PROD.md)** - Detailed production deployment guide
- **[DEPLOY_TO_PROD_QUICKSTART.md](deployment/DEPLOY_TO_PROD_QUICKSTART.md)** - Quick production deployment
- **[SECRETS_MANAGEMENT.md](deployment/SECRETS_MANAGEMENT.md)** - Managing secrets in Kubernetes
- **[SECRETS_SETUP_COMPLETE.md](deployment/SECRETS_SETUP_COMPLETE.md)** - Complete secrets setup guide

**Key Topics:** Kubernetes, GKE, Docker, ConfigMaps, Secrets, Load Balancers, Ingress

### 🧪 Testing

Test infrastructure and execution guides:

- **[TEST_QUICKSTART.md](testing/TEST_QUICKSTART.md)** - Quick start guide for running tests (5 minutes)
- **[TESTING.md](testing/TESTING.md)** - Comprehensive testing documentation

**Test Coverage:**
- **burger-api**: 20 database integration tests (burgers, toppings, orders, users)
- **agent-api**: 11 user service tests (PostgreSQL, concurrent operations, edge cases)

**Key Topics:** Jest, TypeScript Testing, PostgreSQL Integration Tests, Supertest

### 📊 Monitoring

Datadog monitoring, APM, and Database Monitoring (DBM) setup:

- **[DBM_VALIDATION_REPORT.md](monitoring/DBM_VALIDATION_REPORT.md)** - Database Monitoring validation results
- **[DBM_APM_CORRELATION_SUMMARY.md](monitoring/DBM_APM_CORRELATION_SUMMARY.md)** - APM and DBM correlation setup
- **[DBM_HOSTNAME_FIX.md](monitoring/DBM_HOSTNAME_FIX.md)** - Fixing hostname issues in DBM
- **[SCHEMA_COLLECTION_SUMMARY.md](monitoring/SCHEMA_COLLECTION_SUMMARY.md)** - Database schema collection setup

**Key Features:**
- APM traces for all HTTP requests and database queries
- Database Monitoring with query metrics and execution plans
- DBM-APM correlation for end-to-end visibility
- Custom instrumentation with dd-trace

**Key Topics:** Datadog Agent, APM, DBM, PostgreSQL Monitoring, Distributed Tracing

### 🏗️ Architecture

System architecture and design documentation:

- **[AGENTS.md](architecture/AGENTS.md)** - Agent architecture and implementation details

**Key Components:**
- LangChain.js agent with tool calling
- MCP (Model Context Protocol) integration
- PostgreSQL database with connection pooling
- Express.js REST APIs
- Datadog APM and DBM instrumentation

**Key Topics:** LangChain.js, MCP, Agent Design, Tool Calling, RAG

## Getting Started

### Prerequisites

- Docker and Docker Compose
- kubectl and gcloud CLI
- Node.js 18+ and npm
- Google Cloud account with GKE access
- Datadog account (for monitoring)

### Quick Start Paths

#### 1. Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d postgres

# Run services locally
npm run dev
```

#### 2. Deploy to GKE Dev Environment

Follow [QUICKSTART_GKE_UPDATED.md](deployment/QUICKSTART_GKE_UPDATED.md)

#### 3. Run Tests

Follow [TEST_QUICKSTART.md](testing/TEST_QUICKSTART.md)

#### 4. Deploy to Production

Follow [DEPLOY_TO_PROD_QUICKSTART.md](deployment/DEPLOY_TO_PROD_QUICKSTART.md)

## Project Structure

```
mcp-agent-langchainjs-datadog/
├── docs/                          # Documentation (you are here)
│   ├── deployment/               # Deployment guides
│   ├── testing/                  # Testing guides
│   ├── monitoring/               # Monitoring setup
│   └── architecture/             # Architecture docs
├── k8s/                          # Kubernetes manifests
│   ├── base/                     # Base resources
│   ├── dev/                      # Dev environment
│   └── prod/                     # Production environment
├── packages/
│   ├── agent-api/               # LangChain agent API
│   ├── agent-webapp/            # Agent web interface
│   ├── burger-api/              # Burger ordering API
│   ├── burger-mcp/              # MCP server
│   └── burger-webapp/           # Burger web interface
└── README.md                    # Project overview
```

## Common Tasks

### Update Secrets

```bash
# Follow the secrets management guide
cat docs/deployment/SECRETS_MANAGEMENT.md
```

### View Logs

```bash
# Agent API logs
kubectl logs -n mcp-agent-dev deployment/agent-api --tail=50 -f

# Burger API logs
kubectl logs -n mcp-agent-dev deployment/burger-api --tail=50 -f

# PostgreSQL logs
kubectl logs -n mcp-agent-dev statefulset/postgres --tail=50 -f
```

### Access Services

```bash
# Port forward to access locally
kubectl port-forward -n mcp-agent-dev svc/agent-api 3000:3000
kubectl port-forward -n mcp-agent-dev svc/burger-api 8080:8080
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432
```

### Run Tests

```bash
# Port forward PostgreSQL
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432 &

# Run burger-api tests
cd packages/burger-api
npm test

# Run agent-api tests
cd packages/agent-api
npm test
```

## Troubleshooting

### Common Issues

1. **Pod not starting**: Check logs and events
   ```bash
   kubectl describe pod <pod-name> -n mcp-agent-dev
   kubectl logs <pod-name> -n mcp-agent-dev
   ```

2. **Database connection issues**: Verify secrets and PostgreSQL status
   ```bash
   kubectl get secret postgres-secret -n mcp-agent-dev -o yaml
   kubectl logs -n mcp-agent-dev statefulset/postgres --tail=50
   ```

3. **Tests failing**: Ensure PostgreSQL is accessible and credentials are correct
   - See [TESTING.md](testing/TESTING.md) troubleshooting section

4. **Datadog metrics not showing**: Verify agent configuration
   - See [DBM_VALIDATION_REPORT.md](monitoring/DBM_VALIDATION_REPORT.md)

## Contributing

When adding new documentation:

1. Place files in the appropriate category directory
2. Update this README.md with a link to the new document
3. Use clear, descriptive filenames
4. Include a brief description of what the document covers

## Additional Resources

- [LangChain.js Documentation](https://js.langchain.com/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Datadog DBM Documentation](https://docs.datadoghq.com/database_monitoring/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine/docs)
