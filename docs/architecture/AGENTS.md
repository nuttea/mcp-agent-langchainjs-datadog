# MCP Agent LangChain.js + Datadog Project Instructions

## Project Overview

This is a production-ready, Kubernetes-native implementation of an AI agent system using LangChain.js with Model Context Protocol (MCP) integration. The project demonstrates a complete burger ordering platform with end-to-end Datadog observability.

**Fork Information**: This repository is forked from [Azure-Samples/mcp-agent-langchainjs](https://github.com/Azure-Samples/mcp-agent-langchainjs) and enhanced with Kubernetes-native deployment, PostgreSQL database, and comprehensive Datadog observability.

## High-Level Architecture

### Three-Layer System Design

The system is organized into three main service layers:

1. **Agent Layer**: AI chat interface with LangChain.js agents
   - `agent-webapp`: React-based chat UI
   - `agent-api`: LangChain.js agent runtime with MCP client integration

2. **Business Layer**: Burger ordering platform
   - `burger-api`: REST API for burgers, toppings, and orders
   - `burger-webapp`: Real-time order visualization dashboard

3. **MCP Layer**: Model Context Protocol server
   - `burger-mcp`: Exposes burger API as LLM-callable tools via MCP

4. **Data Layer**: PostgreSQL database
   - User authentication and sessions
   - Burger menu and toppings catalog
   - Order management
   - Chat history persistence

### Component Communication Flow

```
User → agent-webapp → agent-api → LangChain.js Agent
                                        ↓
                                   MCP Client (Streamable HTTP)
                                        ↓
                                   burger-mcp (MCP Server)
                                        ↓
                                   burger-api (REST API)
                                        ↓
                                   PostgreSQL Database
```

### Observability Stack

**Datadog Integration** provides comprehensive monitoring:
- **APM (Application Performance Monitoring)**: Distributed tracing across all services
- **DBM (Database Monitoring)**: PostgreSQL query metrics and execution plans
- **DBM-APM Correlation**: Link database queries to application traces
- **Custom Metrics**: Business and performance metrics
- **Real-time Dashboards**: Service health and performance visualization

```
All Services → dd-trace instrumentation → Datadog Agent → Datadog Platform
PostgreSQL → DBM integration → Datadog Platform
```

## Repository Structure

```
mcp-agent-langchainjs-datadog/
├── AGENTS.md                      # This file (AI agent context)
├── README.md                      # Project overview and getting started
├── Makefile                       # Build and deployment automation
├── package.json                   # Root npm workspace configuration
│
├── docs/                          # Documentation (GitHub Pages)
│   ├── index.md                   # GitHub Pages landing page
│   ├── _config.yml                # Jekyll configuration
│   ├── README.md                  # Documentation index
│   ├── architecture/              # Architecture documentation
│   ├── deployment/                # Kubernetes deployment guides
│   ├── testing/                   # Testing guides and strategies
│   ├── monitoring/                # Datadog observability setup
│   └── images/                    # Diagrams and screenshots
│
├── k8s/                           # Kubernetes infrastructure
│   ├── base/                      # Base Kustomize resources
│   │   ├── agent-api.yaml         # Agent API deployment
│   │   ├── agent-webapp.yaml      # Agent webapp deployment
│   │   ├── burger-api.yaml        # Burger API deployment
│   │   ├── burger-mcp.yaml        # MCP server deployment
│   │   ├── burger-webapp.yaml     # Burger webapp deployment
│   │   ├── postgres.yaml          # PostgreSQL StatefulSet
│   │   ├── configmap.yaml         # Application configuration
│   │   ├── hpa-*.yaml             # Horizontal Pod Autoscalers
│   │   └── kustomization.yaml     # Base kustomization
│   ├── overlays/
│   │   ├── dev/                   # Development environment
│   │   │   ├── kustomization.yaml # Dev-specific config
│   │   │   ├── secrets.yaml       # Dev secrets (gitignored)
│   │   │   ├── httproute.yaml     # Dev HTTPRoutes
│   │   │   └── patches/           # Dev-specific patches
│   │   └── prod/                  # Production environment
│   │       ├── kustomization.yaml # Prod-specific config
│   │       ├── secrets.yaml       # Prod secrets (gitignored)
│   │       ├── httproute.yaml     # Prod HTTPRoute
│   │       └── patches/           # Prod-specific patches
│   ├── gateway-infra/             # Shared Gateway API resources
│   │   ├── gateway.yaml           # Kubernetes Gateway
│   │   └── kustomization.yaml
│   ├── scripts/
│   │   └── generate-secrets.sh    # Multi-environment secrets generator
│   └── datadog/                   # Datadog agent configuration
│
├── packages/                      # NPM workspace packages
│   ├── agent-api/                 # LangChain.js agent runtime
│   │   ├── src/
│   │   │   ├── express-server.ts  # Express server with MCP client
│   │   │   ├── agent.ts           # LangChain.js agent configuration
│   │   │   └── services/          # User and session services
│   │   ├── Dockerfile             # Container image
│   │   └── package.json
│   │
│   ├── agent-webapp/              # Agent chat interface
│   │   ├── src/
│   │   │   ├── components/        # React components
│   │   │   ├── services/          # API client services
│   │   │   └── datadog-rum.ts     # Datadog RUM integration
│   │   ├── Dockerfile
│   │   ├── nginx.conf             # Nginx configuration
│   │   └── package.json
│   │
│   ├── burger-api/                # Burger ordering API
│   │   ├── src/
│   │   │   ├── express-server.ts  # Express server with routes
│   │   │   ├── db/                # Database connection and queries
│   │   │   ├── routes/            # REST API endpoints
│   │   │   └── services/          # BlobService for images
│   │   ├── data/
│   │   │   ├── images/            # Burger and topping images
│   │   │   ├── burgers.json       # Menu data
│   │   │   └── toppings.json      # Toppings catalog
│   │   ├── tests/                 # Jest integration tests
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── burger-mcp/                # MCP server
│   │   ├── src/
│   │   │   ├── index.ts           # MCP server implementation
│   │   │   └── tools/             # MCP tool definitions
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── burger-webapp/             # Order visualization dashboard
│   │   ├── src/
│   │   │   ├── components/        # React components
│   │   │   └── datadog-rum.ts     # Datadog RUM integration
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   └── package.json
│   │
│   ├── agent-cli/                 # Command-line agent interface
│   │   └── src/
│   │       └── index.ts
│   │
│   └── burger-data/               # Data generation scripts
│       └── generate-images.js     # Generate burger images
│
├── scripts/                       # Repository-wide scripts
│   └── deploy.sh                  # Deployment automation
│
└── logs/                          # Build and deployment logs (gitignored)
```

## Key Architectural Patterns

### 1. Kubernetes-Native Deployment

**Kustomize-Based Configuration Management**:
- Base resources define common configurations
- Overlays provide environment-specific customizations (dev/prod)
- Patches modify resources per environment (replicas, resources, URLs)
- Secrets generated via scripts, never committed to git

**Production-Ready Features**:
- Health checks (liveness, readiness, startup probes)
- Resource limits and requests
- Horizontal Pod Autoscaling (HPA)
- Pod Disruption Budgets (PDB)
- Non-root security contexts
- StatefulSets for PostgreSQL with persistent volumes
- Gateway API for L7 routing with HTTPRoutes

### 2. Database Architecture

**PostgreSQL as Primary Data Store**:
- Replaces Azure Cosmos DB from original project
- Standard SQL for better compatibility and tooling
- Connection pooling for performance
- Instrumented with Datadog DBM for query monitoring

**Database Schema**:
- `users`: Authentication and user profiles
- `burgers`: Menu items with images
- `toppings`: Customization options with categories
- `orders`: Order management with status tracking
- `conversations`: Chat history with user context
- `messages`: Individual chat messages with metadata

**Database Initialization**:
- `postgres-init-job`: Kubernetes Job for schema creation and seed data
- Idempotent SQL scripts for reproducible deployments
- Separate seed data for burgers (10 items) and toppings (22 items)

### 3. Authentication & State Management

**User Context Flow**:
1. Frontend authentication provides `userId`
2. `agent-api` validates sessions and retrieves user context
3. User context propagates through MCP calls for personalized operations
4. PostgreSQL stores chat history and user sessions

**Session Persistence**:
- Chat conversations stored with user association
- Message history preserved across sessions
- LangChain.js memory backed by PostgreSQL

### 4. Observability Architecture

**Datadog APM Integration**:
- `dd-trace` instrumentation in all Node.js services
- Distributed tracing with trace context propagation
- Service maps showing dependencies
- Custom spans for business logic

**Datadog DBM Integration**:
- PostgreSQL metrics collection
- Query samples with execution plans
- Blocking query detection
- Schema collection for table statistics

**DBM-APM Correlation**:
- SQL comments contain trace IDs (`/* ... */`)
- Database queries linked to originating HTTP requests
- End-to-end visibility from user action to database query

**Real User Monitoring (RUM)**:
- Frontend instrumentation in agent-webapp and burger-webapp
- User session replay and error tracking
- Performance metrics for page loads and interactions

### 5. MCP Protocol Implementation

**Streamable HTTP Transport**:
- Modern HTTP-based MCP transport
- Replaces legacy SSE (Server-Sent Events)
- Better compatibility with Kubernetes ingress/gateway
- Request-response style communication

**Tool Catalog**:
- `get_burgers`: List all menu items
- `get_burger_by_id`: Retrieve specific burger
- `get_toppings`: List available toppings
- `get_topping_by_id`: Retrieve specific topping
- `get_topping_categories`: List topping categories
- `get_orders`: List orders (filtered by user)
- `get_order_by_id`: Retrieve specific order
- `place_order`: Create new order (requires userId)
- `delete_order_by_id`: Cancel pending order (requires userId)

### 6. TypeScript & Build Conventions

**Code Quality**:
- Shared XO linting configuration with project-specific overrides
- NPM workspace-based dependency management
- ESM modules with `.js` extensions in imports
- Keep code simple and straightforward: avoid unnecessary complexity
- Self-explanatory code: minimize comments, use clear naming

**Testing Strategy**:
- Jest for unit and integration tests
- Supertest for API endpoint testing
- PostgreSQL integration tests with real database
- 31+ tests across burger-api and agent-api
- Test environment variables for database connection

## Infrastructure as Code

### Makefile Automation

The `Makefile` provides deployment automation:

```makefile
make deploy ENV=dev           # Deploy to dev environment
make deploy ENV=prod          # Deploy to prod environment
make k8s-apply ENV=dev        # Apply Kubernetes manifests
make k8s-delete ENV=dev       # Delete environment
make secrets-generate ENV=dev # Generate secrets
make gateway-deploy           # Deploy Gateway infrastructure
```

### Secrets Management

**Multi-Environment Secrets**:
- `k8s/scripts/generate-secrets.sh` generates secrets for dev/prod
- Environment-specific configuration from environment variables
- Secrets stored in `k8s/overlays/{env}/secrets.yaml` (gitignored)
- Automatic generation before deployment via Makefile dependency

**Required Environment Variables**:
- `OPENAI_API_KEY`: OpenAI API access
- `DD_API_KEY`: Datadog API key
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: Database credentials
- `JWT_SECRET`: Session token signing
- `PUBLIC_BASE_URL`: Base URL for image serving

### Gateway API Configuration

**Shared Gateway Infrastructure**:
- Single Gateway resource in `shared-infra` namespace
- HTTPRoute per environment for routing rules
- TLS termination with Google-managed certificates
- Path-based routing to appropriate services

## CI/CD Pipelines

**Automation Tools**:
- **Makefile**: Local development and deployment
- **GitHub Actions**: CI/CD pipelines (future enhancement)
- **Docker**: Multi-stage builds for container images
- **Kustomize**: Declarative configuration management

**Deployment Workflow**:
1. Generate environment-specific secrets
2. Build container images (if needed)
3. Apply Kustomize overlays to Kubernetes
4. Wait for rollout completion
5. Verify service health

## Documentation Organization

**GitHub Pages**: Hosted at `docs/` on main branch
- `docs/index.md`: Landing page
- `docs/_config.yml`: Jekyll configuration
- `docs/deployment/`: Kubernetes deployment guides (22 files)
- `docs/testing/`: Testing documentation (3 files)
- `docs/monitoring/`: Datadog observability setup (5 files)
- `docs/architecture/`: System design documentation

**AGENTS.md Location**: Must remain at repository root for AI agent context

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d postgres

# Run all services
npm start
```

### Deploy to Kubernetes

```bash
# Set up environment variables
export OPENAI_API_KEY="your-key"
export DD_API_KEY="your-datadog-key"

# Deploy to dev
make deploy ENV=dev

# Check status
kubectl get pods -n mcp-agent-dev

# View logs
kubectl logs -n mcp-agent-dev deployment/agent-api -f
```

### Run Tests

```bash
# Port forward PostgreSQL
kubectl port-forward -n mcp-agent-dev svc/postgres 5432:5432 &

# Run tests
cd packages/burger-api
npm test

cd ../agent-api
npm test
```

## Environment-Specific Configuration

### Development (dev)
- Namespace: `mcp-agent-dev`
- Replicas: 1 per service
- Resources: Lower limits for cost optimization
- Hostnames:
  - `dev.platform-engineering-demo.dev` (agent-webapp)
  - `burger-api-dev.platform-engineering-demo.dev` (burger-api)
  - `burgers-dev.platform-engineering-demo.dev` (burger-webapp)

### Production (prod)
- Namespace: `mcp-agent-prod`
- Replicas: 2-3 per service
- Resources: Higher limits for performance
- HPA: Automatic scaling based on CPU/memory
- PDB: Ensure availability during updates
- Hostnames:
  - `platform-engineering-demo.dev` (agent-webapp)
  - `burger-api.platform-engineering-demo.dev` (burger-api)
  - `burgers.platform-engineering-demo.dev` (burger-webapp)

## Best Practices

### Code Quality
- Write clear, self-documenting code
- Use TypeScript strict mode
- Follow ESM conventions (`.js` extensions in imports)
- Keep services decoupled and maintainable

### Kubernetes
- Use Kustomize for environment management
- Always define resource limits and requests
- Implement health checks for all services
- Use ConfigMaps for configuration, Secrets for sensitive data

### Security
- Run containers as non-root users
- Never commit secrets to git
- Use Pod Security Standards
- Implement network policies (future enhancement)

### Observability
- Instrument all services with Datadog APM
- Add custom spans for business operations
- Use structured logging
- Monitor database query performance with DBM

### Testing
- Write integration tests for critical paths
- Test with real PostgreSQL database
- Mock external dependencies when appropriate
- Maintain test coverage above 80%

## Related Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [LangChain.js Documentation](https://js.langchain.com/)
- [Datadog APM](https://docs.datadoghq.com/tracing/)
- [Datadog DBM](https://docs.datadoghq.com/database_monitoring/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kustomize](https://kustomize.io/)
