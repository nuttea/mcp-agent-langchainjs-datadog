---
layout: default
title: Home
---

# MCP Agent with LangChain.js + Datadog Observability

[![Kubernetes](https://img.shields.io/badge/Kubernetes-Deployment-blue?style=flat-square&logo=kubernetes)](https://kubernetes.io/)
[![Datadog](https://img.shields.io/badge/Datadog-Observability-purple?style=flat-square&logo=datadog)](https://www.datadoghq.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

> **About This Fork**
> This repository is forked from [Azure-Samples/mcp-agent-langchainjs](https://github.com/Azure-Samples/mcp-agent-langchainjs) and enhanced with **Kubernetes-native deployment** for any cluster (GKE, EKS, AKS, on-premises), **PostgreSQL database**, **Datadog end-to-end observability**, and **comprehensive testing**.

## Quick Navigation

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Deployment Guides](#deployment-guides)
- [Testing](#testing)
- [Monitoring](#monitoring)

---

## 🍔 **NEW: Bits Learn to Bites Blog Series!**

Learn Datadog observability through bite-sized lessons using this project as a real-world example.

**[📖 Read the Blog Series →](./blog/)**

**Latest Episode:** [Episode 1: The Secret Sauce - SSI](./blog/episode-01-ssi.md)

**What you'll learn:**
- SSI (Single Step Instrumentation) for zero-code APM
- Structured logging with trace correlation
- LLM Observability for AI agents
- Business metrics and dashboards
- **Includes AI prompts** for exploring with Claude + Datadog MCP!

---

## Overview

This project demonstrates how to build production-ready AI agents using **LangChain.js** and **Model Context Protocol (MCP)**. It features a complete burger ordering system with REST APIs, web interfaces, and an MCP server that enables AI agents to interact with real-world services.

### Key Features

**Core Functionality:**
- LangChain.js agent with tool calling via MCP (Streamable HTTP transport)
- Multi-service architecture (web UIs, APIs, MCP server)
- User authentication with session history in PostgreSQL
- Chat history persistence across sessions

**Kubernetes & Infrastructure:**
- Deploy to any Kubernetes cluster (GKE, EKS, AKS, on-premises)
- Kustomize-based configuration management (base + overlays)
- Health checks, liveness/readiness probes
- Horizontal Pod Autoscaling
- Persistent storage with StatefulSets
- Production-ready security contexts (non-root containers, PDBs)

**Observability with Datadog:**
- Application Performance Monitoring (APM) with distributed tracing
- Database Monitoring (DBM) with query metrics and execution plans
- DBM-APM correlation for end-to-end visibility
- Custom instrumentation with dd-trace
- Real-time metrics and dashboards

**Testing & Quality:**
- 31+ integration tests (Jest + TypeScript)
- Database integration tests
- API endpoint tests
- Concurrent operations testing

## Architecture

![Architecture diagram](images/architecture.drawio.png?raw=true)

### Components

| Component         | Purpose                                      |
| ----------------- | -------------------------------------------- |
| Agent Web App     | Chat interface + conversation rendering      |
| Agent API         | LangChain.js agent + chat state + MCP client |
| Burger API        | Core burger & order management web API       |
| Burger MCP Server | Exposes burger API as MCP tools              |
| Burger Web App    | Live orders visualization                    |
| PostgreSQL        | Database for burgers, orders, and users      |

See [Architecture Documentation](architecture/) for detailed design.

## Getting Started

### Prerequisites

- **Kubernetes cluster**: GKE, EKS, AKS, Minikube, or Kind
- **kubectl**: [Install kubectl](https://kubernetes.io/docs/tasks/tools/)
- **Node.js 18+**: [Install Node.js](https://nodejs.org/)
- **OpenAI API key**: [Get one from OpenAI](https://platform.openai.com/api-keys)
- **Datadog account** (optional): [Sign up for Datadog](https://www.datadoghq.com/)

### Quick Deploy to GKE

```bash
# 1. Create GKE cluster
gcloud container clusters create mcp-agent-cluster \
  --zone=us-central1-a \
  --num-nodes=3

# 2. Create namespace
kubectl create namespace mcp-agent-dev

# 3. Generate secrets
./k8s/scripts/generate-secrets.sh dev

# 4. Deploy with Make
make deploy ENV=dev

# 5. Check status
kubectl get pods -n mcp-agent-dev
```

For detailed instructions, see [Deployment Guides](#deployment-guides).

## Deployment Guides

### Quick Starts

- **[GKE Quick Start](deployment/QUICKSTART_GKE_UPDATED.md)** - Deploy to GKE in minutes
- **[Production Quick Start](deployment/DEPLOY_TO_PROD_QUICKSTART.md)** - Production deployment guide

### Complete Guides

- **[Kubernetes Deployment](deployment/README.md)** - Complete Kubernetes deployment documentation
- **[Kustomize Migration](deployment/KUSTOMIZE_MIGRATION_COMPLETE.md)** - How we migrated to Kustomize overlays
- **[Secrets Management](deployment/SECRETS_MANAGEMENT.md)** - Managing Kubernetes secrets
- **[Security Best Practices](deployment/K8S_SECURITY_AUDIT_REPORT.md)** - Security audit and fixes
- **[Critical Fixes](deployment/K8S_CRITICAL_FIXES_IMPLEMENTATION.md)** - Production-ready improvements

### Infrastructure

- **[GKE Complete Setup](deployment/GKE_COMPLETE_SETUP.md)** - Comprehensive GKE setup guide
- **[Production Deployment](deployment/DEPLOY_TO_PROD.md)** - Detailed production deployment

## Testing

Get started with testing in 5 minutes:

- **[Test Quick Start](testing/TEST_QUICKSTART.md)** - Run tests quickly
- **[Testing Guide](testing/TESTING.md)** - Comprehensive testing documentation

### Test Coverage

- **burger-api**: 20 database integration tests (burgers, toppings, orders, users)
- **agent-api**: 11 user service tests (PostgreSQL, concurrent operations, edge cases)

## Monitoring

Comprehensive Datadog observability documentation:

- **[Monitoring Overview](monitoring/README.md)** - Main monitoring documentation
- **[DBM Validation](monitoring/DBM_VALIDATION_REPORT.md)** - Database monitoring setup
- **[APM-DBM Correlation](monitoring/DBM_APM_CORRELATION_SUMMARY.md)** - End-to-end trace correlation
- **[Schema Collection](monitoring/SCHEMA_COLLECTION_SUMMARY.md)** - Database schema monitoring

### Observability Features

**Application Performance Monitoring (APM):**
- Distributed tracing across all services
- Custom instrumentation with dd-trace
- Service maps and dependency visualization
- Performance metrics and error tracking

**Database Monitoring (DBM):**
- Query metrics (execution time, frequency)
- Query samples with EXPLAIN plans
- Blocking query detection
- Schema collection and statistics

**DBM-APM Correlation:**
- Link database queries to application traces
- Trace context propagation via SQL comments
- Performance debugging in full context

## Additional Resources

### Reference Documentation

- [copilot.md](copilot.md) - GitHub Copilot integration guide
- [eli5.md](eli5.md) - Explain it like I'm 5 (simplified explanations)
- [agent.ipynb.md](agent.ipynb.md) - Jupyter notebook documentation

### Blog Posts

Check out [blog/](blog/) for articles and tutorials.

### External Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [LangChain.js Documentation](https://js.langchain.com/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Datadog DBM Documentation](https://docs.datadoghq.com/database_monitoring/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

## Project Links

- **Main Repository**: [GitHub](https://github.com/Azure-Samples/mcp-agent-langchainjs)
- **Original Azure Version**: [Azure-Samples/mcp-agent-langchainjs](https://github.com/Azure-Samples/mcp-agent-langchainjs)
- **Documentation Source**: [docs/](https://github.com/Azure-Samples/mcp-agent-langchainjs/tree/main/docs)

## Contributing

When adding new documentation:

1. Place files in the appropriate category directory
2. Update README.md with a link to the new document
3. Use clear, descriptive filenames
4. Include a brief description of what the document covers

## Credits

Original project by the [Azure AI team](https://github.com/Azure-Samples). This fork adds Kubernetes compatibility, PostgreSQL support, and Datadog observability.
