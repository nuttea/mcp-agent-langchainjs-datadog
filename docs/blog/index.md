---
layout: default
title: "Bits Learn to Bites - Blog Series"
nav_order: 6
has_children: true
---

# Bits Learn to Bites 🍔

## *From Bits to Bites: Byte-sized lessons on Datadog Observability, one topic at a time*

Welcome to **Bits Learn to Bites**, a practical blog series that teaches Datadog observability using the **Contoso Burgers AI Agent** as a real-world example. Each episode is a bite-sized lesson you can digest in one sitting, complete with hands-on exercises and AI-powered exploration prompts.

---

## 🎯 What Makes This Series Different

**Real Production Code** ✅
- Not toy examples - actual production Kubernetes deployment
- Multi-service architecture (Agent, API, MCP, Database)
- Real business metrics (revenue, orders, queue depth)
- AI/LLM observability patterns

**Hands-On Learning** 🛠️
- Every episode has code you can run
- Clone the repo, deploy to your cluster
- See results in your own Datadog account

**AI-Powered Exploration** 🤖
- Claude Code + Datadog MCP integration
- Custom prompts to explore YOUR environment
- Learn by investigating, not just reading

**Business + Technical** 💼
- Not just for engineers
- Dashboards for Store Owners, Chefs, Marketing
- ROI and business value clearly explained

---

## 📚 Series Overview

### **Season 1: Foundations** 🏗️
*Get the basics right - SSI, logging, RUM*

| Episode | Title | Difficulty | Status | Est. Reading |
|---------|-------|------------|--------|--------------|
| **1** | [The Secret Sauce - SSI](#episode-1) | 🟢 Beginner | ✅ Ready | 8 min |
| **2** | [Logs & Traces: A Love Story](#episode-2) | 🟢 Beginner | ✅ Ready | 6 min |
| **3** | [RUM: Seeing Through Your Users' Eyes](#episode-3) | 🟢 Beginner | ✅ Ready | 7 min |

### **Season 2: AI Observability** 🤖
*Make AI agents transparent and debuggable*

| Episode | Title | Difficulty | Status | Est. Reading |
|---------|-------|------------|--------|--------------|
| **4** | [Teaching AI to Tell You What It's Thinking](#episode-4) | 🟡 Intermediate | ✅ Ready | 9 min |
| **5** | [MCP: The Universal Tool Belt](#episode-5) | 🟡 Intermediate | ✅ Ready | 10 min |

### **Season 3: Business Metrics** 💰
*Speak the language of business*

| Episode | Title | Difficulty | Status | Est. Reading |
|---------|-------|------------|--------|--------------|
| **6** | [Engineer Metrics → Business KPIs](#episode-6) | 🟢 Beginner | ✅ Ready | 8 min |
| **7** | [The Chef Dashboard - Real-Time Kitchen Ops](#episode-7) | 🟡 Intermediate | ✅ Ready | 7 min |
| **8** | [Revenue Tracking - Show Me the Money!](#episode-8) | 🟢 Beginner | ✅ Ready | 6 min |

### **Season 4: Advanced Techniques** 🚀
*Pro tips for power users*

| Episode | Title | Difficulty | Status | Est. Reading |
|---------|-------|------------|--------|--------------|
| **9** | [Custom Spans - The Art of Storytelling](#episode-9) | 🟡 Intermediate | ✅ Ready | 8 min |
| **10** | [DBM + APM = Query Detective](#episode-10) | 🔴 Advanced | ⏳ Soon | 9 min |
| **11** | [Debugging Production - A Detective Story](#episode-11) | 🔴 Advanced | ⏳ Soon | 11 min |
| **12** | [Dashboards Your CEO Will Love](#episode-12) | 🟡 Intermediate | ✅ Ready | 7 min |

---

## 🎓 Learning Paths

Choose your journey based on your role:

### **For Platform Engineers** 🔧
Start here → **Episode 1 (SSI)** → Episode 2 → Episode 9 → Episode 10

Focus: Infrastructure, instrumentation, performance optimization

### **For SREs** 🚨
Start here → **Episode 2 (Logs)** → Episode 11 → Episode 10 → Episode 9

Focus: Debugging, incident response, reliability

### **For Full-Stack Developers** 💻
Start here → **Episode 3 (RUM)** → Episode 2 → Episode 4 → Episode 5

Focus: End-to-end traces, frontend-backend correlation

### **For AI/ML Engineers** 🤖
Start here → **Episode 4 (LLM Obs)** → Episode 5 (MCP) → Episode 9

Focus: AI agent observability, LangChain patterns

### **For Engineering Managers** 👔
Start here → **Episode 6 (KPIs)** → Episode 8 (Revenue) → Episode 12 → Episode 7

Focus: Business metrics, team dashboards, ROI

---

## 🛠️ Prerequisites

### **To Follow Along:**

**Accounts Needed:**
- Datadog account (14-day free trial available)
- Google Cloud account (for Kubernetes)
- GitHub account

**Technical Requirements:**
- Kubernetes cluster (GKE, EKS, or local k3s)
- kubectl configured
- Docker installed
- Node.js 18+ (for local development)

**Optional but Recommended:**
- Claude Code (for AI exploration prompts)
- Datadog MCP server configured

### **Quick Setup:**

```bash
# Clone the repository
git clone https://github.com/nuttea/mcp-agent-langchainjs-datadog
cd mcp-agent-langchainjs-datadog

# Set up environment variables
export OPENAI_API_KEY="your-key"
export DD_API_KEY="your-datadog-key"

# Deploy to your cluster
make deploy ENV=dev

# Verify deployment
kubectl get pods -n mcp-agent-dev
```

---

## 📖 Episode Guide

### <a name="episode-1"></a>**Episode 1: The Secret Sauce - SSI**

**The Problem:** Every microservice needs `import 'dd-trace'` and `tracer.init()` - that's a lot of boilerplate!

**The Solution:** Single Step Instrumentation (SSI) auto-injects APM into all pods via Kubernetes

**What You'll Learn:**
- How SSI works with Datadog Cluster Agent
- Avoiding double-initialization conflicts
- Configuring SSI for Node.js services
- When to use SSI vs manual instrumentation

**Code Locations:**
- [k8s/datadog/datadog-values.yaml:19-39](../k8s/datadog/datadog-values.yaml#L19-L39) - SSI configuration
- [packages/agent-api/src/dd-tracer.ts](../../packages/agent-api/src/dd-tracer.ts) - SSI-compatible code

**AI Prompt:** *Find services with APM and identify which use SSI*

**Status:** ✅ Ready to Publish

---

### <a name="episode-2"></a>**Episode 2: Logs & Traces: A Love Story**

**The Problem:** console.log everywhere = impossible to debug production issues

**The Solution:** Structured logging (Pino) + automatic trace correlation

**What You'll Learn:**
- Why structured logging matters
- Setting up Pino with DD_LOGS_INJECTION
- Replacing 90+ console.log statements
- Debugging with correlated logs and traces

**Code Locations:**
- [packages/burger-api/src/logger.ts](../../packages/burger-api/src/logger.ts) - Logger setup
- [packages/burger-api/src/express-server.ts](../../packages/burger-api/src/express-server.ts) - 31 replacements

**AI Prompt:** *Find errors in logs and show correlated traces*

**Status:** ✅ Ready to Publish

---

### <a name="episode-3"></a>**Episode 3: RUM: Seeing Through Your Users' Eyes**

**The Problem:** Backend metrics look great, but users complain it's slow

**The Solution:** Real User Monitoring captures actual user experience

**What You'll Learn:**
- Setting up Datadog RUM for React apps
- Environment-based configuration
- Session replay for debugging
- Connecting frontend RUM to backend APM

**Code Locations:**
- [packages/agent-webapp/src/datadog-rum.ts](../../packages/agent-webapp/src/datadog-rum.ts) - RUM config
- [packages/burger-webapp/src/datadog-rum.ts](../../packages/burger-webapp/src/datadog-rum.ts) - RUM config

**AI Prompt:** *Find RUM sessions with errors and their backend traces*

**Status:** ✅ Ready to Publish

---

### <a name="episode-4"></a>**Episode 4: Teaching AI to Tell You What It's Thinking**

**The Problem:** AI agents are black boxes - can't see reasoning, can't debug failures

**The Solution:** LLM Observability SDK tracks workflows, tools, inputs, outputs

**What You'll Learn:**
- LLM Observability concepts (workflow, agent, tool)
- Wrapping LangChain agents with llmobs.trace()
- Input/output annotation for debugging
- Session tracking across conversations

**Code Locations:**
- [packages/agent-api/src/express-server.ts:599-630](../../packages/agent-api/src/express-server.ts#L599-L630) - Workflow tracking
- [packages/agent-api/src/express-server.ts:563-588](../../packages/agent-api/src/express-server.ts#L563-L588) - Tool tracking

**AI Prompt:** *Analyze LLM workflows and find slowest operations*

**Status:** ✅ Ready to Publish

---

### <a name="episode-5"></a>**Episode 5: MCP Deep Dive**

**The Problem:** Building custom AI tools is repetitive and fragile

**The Solution:** Model Context Protocol standardizes AI tool interfaces

**What You'll Learn:**
- What is MCP and why it matters
- Building an MCP server
- Integrating MCP with LangChain
- Tracing MCP communication

**Code Locations:**
- [packages/burger-mcp/src/server.ts](../../packages/burger-mcp/src/server.ts) - MCP server
- [packages/burger-mcp/src/mcp.ts](../../packages/burger-mcp/src/mcp.ts) - Tool definitions

**AI Prompt:** *Show MCP tool usage patterns and performance*

**Status:** ✅ Ready to Publish

---

### <a name="episode-6"></a>**Episode 6: Engineer Metrics → Business KPIs**

**The Problem:** CTO asks "What's our conversion rate?" - engineers have no idea

**The Solution:** Custom metrics that track business operations

**What You'll Learn:**
- Designing metrics for business stakeholders
- metrics.increment/histogram/gauge patterns
- Translating technical metrics to business language
- Tagging strategy for data slicing

**Code Locations:**
- [packages/burger-api/src/metrics.ts](../../packages/burger-api/src/metrics.ts) - Full metrics class
- [docs/monitoring/business-dashboards.md](../monitoring/business-dashboards.md) - Dashboard guide

**AI Prompt:** *Calculate business KPIs from custom metrics*

**Status:** ✅ Ready to Publish

---

### <a name="episode-7"></a>**Episode 7: The Chef Dashboard**

**The Problem:** Kitchen has no visibility into order queue - chaos ensues

**The Solution:** Real-time gauge metrics for operational dashboards

**What You'll Learn:**
- Queue depth monitoring
- Background worker instrumentation
- Gauge vs counter vs histogram
- Setting up operational alerts

**Code Locations:**
- [packages/burger-api/src/express-server.ts:648-786](../../packages/burger-api/src/express-server.ts#L648-L786) - Status worker
- [packages/burger-api/src/metrics.ts:153-182](../../packages/burger-api/src/metrics.ts#L153-L182) - Queue metrics

**AI Prompt:** *Identify peak hours and staffing needs*

**Status:** ✅ Ready to Publish

---

### <a name="episode-8"></a>**Episode 8: Revenue Tracking**

**The Problem:** Store owner has no idea if the business is profitable

**The Solution:** Revenue metrics as operational telemetry

**What You'll Learn:**
- Tracking revenue with custom metrics
- Calculating AOV, conversion rate
- Lost revenue analysis
- Week-over-week trends

**Code Locations:**
- [packages/burger-api/src/metrics.ts:20-54](../../packages/burger-api/src/metrics.ts#L20-L54) - Order metrics
- [docs/monitoring/business-dashboards.md:43-73](../../docs/monitoring/business-dashboards.md#L43-L73) - Store Owner dashboard

**AI Prompt:** *Calculate revenue KPIs and forecast trends*

**Status:** ✅ Ready to Publish

---

### <a name="episode-9"></a>**Episode 9: Custom Spans - The Art of Storytelling**

**The Problem:** SSI gives you HTTP spans, but misses your business logic

**The Solution:** Custom spans tell the story of your business operations

**What You'll Learn:**
- When to create custom spans
- Span tag naming conventions (11 tags!)
- Resource naming best practices
- Error tagging patterns

**Code Locations:**
- [packages/burger-api/src/express-server.ts:327-488](../../packages/burger-api/src/express-server.ts#L327-L488) - Order span
- [packages/burger-api/src/express-server.ts:514-573](../../packages/burger-api/src/express-server.ts#L514-L573) - Cancel span

**AI Prompt:** *Find outliers in order data using span tags*

**Status:** ✅ Ready to Publish

---

### <a name="episode-10"></a>**Episode 10: DBM + APM = Query Detective**

**The Problem:** API is slow - but is it code or database?

**The Solution:** DBM-APM correlation shows exact query + triggering code

**What You'll Learn:**
- Database Monitoring setup
- DBM-APM correlation
- Query plan analysis
- N+1 query detection

**Code Locations:**
- [k8s/datadog/datadog-values.yaml](../../k8s/datadog/datadog-values.yaml) - DBM config
- [packages/burger-api/src/db-service.ts:113-123](../../packages/burger-api/src/db-service.ts#L113-L123) - N+1 example

**AI Prompt:** *Find slow queries and their root causes*

**Status:** ⏳ Coming Soon (needs screenshots)

---

### <a name="episode-11"></a>**Episode 11: Debugging Production - A Detective Story**

**The Problem:** Production incident - where do you even start?

**The Solution:** Full-stack observability = systematic investigation

**What You'll Learn:**
- Incident response workflow
- RUM → APM → DBM correlation
- Log analysis with trace context
- Root cause analysis

**Status:** ⏳ Coming Soon

---

### <a name="episode-12"></a>**Episode 12: Dashboards Your CEO Will Love**

**The Problem:** Technical dashboards confuse business stakeholders

**The Solution:** Business-oriented dashboards with KPIs they understand

**What You'll Learn:**
- Dashboard design for non-technical users
- Choosing the right visualization
- Real-time vs historical data
- Mobile-friendly layouts

**Code Locations:**
- [docs/monitoring/business-dashboards.md](../monitoring/business-dashboards.md) - Complete guide

**Status:** ✅ Ready to Publish

---

## 🚀 Quick Start

### **1. Get the Code**

```bash
git clone https://github.com/nuttea/mcp-agent-langchainjs-datadog
cd mcp-agent-langchainjs-datadog
```

### **2. Deploy to Your Cluster**

```bash
# Set environment variables
export OPENAI_API_KEY="your-key"
export DD_API_KEY="your-datadog-api-key"

# Deploy to dev environment
make deploy ENV=dev

# Access the apps
# Agent: https://dev.platform-engineering-demo.dev
# Burgers: https://burgers-dev.platform-engineering-demo.dev
```

### **3. Explore with AI**

Install Claude Code with Datadog MCP, then use the prompts in each episode!

---

## 🎁 Resources

**📖 Documentation:**
- [Architecture Overview](../architecture/)
- [Deployment Guides](../deployment/)
- [Monitoring Setup](../monitoring/)
- [Testing Guides](../testing/)

**💻 Code:**
- [GitHub Repository](https://github.com/nuttea/mcp-agent-langchainjs-datadog)
- [Example Deployments](../../k8s/)
- [Service Implementations](../../packages/)

**🤖 AI Exploration:**
- [AI Prompts Guide](./AI-PROMPTS.md) - All prompts in one place
- [Content Roadmap](./CONTENT-ROADMAP.md) - Full series plan

**📊 Datadog Resources:**
- [APM Documentation](https://docs.datadoghq.com/tracing/)
- [LLM Observability](https://docs.datadoghq.com/llm_observability/)
- [Custom Metrics](https://docs.datadoghq.com/metrics/custom_metrics/)

---

## 👨‍💻 About This Project

**Contoso Burgers AI Agent** is a production-ready implementation of:
- 🤖 LangChain.js agent with OpenAI
- 📡 Model Context Protocol (MCP) integration
- ☸️ Kubernetes-native deployment (GKE)
- 🐘 PostgreSQL database
- 📊 Comprehensive Datadog observability
- 🔐 Google OAuth authentication

**Originally forked from:** [Azure-Samples/mcp-agent-langchainjs](https://github.com/Azure-Samples/mcp-agent-langchainjs)

**Enhanced with:**
- Kubernetes deployment (replacing Azure Functions)
- PostgreSQL (replacing Cosmos DB)
- Full Datadog stack (APM, DBM, RUM, LLM Obs)
- Business metrics and dashboards
- Multi-environment (dev/prod)

---

## 🎯 Who This Is For

**You should read this series if you:**
- ✅ Want to implement Datadog in production
- ✅ Need to observe AI/LLM applications
- ✅ Want business metrics, not just technical ones
- ✅ Use Kubernetes and want best practices
- ✅ Love learning by doing (hands-on examples)

**This series is NOT for you if:**
- ❌ You want high-level theory only
- ❌ You're looking for quick copy-paste solutions
- ❌ You don't have access to a Kubernetes cluster
- ❌ You're not willing to experiment and break things

---

## 💬 Community & Discussion

**Ask Questions:**
- [GitHub Discussions](https://github.com/nuttea/mcp-agent-langchainjs-datadog/discussions)
- Tag: `#BitsLearnToBites`

**Share Your Results:**
- Post on LinkedIn/Twitter with tag `#BitsLearnToBites`
- Show your dashboards, metrics, improvements

**Contribute:**
- Found a better way? Submit a PR!
- Want to add an episode? Open an issue!

---

## 📅 Publishing Schedule

**New episodes every Tuesday at 9:00 AM PT**

**Subscribe:**
- ⭐ Star the [GitHub repo](https://github.com/nuttea/mcp-agent-langchainjs-datadog) for updates
- 🔔 Watch the repo for new content notifications
- 📧 Follow me on [LinkedIn/Twitter] for announcements

---

## 🎬 Coming This Week

**Episode 1: "The Secret Sauce - SSI"**

Single Step Instrumentation is Datadog's secret weapon for zero-code APM. Learn how to enable it, what it does, and why you should use it instead of manual instrumentation.

**Published:** Coming Tuesday, November 12, 2025
**Reading Time:** 8 minutes
**Hands-On Exercise:** Deploy SSI and see automatic instrumentation in action

[Read Episode 1 →](./episode-01-ssi.md)

---

**Series Author:** [Your Name]
**Last Updated:** November 9, 2025
**License:** MIT

---

*From Bits to Bites: Because observability should be as satisfying as a perfect burger* 🍔
