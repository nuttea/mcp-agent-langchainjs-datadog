.PHONY: help install build test lint clean docker-build docker-push deploy k8s-apply k8s-delete logs status dev

# Default target
help:
	@echo "MCP Agent LangChain.js - Available Commands"
	@echo "=========================================="
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Start all services locally"
	@echo "  make build            - Build all TypeScript packages"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Run linter"
	@echo "  make clean            - Clean build artifacts"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build                - Build all Docker images (linux/amd64)"
	@echo "  make docker-push                 - Build and push all images to GAR"
	@echo "  make docker-logs                 - Show last build log"
	@echo ""
	@echo "Docker - Individual Services:"
	@echo "  make docker-build-agent-api      - Build and push agent-api only"
	@echo "  make docker-build-agent-webapp   - Build and push agent-webapp only"
	@echo "  make docker-build-burger-api     - Build and push burger-api only"
	@echo "  make docker-build-burger-webapp  - Build and push burger-webapp only"
	@echo "  make docker-build-burger-mcp     - Build and push burger-mcp only"
	@echo "  Example: make docker-build-agent-api IMAGE_TAG=v1.0.0"
	@echo ""
	@echo "Kubernetes (ENV=dev|prod) - Using Kustomize:"
	@echo "  make k8s-apply           - Apply K8s manifests (default: dev)"
	@echo "  make k8s-apply-dev       - Apply to dev environment"
	@echo "  make k8s-apply-prod      - Apply to prod environment"
	@echo "  make k8s-delete          - Delete K8s resources from ENV"
	@echo "  make k8s-diff            - Show diff for ENV"
	@echo "  make deploy              - Full deployment (build + push + apply)"
	@echo "  make k8s-status          - Show K8s pods/services status"
	@echo "  make k8s-logs            - Tail logs from K8s pods"
	@echo "  make k8s-restart         - Restart all deployments"
	@echo "  Example: make k8s-apply ENV=prod"
	@echo ""
	@echo "Deploy Individual Services (ENV=dev|prod):"
	@echo "  make deploy-agent-api      - Build, push, and restart agent-api"
	@echo "  make deploy-agent-webapp   - Build, push, and restart agent-webapp"
	@echo "  make deploy-burger-api     - Build, push, and restart burger-api"
	@echo "  make deploy-burger-webapp  - Build, push, and restart burger-webapp"
	@echo "  make deploy-burger-mcp     - Build, push, and restart burger-mcp"
	@echo "  Example: make deploy-agent-api ENV=prod"
	@echo ""
	@echo "Port Forwarding (ENV=dev|prod):"
	@echo "  make port-forward-agent       - Forward agent-webapp (8080 -> 80)"
	@echo "  make port-forward-burger      - Forward burger-webapp (8081 -> 80)"
	@echo "  make port-forward-api         - Forward agent-api (8082 -> 8080)"
	@echo "  make port-forward-burger-api  - Forward burger-api (8083 -> 8080)"
	@echo "  make port-forward-mcp         - Forward burger-mcp (3000 -> 3000)"
	@echo "  Example: make port-forward-agent ENV=prod"
	@echo ""
	@echo "Environment:"
	@echo "  make env-check              - Check if .env file exists"
	@echo "  make secrets-generate       - Generate K8s secrets from .env for ENV"
	@echo "                                (automatically run before deployments)"
	@echo ""
	@echo "Gateway:"
	@echo "  make gateway-deploy   - Deploy shared gateway infrastructure"
	@echo "  make gateway-status   - Show gateway and HTTPRoute status"
	@echo "  make gateway-delete   - Delete gateway infrastructure"
	@echo ""
	@echo "Datadog:"
	@echo "  make datadog-deploy   - Deploy Datadog Agent to GKE"
	@echo "  make datadog-status   - Show Datadog Agent status"
	@echo "  make datadog-logs     - Tail Datadog Agent logs"
	@echo ""

# Development commands
install:
	@echo "Installing dependencies..."
	npm ci

dev:
	@echo "Starting all services locally..."
	npm start

build:
	@echo "Building all packages..."
	npm run build

test:
	@echo "Running tests..."
	npm test

lint:
	@echo "Running linter..."
	npm run lint

clean:
	@echo "Cleaning build artifacts..."
	find packages -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
	find packages -name "lib" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "Clean complete"

# Docker commands
docker-build:
	@echo "Building Docker images for linux/amd64..."
	@mkdir -p logs
	./k8s/scripts/build-and-push.sh > logs/build-$$(date +%Y%m%d-%H%M%S).log 2>&1
	@echo "Build complete. Check logs/build-*.log for details"

docker-push: docker-build
	@echo "Images built and pushed to GAR ($(DOCKER_REGISTRY))"

docker-logs:
	@if [ -f logs/build-*.log ]; then \
		tail -100 $$(ls -t logs/build-*.log | head -1); \
	else \
		echo "No build logs found"; \
	fi

# Load .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Build and push individual services
# Usage: make docker-build-<service> [ENV=dev|prod]
# Examples:
#   make docker-build-agent-api          # defaults to dev
#   make docker-build-burger-api ENV=prod

# Use GAR (Google Artifact Registry) from .env, fallback to GCR
GAR_LOCATION ?= us-central1
GAR_REPOSITORY ?= mcp-agent
GCP_PROJECT_ID ?= datadog-ese-sandbox
DOCKER_REGISTRY ?= $(GAR_LOCATION)-docker.pkg.dev/$(GCP_PROJECT_ID)/$(GAR_REPOSITORY)
IMAGE_TAG ?= latest

docker-build-agent-api:
	@echo "Building and pushing agent-api to $(DOCKER_REGISTRY)..."
	docker buildx build --platform linux/amd64 \
		-f packages/agent-api/Dockerfile \
		-t $(DOCKER_REGISTRY)/agent-api:$(IMAGE_TAG) \
		--push .
	@echo "✓ agent-api built and pushed: $(DOCKER_REGISTRY)/agent-api:$(IMAGE_TAG)"

docker-build-agent-webapp:
	@echo "Building and pushing agent-webapp to $(DOCKER_REGISTRY)..."
	docker buildx build --platform linux/amd64 \
		-f packages/agent-webapp/Dockerfile \
		-t $(DOCKER_REGISTRY)/agent-webapp:$(IMAGE_TAG) \
		--push .
	@echo "✓ agent-webapp built and pushed: $(DOCKER_REGISTRY)/agent-webapp:$(IMAGE_TAG)"

docker-build-burger-api:
	@echo "Building and pushing burger-api to $(DOCKER_REGISTRY)..."
	docker buildx build --platform linux/amd64 \
		-f packages/burger-api/Dockerfile \
		-t $(DOCKER_REGISTRY)/burger-api:$(IMAGE_TAG) \
		--push .
	@echo "✓ burger-api built and pushed: $(DOCKER_REGISTRY)/burger-api:$(IMAGE_TAG)"

docker-build-burger-webapp:
	@echo "Building and pushing burger-webapp to $(DOCKER_REGISTRY)..."
	docker buildx build --platform linux/amd64 \
		-f packages/burger-webapp/Dockerfile \
		-t $(DOCKER_REGISTRY)/burger-webapp:$(IMAGE_TAG) \
		--push .
	@echo "✓ burger-webapp built and pushed: $(DOCKER_REGISTRY)/burger-webapp:$(IMAGE_TAG)"

docker-build-burger-mcp:
	@echo "Building and pushing burger-mcp to $(DOCKER_REGISTRY)..."
	docker buildx build --platform linux/amd64 \
		-f packages/burger-mcp/Dockerfile \
		-t $(DOCKER_REGISTRY)/burger-mcp:$(IMAGE_TAG) \
		--push .
	@echo "✓ burger-mcp built and pushed: $(DOCKER_REGISTRY)/burger-mcp:$(IMAGE_TAG)"

# Deploy individual services (build, push, and restart)
# Usage: make deploy-<service> [ENV=dev|prod]
deploy-agent-api: docker-build-agent-api
	@echo "Restarting agent-api deployment..."
	kubectl rollout restart deployment agent-api -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ agent-api deployed to $(PORT_FORWARD_NAMESPACE)"
	@echo "Monitor rollout: kubectl rollout status deployment agent-api -n $(PORT_FORWARD_NAMESPACE)"

deploy-agent-webapp: docker-build-agent-webapp
	@echo "Restarting agent-webapp deployment..."
	kubectl rollout restart deployment agent-webapp -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ agent-webapp deployed to $(PORT_FORWARD_NAMESPACE)"
	@echo "Monitor rollout: kubectl rollout status deployment agent-webapp -n $(PORT_FORWARD_NAMESPACE)"

deploy-burger-api: docker-build-burger-api
	@echo "Restarting burger-api deployment..."
	kubectl rollout restart deployment burger-api -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ burger-api deployed to $(PORT_FORWARD_NAMESPACE)"
	@echo "Monitor rollout: kubectl rollout status deployment burger-api -n $(PORT_FORWARD_NAMESPACE)"

deploy-burger-webapp: docker-build-burger-webapp
	@echo "Restarting burger-webapp deployment..."
	kubectl rollout restart deployment burger-webapp -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ burger-webapp deployed to $(PORT_FORWARD_NAMESPACE)"
	@echo "Monitor rollout: kubectl rollout status deployment burger-webapp -n $(PORT_FORWARD_NAMESPACE)"

deploy-burger-mcp: docker-build-burger-mcp
	@echo "Restarting burger-mcp deployment..."
	kubectl rollout restart deployment burger-mcp -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ burger-mcp deployed to $(PORT_FORWARD_NAMESPACE)"
	@echo "Monitor rollout: kubectl rollout status deployment burger-mcp -n $(PORT_FORWARD_NAMESPACE)"

# Kubernetes commands (using Kustomize)
# ENV variable: dev (default) or prod
# Usage: make k8s-apply ENV=prod
ENV ?= dev
NAMESPACE_PREFIX = mcp-agent-
K8S_NAMESPACE = $(NAMESPACE_PREFIX)$(ENV)

k8s-apply: secrets-generate
	@echo "Applying Kubernetes manifests to $(ENV) environment..."
	kubectl apply -k k8s/overlays/$(ENV)
	@echo "✓ Manifests applied successfully to $(K8S_NAMESPACE)"

k8s-apply-dev:
	@echo "Generating secrets for dev environment..."
	@./k8s/scripts/generate-secrets.sh dev
	@echo "Deploying to dev environment..."
	kubectl apply -k k8s/overlays/dev
	@echo "✓ Deployed to mcp-agent-dev"

k8s-apply-prod:
	@echo "Generating secrets for prod environment..."
	@./k8s/scripts/generate-secrets.sh prod
	@echo "Deploying to prod environment..."
	kubectl apply -k k8s/overlays/prod
	@echo "✓ Deployed to mcp-agent-prod"

k8s-delete:
	@echo "Deleting Kubernetes resources from $(ENV) environment..."
	kubectl delete -k k8s/overlays/$(ENV) --ignore-not-found=true
	@echo "Resources deleted from $(K8S_NAMESPACE)"

k8s-diff:
	@echo "Showing diff for $(ENV) environment..."
	kubectl diff -k k8s/overlays/$(ENV) || true

deploy: docker-push k8s-apply
	@echo "Deployment complete!"
	@echo "Waiting for pods to be ready..."
	kubectl wait --for=condition=ready pod -l app=mcp-agent -n $(K8S_NAMESPACE) --timeout=300s || true
	@make k8s-status

k8s-status:
	@echo "=========================================="
	@echo "Kubernetes Status - $(ENV) Environment"
	@echo "=========================================="
	@echo ""
	@echo "Pods:"
	kubectl get pods -n $(K8S_NAMESPACE) -o wide
	@echo ""
	@echo "Services:"
	kubectl get services -n $(K8S_NAMESPACE)
	@echo ""
	@echo "Deployments:"
	kubectl get deployments -n $(K8S_NAMESPACE)

k8s-logs:
	@echo "Select a service to tail logs:"
	@echo "1) agent-api"
	@echo "2) agent-webapp"
	@echo "3) burger-api"
	@echo "4) burger-webapp"
	@echo "5) burger-mcp"
	@read -p "Enter choice [1-5]: " choice; \
	case $$choice in \
		1) kubectl logs -f -l service=agent-api -n mcp-agent-dev ;; \
		2) kubectl logs -f -l service=agent-webapp -n mcp-agent-dev ;; \
		3) kubectl logs -f -l service=burger-api -n mcp-agent-dev ;; \
		4) kubectl logs -f -l service=burger-webapp -n mcp-agent-dev ;; \
		5) kubectl logs -f -l service=burger-mcp -n mcp-agent-dev ;; \
		*) echo "Invalid choice" ;; \
	esac

k8s-restart:
	@echo "Restarting all deployments in $(PORT_FORWARD_NAMESPACE)..."
	kubectl rollout restart deployment -n $(PORT_FORWARD_NAMESPACE)
	@echo "✓ All deployments restarted in $(PORT_FORWARD_NAMESPACE)"
	@echo ""
	@echo "Monitor rollout status:"
	@echo "  kubectl rollout status deployment -n $(PORT_FORWARD_NAMESPACE)"
	@echo ""
	@echo "Watch pods:"
	@echo "  kubectl get pods -n $(PORT_FORWARD_NAMESPACE) -w"

# Individual service logs
logs-agent-api:
	kubectl logs -f -l service=agent-api -n mcp-agent-dev

logs-agent-webapp:
	kubectl logs -f -l service=agent-webapp -n mcp-agent-dev

logs-burger-api:
	kubectl logs -f -l service=burger-api -n mcp-agent-dev

logs-burger-webapp:
	kubectl logs -f -l service=burger-webapp -n mcp-agent-dev

logs-burger-mcp:
	kubectl logs -f -l service=burger-mcp -n mcp-agent-dev

# Environment and secrets
env-check:
	@if [ ! -f .env ]; then \
		echo "ERROR: .env file not found"; \
		echo "Please create .env file with required variables"; \
		exit 1; \
	else \
		echo "✓ .env file exists"; \
		echo ""; \
		echo "Required variables:"; \
		echo "  - AZURE_OPENAI_API_KEY"; \
		echo "  - DD_API_KEY"; \
		echo "  - DD_APP_KEY"; \
		echo ""; \
		@grep -E "^(AZURE_OPENAI_API_KEY|DD_API_KEY|DD_APP_KEY)=" .env > /dev/null && echo "✓ All required variables found" || echo "⚠ Some variables may be missing"; \
	fi

secrets-generate:
	@echo "Generating Kubernetes secrets for $(ENV) environment..."
	./k8s/scripts/generate-secrets.sh $(ENV)
	@echo "✓ Secrets generated successfully for $(ENV)"

# Port forwarding for local access
# Usage: make port-forward-agent [ENV=dev|prod]
# Examples:
#   make port-forward-agent          # defaults to dev
#   make port-forward-agent ENV=prod # use prod namespace

ENV ?= dev
NAMESPACE_PREFIX = mcp-agent-
PORT_FORWARD_NAMESPACE = $(NAMESPACE_PREFIX)$(ENV)

port-forward-agent:
	@echo "Port forwarding agent-webapp (8080 -> 80) from $(PORT_FORWARD_NAMESPACE)..."
	kubectl port-forward -n $(PORT_FORWARD_NAMESPACE) svc/agent-webapp 8080:80

port-forward-burger:
	@echo "Port forwarding burger-webapp (8081 -> 80) from $(PORT_FORWARD_NAMESPACE)..."
	kubectl port-forward -n $(PORT_FORWARD_NAMESPACE) svc/burger-webapp 8081:80

port-forward-api:
	@echo "Port forwarding agent-api (8082 -> 8080) from $(PORT_FORWARD_NAMESPACE)..."
	kubectl port-forward -n $(PORT_FORWARD_NAMESPACE) svc/agent-api 8082:8080

port-forward-burger-api:
	@echo "Port forwarding burger-api (8083 -> 8080) from $(PORT_FORWARD_NAMESPACE)..."
	kubectl port-forward -n $(PORT_FORWARD_NAMESPACE) svc/burger-api 8083:8080

port-forward-mcp:
	@echo "Port forwarding burger-mcp (3000 -> 3000) from $(PORT_FORWARD_NAMESPACE)..."
	kubectl port-forward -n $(PORT_FORWARD_NAMESPACE) svc/burger-mcp 3000:3000

# Cleanup
docker-clean:
	@echo "Cleaning Docker images..."
	docker rmi $$(docker images -q $(DOCKER_REGISTRY)/*) 2>/dev/null || true
	@echo "Docker images cleaned"

clean-all: clean docker-clean
	@echo "Full cleanup complete"

# Datadog monitoring
datadog-deploy:
	@echo "Deploying Datadog Agent to GKE..."
	./k8s/scripts/deploy-datadog.sh

datadog-status:
	@echo "Datadog Agent Status:"
	@echo "====================="
	@echo ""
	kubectl get pods -n datadog
	@echo ""
	@echo "Cluster Agent:"
	kubectl get deploy -n datadog
	@echo ""
	@echo "DaemonSet:"
	kubectl get daemonset -n datadog

datadog-logs:
	@echo "Tailing Datadog Agent logs..."
	kubectl logs -f -l app=datadog-agent -n datadog --tail=100

# Gateway commands
gateway-deploy:
	@echo "Deploying shared gateway infrastructure..."
	kubectl apply -k k8s/gateway-infra
	@echo "✓ Gateway infrastructure deployed"
	@echo ""
	@echo "Waiting for gateway to be ready..."
	kubectl wait --for=condition=Programmed gateway/shared-gateway -n shared-infra --timeout=300s || true
	@echo ""
	@echo "Gateway status:"
	kubectl get gateway -n shared-infra

gateway-status:
	@echo "=========================================="
	@echo "Gateway Status"
	@echo "=========================================="
	@echo ""
	@echo "Gateway:"
	kubectl get gateway -n shared-infra
	@echo ""
	@echo "HTTPRoutes (dev):"
	kubectl get httproute -n mcp-agent-dev
	@echo ""
	@echo "HTTPRoutes (prod):"
	kubectl get httproute -n mcp-agent-prod
	@echo ""
	@echo "Gateway Details:"
	kubectl describe gateway shared-gateway -n shared-infra | grep -A 20 "Status:"

gateway-delete:
	@echo "Deleting gateway infrastructure..."
	kubectl delete -k k8s/gateway-infra --ignore-not-found=true
	@echo "Gateway infrastructure deleted"
