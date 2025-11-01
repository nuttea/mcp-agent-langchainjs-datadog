# Architecture Documentation

System architecture and design documentation for the MCP Agent application.

## Documentation

- **[AGENTS.md](AGENTS.md)** - Agent architecture and implementation details

## System Overview

The MCP Agent is a demonstration application showcasing LangChain.js agents integrated with the Model Context Protocol (MCP) and instrumented with Datadog observability.

## High-Level Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼────┐ ┌──▼─────────┐
│ Agent  │ │   Burger   │
│ WebApp │ │   WebApp   │
└───┬────┘ └──┬─────────┘
    │         │
┌───▼─────────▼───┐
│   Load Balancer │
└───┬─────────┬───┘
    │         │
┌───▼───┐ ┌──▼────────┐
│ Agent │ │  Burger   │
│  API  │ │   API     │
└───┬───┘ └──┬────────┘
    │        │
    │   ┌────▼─────┐
    │   │ Burger   │
    │   │   MCP    │
    │   └────┬─────┘
    │        │
    └────┬───┴────┐
         │        │
    ┌────▼────┐   │
    │ OpenAI  │   │
    │   API   │   │
    └─────────┘   │
                  │
           ┌──────▼───────┐
           │  PostgreSQL  │
           └──────────────┘
                  │
           ┌──────▼───────┐
           │   Datadog    │
           │    Agent     │
           └──────────────┘
```

## Components

### Agent API

**Technology:** Node.js, Express.js, LangChain.js

**Purpose:** Provides an intelligent agent that can:
- Understand natural language requests
- Use tools via MCP to interact with the burger ordering system
- Maintain conversation context
- Generate appropriate responses

**Key Features:**
- LangChain.js agent with OpenAI function calling
- MCP client integration
- PostgreSQL for user management
- Datadog APM instrumentation

**Endpoints:**
- `POST /chat` - Send message to agent
- `GET /health` - Health check

**Location:** `packages/agent-api/`

### Agent WebApp

**Technology:** React, TypeScript, Vite

**Purpose:** User interface for interacting with the agent

**Features:**
- Chat interface
- Message history
- Real-time responses
- User authentication

**Location:** `packages/agent-webapp/`

### Burger API

**Technology:** Node.js, Express.js

**Purpose:** REST API for burger ordering system

**Key Features:**
- Burger catalog management
- Topping management
- Order processing
- User management
- PostgreSQL database integration
- Datadog APM and DBM instrumentation

**Endpoints:**
- `GET /api/burgers` - List burgers
- `GET /api/toppings` - List toppings
- `POST /api/orders` - Create order
- `GET /api/orders` - List orders
- And more...

**Location:** `packages/burger-api/`

### Burger WebApp

**Technology:** React, TypeScript, Vite

**Purpose:** User interface for direct burger ordering

**Features:**
- Browse burgers and toppings
- Build custom burgers
- Place orders
- View order history

**Location:** `packages/burger-webapp/`

### Burger MCP Server

**Technology:** Node.js, MCP SDK

**Purpose:** Provides MCP tools for the agent to interact with burger API

**Tools:**
- `get_burgers` - Retrieve available burgers
- `get_toppings` - Retrieve available toppings
- `create_order` - Place a burger order
- `get_orders` - View order history

**Location:** `packages/burger-mcp/`

### PostgreSQL Database

**Technology:** PostgreSQL 15

**Purpose:** Data persistence for the application

**Schemas:**
- `burgers` - Burger catalog
- `toppings` - Available toppings
- `orders` - Customer orders
- `order_items` - Order line items
- `users` - User accounts
- `chat_history` - Agent conversation history

**Location:** Kubernetes StatefulSet

## Data Flow

### Burger Ordering via Agent

1. User sends message: "I want to order a cheeseburger"
2. Agent WebApp → Agent API: POST /chat
3. Agent API → LangChain Agent: Process request
4. LangChain Agent → OpenAI: Determine intent and tools
5. LangChain Agent → Burger MCP: Call `get_burgers` tool
6. Burger MCP → Burger API: GET /api/burgers
7. Burger API → PostgreSQL: Query burgers
8. PostgreSQL → Burger API: Return results
9. Burger API → Burger MCP: Return burgers
10. Burger MCP → LangChain Agent: Return tool result
11. LangChain Agent → OpenAI: Generate response
12. Agent API → Agent WebApp: Return formatted response
13. Agent WebApp → User: Display message

### Direct Burger Ordering

1. User selects burger and toppings in Burger WebApp
2. Burger WebApp → Burger API: POST /api/orders
3. Burger API → PostgreSQL: Insert order
4. PostgreSQL → Burger API: Confirm insertion
5. Burger API → Burger WebApp: Return order confirmation
6. Burger WebApp → User: Display success

## Design Patterns

### Model Context Protocol (MCP)

- **Client-Server Architecture:** Agent API acts as MCP client
- **Tool Abstraction:** MCP server exposes tools for agent use
- **Standardized Communication:** JSON-RPC protocol
- **Extensible:** Easy to add new tools

### LangChain Agent Pattern

- **ReAct Framework:** Reason and Act pattern
- **Tool Calling:** Function calling with OpenAI
- **Memory:** Conversation context maintenance
- **Streaming:** Real-time response streaming

### Microservices

- **Service Separation:** Agent API, Burger API, MCP Server
- **Independent Scaling:** Scale services based on load
- **Technology Flexibility:** Different stacks per service
- **Failure Isolation:** One service failure doesn't affect others

### Database Patterns

- **Connection Pooling:** Efficient database connections
- **Singleton Pattern:** Single database service instance
- **Fallback Strategy:** In-memory storage if DB unavailable
- **Prepared Statements:** SQL injection prevention

## Observability

### APM Instrumentation

```typescript
// Initialize tracer
import tracer from './dd-tracer';

// Tracer automatically instruments:
// - HTTP requests (Express)
// - Database queries (pg)
// - External API calls (fetch, axios)
```

### Custom Spans

```typescript
// Add custom span
const span = tracer.startSpan('custom.operation');
try {
  // Do work
  span.setTag('custom.tag', 'value');
} finally {
  span.finish();
}
```

### Database Monitoring

- **Query Metrics:** Tracked automatically via pg instrumentation
- **Query Samples:** Collected with execution plans
- **DBM-APM Correlation:** SQL comments link queries to traces

## Security

### Authentication

- User authentication (future enhancement)
- API key authentication for OpenAI
- PostgreSQL username/password authentication

### Secrets Management

- Kubernetes Secrets for sensitive data
- Environment variable injection
- No secrets in code or images

### Network Security

- Service-to-service communication within cluster
- Load balancer for external access
- PostgreSQL not exposed externally

## Scalability

### Horizontal Scaling

- Agent API: Multiple replicas behind load balancer
- Burger API: Multiple replicas behind load balancer
- Stateless design enables easy scaling

### Database Scaling

- Connection pooling (20 connections per pool)
- Read replicas (future enhancement)
- Query optimization via indexes

### Caching

- In-memory caching for frequently accessed data
- PostgreSQL query result caching
- Static asset caching in Nginx

## Technology Stack

### Backend

- **Runtime:** Node.js 18
- **Framework:** Express.js
- **Agent:** LangChain.js
- **AI:** OpenAI GPT-4
- **Database:** PostgreSQL 15
- **ORM:** Direct SQL with pg driver
- **Monitoring:** Datadog (dd-trace)

### Frontend

- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **HTTP Client:** Fetch API
- **State Management:** React hooks

### Infrastructure

- **Container:** Docker
- **Orchestration:** Kubernetes (GKE)
- **Load Balancing:** GCP Load Balancer
- **Storage:** GCP Persistent Disks
- **Monitoring:** Datadog

## Key Technologies Explained

### LangChain.js

Framework for building applications with LLMs:
- Agent framework with tool calling
- Memory management
- Prompt templates
- Output parsers

### Model Context Protocol (MCP)

Protocol for connecting LLMs to external systems:
- Standardized tool interface
- Resource management
- Prompt templates
- Server discovery

### Datadog APM

Application Performance Monitoring:
- Distributed tracing
- Custom metrics
- Log correlation
- Error tracking

### Datadog DBM

Database Monitoring:
- Query performance metrics
- Query samples with EXPLAIN plans
- Blocking query detection
- Schema collection

## Future Enhancements

1. **User Authentication:** JWT-based auth
2. **Rate Limiting:** Prevent abuse
3. **Caching Layer:** Redis for performance
4. **Message Queue:** Async order processing
5. **File Storage:** Image uploads
6. **GraphQL API:** Alternative to REST
7. **Real-time Updates:** WebSocket support
8. **Multi-region:** Deploy to multiple regions

## Related Documentation

- [Deployment](../deployment/) - Deploy the application
- [Testing](../testing/) - Run tests
- [Monitoring](../monitoring/) - Set up observability
