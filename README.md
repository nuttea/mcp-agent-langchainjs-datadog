<div align="center">

<img src="./packages/agent-webapp/public/favicon.png" alt="" align="center" height="64" />

# AI Agent with MCP tools using LangChain.js + Datadog Observability

[![Kubernetes](https://img.shields.io/badge/Kubernetes-Deployment-blue?style=flat-square&logo=kubernetes)](https://kubernetes.io/)
[![Datadog](https://img.shields.io/badge/Datadog-Observability-purple?style=flat-square&logo=datadog)](https://www.datadoghq.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
<br>
![Node version](https://img.shields.io/badge/Node.js->=18-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

⭐ If you like this sample, star it on GitHub — it helps a lot!

[Overview](#overview) • [Architecture](#architecture) • [Getting started](#getting-started) • [Deploy to Kubernetes](#deploy-to-kubernetes) • [Observability](#observability) • [Documentation](#documentation) • [Resources](#resources)

![Animation showing the agent in action](./docs/images/demo.gif)

</div>

> **📌 About This Fork**
> This repository is forked from [Azure-Samples/mcp-agent-langchainjs](https://github.com/Azure-Samples/mcp-agent-langchainjs) and enhanced with:
> - **Kubernetes-native deployment** - Works with any Kubernetes cluster (GKE, EKS, AKS, on-premises)
> - **PostgreSQL database** - Replaces Azure Cosmos DB with PostgreSQL for standard SQL compatibility
> - **Datadog observability** - End-to-end instrumentation with APM, DBM, and distributed tracing
> - **Comprehensive testing** - 31+ integration tests for APIs and database operations
> - **Production-ready infrastructure** - Kubernetes manifests, ConfigMaps, Secrets, and StatefulSets
>
> **Credits:** Original project by the [Azure AI team](https://github.com/Azure-Samples). Thank you for the excellent foundation! 🙏

## Overview

This project demonstrates how to build AI agents that can interact with real-world APIs using the **Model Context Protocol (MCP)**. It features a complete burger ordering system with a REST API, web interfaces, and an MCP server that enables AI agents to browse menus, place orders, and track order status. The agent uses **LangChain.js** to handle LLM reasoning and tool calling.

### What Makes This Fork Different

**Original Azure Version:**
- Serverless architecture (Azure Functions, Azure Static Web Apps)
- Azure Cosmos DB for NoSQL
- Azure-specific deployment with Azure Developer CLI

**This Kubernetes + Datadog Version:**
- **Kubernetes-native deployment** to any cluster (GKE, EKS, AKS, Minikube, etc.)
- **PostgreSQL database** with connection pooling and optimized queries
- **Datadog end-to-end observability:**
  - Application Performance Monitoring (APM) with distributed tracing
  - Database Monitoring (DBM) with query metrics and execution plans
  - DBM-APM correlation linking database queries to application traces
  - Custom metrics and dashboards
- **Production-ready features:**
  - Health checks and liveness/readiness probes
  - Resource limits and requests
  - Horizontal Pod Autoscaling support
  - Persistent storage with StatefulSets
  - Comprehensive test suite (31+ tests)

<!-- > [!TIP]
> You can test this application locally without deployment needed or any cloud costs. The MCP server works with popular AI tools like GitHub Copilot, Claude, and other MCP-compatible clients. -->

### Key Features

**Core Functionality:**
- LangChain.js agent with tool calling via MCP (Streamable HTTP transport)
- Multi-service, end-to-end architecture (web UIs, APIs, MCP server)
- User authentication with session history stored in PostgreSQL
- Chat history persistence across sessions

**Kubernetes & Infrastructure:**
- Deploy to any Kubernetes cluster (GKE, EKS, AKS, on-premises)
- Kubernetes manifests with ConfigMaps, Secrets, and StatefulSets
- Health checks, liveness/readiness probes
- Horizontal Pod Autoscaling ready
- Persistent storage for PostgreSQL

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

## Observability

This fork includes comprehensive **Datadog observability** throughout the entire application stack:

### Application Performance Monitoring (APM)

- **Distributed Tracing:** Track requests across all services (Agent API → Burger MCP → Burger API → PostgreSQL)
- **Custom Instrumentation:** dd-trace integration in Node.js applications
- **Service Maps:** Visual representation of service dependencies and call patterns
- **Performance Metrics:** Response times, error rates, throughput for all endpoints

### Database Monitoring (DBM)

- **Query Metrics:** Execution time, frequency, and resource usage for all SQL queries
- **Query Samples:** Actual query examples with EXPLAIN plans for optimization
- **Blocking Queries:** Detection of database locks and blocking operations
- **Schema Collection:** Database structure and table statistics

### DBM-APM Correlation

- **End-to-End Visibility:** Link database queries to the application traces that generated them
- **Trace Context Propagation:** SQL comments contain trace IDs for correlation
- **Performance Debugging:** Identify slow queries in the context of user requests

See [docs/monitoring/](./docs/monitoring/) for detailed setup and configuration.

## Architecture

This application demonstrates how to build production-ready AI agents using LangChain.js, Kubernetes, and modern observability practices. The agent can be accessed through different interfaces (web app, CLI) and uses MCP to interact with a burger ordering API, with full observability provided by Datadog.

![Architecture diagram](docs/images/architecture.drawio.png?raw=true)

The application is made from these main components:

| Component         | Folder                                               | Purpose                                      |
| ----------------- | ---------------------------------------------------- | -------------------------------------------- |
| Agent Web App     | [`packages/agent-webapp`](./packages/agent-webapp)   | Chat interface + conversation rendering      |
| Agent API         | [`packages/agent-api`](./packages/agent-api)         | LangChain.js agent + chat state + MCP client |
| Burger API        | [`packages/burger-api`](./packages/burger-api)       | Core burger & order management web API       |
| Burger MCP Server | [`packages/burger-mcp`](./packages/burger-mcp)       | Exposes burger API as MCP tools              |
| Burger Web App    | [`packages/burger-webapp`](./packages/burger-webapp) | Live orders visualization                    |
| PostgreSQL        | Kubernetes StatefulSet                               | Database for burgers, orders, and users      |
| Infrastructure    | [`k8s/`](./k8s)                                      | Kubernetes manifests (dev & prod)            |
| Azure Infra       | [`infra/`](./infra)                                  | Original Azure Bicep templates (legacy)      |

Additionally, these support components are included:

| Component       | Folder                                           | Purpose                                                  |
| --------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Agent CLI       | [`packages/agent-cli`](./packages/agent-cli)     | Command-line interface LangChain.js agent and MCP client |
| Data generation | [`packages/burger-data`](./packages/burger-data) | Scripts to (re)generate burgers data & images            |
| Documentation   | [`docs/`](./docs)                                | Comprehensive guides for deployment, testing, monitoring |

## Getting started

There are multiple ways to get started with this project. The quickest way is to use [GitHub Codespaces](#use-github-codespaces) that provides a preconfigured environment for you. Alternatively, you can [set up your local environment](#use-your-local-environment) following the instructions below.

<details open>
<summary><h3>Use GitHub Codespaces</h3></summary>

You can run this project directly in your browser by using GitHub Codespaces, which will open a web-based VS Code:

[![Open in GitHub Codespaces](https://img.shields.io/static/v1?style=flat-square&label=GitHub+Codespaces&message=Open&color=blue&logo=github)](https://codespaces.new/Azure-Samples/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)

</details>

<details>
<summary><h3>Use a VSCode dev container</h3></summary>

A similar option to Codespaces is VS Code Dev Containers, that will open the project in your local VS Code instance using the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

You will also need to have [Docker](https://www.docker.com/get-started/) installed on your machine to run the container.

[![Open in Dev Containers](https://img.shields.io/static/v1?style=flat-square&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/Azure-Samples/mcp-agent-langchainjs)

</details>

<details>
<summary><h3>Use your local environment</h3></summary>

You need to install following tools to work on your local machine:

- [Node.js LTS](https://nodejs.org/en/download)
- [Azure Developer CLI 1.19+](https://aka.ms/azure-dev/install)
- [Git](https://git-scm.com/downloads)
- [PowerShell 7+](https://github.com/powershell/powershell) _(for Windows users only)_
  - **Important**: Ensure you can run `pwsh.exe` from a PowerShell command. If this fails, you likely need to upgrade PowerShell.
  - Instead of Powershell, you can also use Git Bash or WSL to run the Azure Developer CLI commands.

Then you can get the project code:

1. [**Fork**](https://github.com/Azure-Samples/mcp-agent-langchainjs/fork) the project to create your own copy of this repository.
2. On your forked repository, select the **Code** button, then the **Local** tab, and copy the URL of your forked repository.

   ![Screenshot showing how to copy the repository URL](./docs/images/clone-url.png)

3. Open a terminal and run this command to clone the repo: `git clone <your-repo-url>`

</details>

## Deploy to Kubernetes

This fork is designed to deploy to any Kubernetes cluster (GKE, EKS, AKS, Minikube, etc.).

### Prerequisites

- **Kubernetes cluster**: Any Kubernetes cluster (GKE, EKS, AKS, or local Minikube/Kind)
- **kubectl**: [Install kubectl](https://kubernetes.io/docs/tasks/tools/)
- **Docker** (optional): For building custom images
- **OpenAI API key**: [Get one from OpenAI](https://platform.openai.com/api-keys)
- **Datadog account** (optional): [Sign up for Datadog](https://www.datadoghq.com/) for observability

### Quick Start - Deploy to GKE

For detailed instructions, see [docs/deployment/QUICKSTART_GKE_UPDATED.md](./docs/deployment/QUICKSTART_GKE_UPDATED.md)

```bash
# 1. Create GKE cluster (if needed)
gcloud container clusters create mcp-agent-cluster \
  --zone=us-central1-a \
  --num-nodes=3

# 2. Create namespace
kubectl create namespace mcp-agent-dev

# 3. Create secrets
kubectl create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=burgerapp \
  --from-literal=POSTGRES_PASSWORD=your-secure-password \
  --from-literal=POSTGRES_DB=burgerdb \
  -n mcp-agent-dev

kubectl create secret generic openai-secret \
  --from-literal=OPENAI_API_KEY=your-openai-api-key \
  -n mcp-agent-dev

kubectl create secret generic datadog-secret \
  --from-literal=DD_API_KEY=your-datadog-api-key \
  -n mcp-agent-dev

# 4. Deploy application
kubectl apply -k k8s/dev/

# 5. Wait for deployments
kubectl rollout status deployment/agent-api -n mcp-agent-dev
kubectl rollout status deployment/burger-api -n mcp-agent-dev

# 6. Access services
kubectl get svc -n mcp-agent-dev
```

### Deploy to Other Kubernetes Platforms

**Amazon EKS:**
```bash
eksctl create cluster --name mcp-agent-cluster --region us-west-2
# Follow the same deployment steps above
```

**Azure AKS:**
```bash
az aks create --resource-group myResourceGroup --name mcp-agent-cluster
az aks get-credentials --resource-group myResourceGroup --name mcp-agent-cluster
# Follow the same deployment steps above
```

**Local Minikube:**
```bash
minikube start --memory=4096 --cpus=2
# Follow the same deployment steps above
```

For comprehensive deployment guides:
- **GKE Complete Setup:** [docs/deployment/GKE_COMPLETE_SETUP.md](./docs/deployment/GKE_COMPLETE_SETUP.md)
- **Production Deployment:** [docs/deployment/DEPLOY_TO_PROD.md](./docs/deployment/DEPLOY_TO_PROD.md)
- **Secrets Management:** [docs/deployment/SECRETS_MANAGEMENT.md](./docs/deployment/SECRETS_MANAGEMENT.md)

### Clean up resources

To remove all deployed resources:

```bash
# Delete namespace (removes all resources)
kubectl delete namespace mcp-agent-dev

# Delete GKE cluster (if using GKE)
gcloud container clusters delete mcp-agent-cluster --zone=us-central1-a
```

---

<details>
<summary><h3>Deploy to Azure (Original)</h3></summary>

The original Azure deployment is still available using Azure Developer CLI:

**Prerequisites:**
- Azure account with appropriate permissions
- Azure Developer CLI installed

**Deploy:**
```bash
azd auth login
azd up
```

See [infra/](./infra) for Azure Bicep templates.

</details>

## Run locally

After setting up your environment and provisioned the Azure resources, you can run the entire application locally:

```bash
# Install dependencies for all services
npm install

# Start all services locally
npm start
```

Starting the different services may take some time, you need to wait until you see the following message in the terminal: `🚀 All services ready 🚀`

This will start:

- **Agent Web App**: http://localhost:4280
- **Agent API**: http://localhost:7072
- **Burger Web App**: http://localhost:5173
- **Burger API**: http://localhost:7071
- **Burger MCP Server**: http://localhost:3000

> [!NOTE]
> When running locally without having deployed the application, the servers will use in-memory storage, so any data will be lost when you stop the servers.
> After a successful deployment, the servers will use Azure Cosmos DB for persistent storage.

You can then open the Agent web app and ask things like:

- _What spicy burgers do you have?_
- _Order two Classic Cheeseburgers with extra bacon._
- _Show my recent orders_

The agent will decide which MCP tool(s) to call, then come up with a response.

### Available scripts

This project uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces) to manage multiple packages in a single repository. You can run scripts from the root folder that will apply to all packages, or you can run scripts for individual packages as indicated in their respective README files.

Common scripts (run from repo root):

| Action           | Command            |
| ---------------- | ------------------ |
| Start everything | `npm start`        |
| Build all        | `npm run build`    |
| Lint             | `npm run lint`     |
| Fix lint         | `npm run lint:fix` |
| Format           | `npm run format`   |

## MCP tools

The Burger MCP server provides these tools for AI agents:

| Tool Name                | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `get_burgers`            | Get a list of all burgers in the menu                                                        |
| `get_burger_by_id`       | Get a specific burger by its ID                                                              |
| `get_toppings`           | Get a list of all toppings in the menu                                                       |
| `get_topping_by_id`      | Get a specific topping by its ID                                                             |
| `get_topping_categories` | Get a list of all topping categories                                                         |
| `get_orders`             | Get a list of all orders in the system                                                       |
| `get_order_by_id`        | Get a specific order by its ID                                                               |
| `place_order`            | Place a new order with burgers (requires `userId`, optional `nickname`)                      |
| `delete_order_by_id`     | Cancel an order if it has not yet been started (status must be `pending`, requires `userId`) |

### Testing the MCP Server

#### Using the MCP Inspector

You can test the MCP server using the MCP Inspector:

1. Install and start MCP Inspector:

   ```bash
   npx -y @modelcontextprotocol/inspector
   ```

2. In your browser, open the MCP Inspector (the URL will be shown in the terminal)

3. Configure the connection:
   - **Transport**: Streamable HTTP or SSE
   - **URL**: `http://localhost:3000/mcp` (for Streamable HTTP) or `http://localhost:3000/sse` (for legacy SSE)

4. Click **Connect** and explore the available tools

#### Using GitHub Copilot

To use the MCP server in local mode with GitHub Copilot, create a local `.vscode/mcp.json` configuration file in your project root:

```json
{
  "servers": {
    "burger-mcp": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "start:local", "--workspace=burger-mcp"]
    }
  }
}
```

If you open that file

Then, you can use GitHub Copilot in **agent mode** to interact with the MCP server. For example, you can ask questions like "What burgers are available?" or "Place an order for a vegan burger" and Copilot will use the MCP server to provide answers or perform actions.

> [!TIP]
> Copilot models can behave differently regarding tools usage, so if you don't see it calling the `burger-mcp` tools, you can explicitly mention using the Bruger MCP server by adding `#burger-mcp` in your prompt.

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

**[📖 View Full Documentation on GitHub Pages](https://azure-samples.github.io/mcp-agent-langchainjs/)**

- **[docs/](./docs/README.md)** - Main documentation index
- **[docs/deployment/](./docs/deployment/)** - GKE deployment guides and Kubernetes setup
- **[docs/testing/](./docs/testing/)** - Testing guides and test infrastructure
- **[docs/monitoring/](./docs/monitoring/)** - Datadog APM and DBM setup
- **[docs/architecture/](./docs/architecture/)** - System architecture and design

### Quick Links

- **[Test Quick Start](./docs/testing/TEST_QUICKSTART.md)** - Get started with tests in 5 minutes
- **[GKE Deployment Quick Start](./docs/deployment/QUICKSTART_GKE_UPDATED.md)** - Deploy to GKE quickly
- **[Production Deployment](./docs/deployment/DEPLOY_TO_PROD_QUICKSTART.md)** - Deploy to production
- **[Testing Guide](./docs/testing/TESTING.md)** - Comprehensive testing documentation
- **[DBM Validation](./docs/monitoring/DBM_VALIDATION_REPORT.md)** - Database monitoring setup

## Resources

Here are some resources to learn more about the technologies used in this project:

- [Model Context Protocol](https://modelcontextprotocol.io/) - More about the MCP protocol
- [MCP for Beginners](https://github.com/microsoft/mcp-for-beginners) - A beginner-friendly introduction to MCP
- [Generative AI with JavaScript](https://github.com/microsoft/generative-ai-with-javascript) - Learn how to build Generative AI applications with JavaScript
- [Azure AI Travel Agents with Llamaindex.TS and MCP](https://github.com/Azure-Samples/azure-ai-travel-agents/) - Sample for building AI agents using Llamaindex.TS and MCP
- [Serverless AI Chat with RAG using LangChain.js](https://github.com/Azure-Samples/serverless-chat-langchainjs) - Sample for building a serverless AI chat grounded on your own data with LangChain.js

You can also find [more Azure AI samples here](https://github.com/Azure-Samples/azureai-samples).

## Troubleshooting

If you encounter issues while running or deploying this sample:

1. **Dependencies**: Ensure all required tools are installed and up to date
2. **Ports**: Make sure required ports (3000, 4280, 5173, 5174, 7071, 7072) are not in use
3. **Azure Developer CLI**: Verify you're authenticated with `azd auth login`
4. **Node.js version**: Ensure you're using Node.js 22 or higher

For more detailed troubleshooting, check the individual README files in each service directory.

## Built for AI Agents

This project has been optimized for use with AI agents like [GitHub Copilot](https://github.com/features/copilot). This includes:

- Built-in context engineering provided with [AGENTS.md](https://agents.md/) files to help AI agents understand and extend the codebase.
- [Reusable prompts](./.github/prompts/) for common tasks.
- [Custom instructions](./.github/instructions/) tailored for each service of the project.
- Custom **Codebase Explorer** chat mode for Copilot, to help you explore and understand the codebase.

To learn how to set up and use GitHub Copilot with this repository, check out the [docs/copilot.md](./docs/copilot.md) guide.

## Getting Help

If you get stuck or have any questions about building AI apps, join:

[![Azure AI Foundry Discord](https://img.shields.io/badge/Discord-Azure_AI_Foundry_Community_Discord-blue?style=for-the-badge&logo=discord&color=5865f2&logoColor=fff)](https://aka.ms/foundry/discord)

If you have product feedback or errors while building visit:

[![Azure AI Foundry Developer Forum](https://img.shields.io/badge/GitHub-Azure_AI_Foundry_Developer_Forum-blue?style=for-the-badge&logo=github&color=000000&logoColor=fff)](https://aka.ms/foundry/forum)
