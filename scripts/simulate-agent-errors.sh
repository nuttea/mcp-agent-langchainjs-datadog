#!/bin/bash

# Error Simulation Script for agent-api
# This script simulates various error conditions in the agent-api service
# to test Datadog APM error tracking and alerting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENV="dev"
ERROR_TYPE="all"
COUNT=5
DELAY=1

# URLs for environments
DEV_URL="https://dev.platform-engineering-demo.dev"
PROD_URL="https://platform-engineering-demo.dev"

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Simulate errors in agent-api service for Datadog APM testing.

OPTIONS:
    -e, --env ENV           Environment: dev or prod (default: dev)
    -t, --type TYPE         Error type: error, latency, slow-error, validation, all (default: all)
    -c, --count COUNT       Number of requests to send (default: 5)
    -d, --delay DELAY       Delay between requests in seconds (default: 1)
    -h, --help              Display this help message

ERROR TYPES:
    error                   Simulate 500 internal server errors
    latency                 Simulate high latency responses (2-10 seconds)
    slow-error              Simulate slow responses followed by errors
    validation              Simulate validation errors (400 bad request)
    all                     Run all error types

EXAMPLES:
    # Simulate errors in dev environment
    $0 --env dev --type error --count 10

    # Simulate high latency in production
    $0 --env prod --type latency --count 5 --delay 2

    # Run all error simulations in dev
    $0 --env dev --type all --count 5

    # Quick test with validation errors
    $0 -e dev -t validation -c 3 -d 0.5

DATADOG MONITORING:
    After running this script, check:
    - APM Service Page: https://app.datadoghq.com/apm/services
    - Error Tracking: https://app.datadoghq.com/apm/error-tracking
    - Monitors: https://app.datadoghq.com/monitors/manage

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -t|--type)
            ERROR_TYPE="$2"
            shift 2
            ;;
        -c|--count)
            COUNT="$2"
            shift 2
            ;;
        -d|--delay)
            DELAY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    echo -e "${RED}Error: Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

# Set base URL based on environment
if [[ "$ENV" == "dev" ]]; then
    BASE_URL="$DEV_URL"
else
    BASE_URL="$PROD_URL"
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Agent API Error Simulation Script                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Environment:${NC} $ENV"
echo -e "${YELLOW}Base URL:${NC} $BASE_URL"
echo -e "${YELLOW}Error Type:${NC} $ERROR_TYPE"
echo -e "${YELLOW}Request Count:${NC} $COUNT"
echo -e "${YELLOW}Delay:${NC} ${DELAY}s"
echo ""

# Check if service is reachable
echo -e "${BLUE}Checking service health...${NC}"
if curl -s -f "$BASE_URL/api" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Service is reachable${NC}"
else
    echo -e "${RED}✗ Service is not reachable at $BASE_URL/api${NC}"
    exit 1
fi
echo ""

# Function to simulate 500 errors
simulate_errors() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Simulating 500 Internal Server Errors${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local success=0
    local failed=0

    for i in $(seq 1 $COUNT); do
        echo -ne "${BLUE}Request $i/$COUNT:${NC} "

        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/simulate/error" 2>&1)

        if [[ "$HTTP_CODE" == "500" ]]; then
            echo -e "${RED}✓ Error 500 (Expected)${NC}"
            ((success++))
        else
            echo -e "${YELLOW}✗ Got HTTP $HTTP_CODE (Unexpected)${NC}"
            ((failed++))
        fi

        if [[ $i -lt $COUNT ]]; then
            sleep "$DELAY"
        fi
    done

    echo ""
    echo -e "${GREEN}Successfully triggered: $success errors${NC}"
    if [[ $failed -gt 0 ]]; then
        echo -e "${YELLOW}Failed to trigger: $failed errors${NC}"
    fi
    echo ""
}

# Function to simulate high latency
simulate_latency() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Simulating High Latency Responses${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local success=0
    local failed=0

    # Vary latency from 2s to 8s
    for i in $(seq 1 $COUNT); do
        LATENCY=$((2000 + (i * 1000)))
        if [[ $LATENCY -gt 8000 ]]; then
            LATENCY=8000
        fi

        echo -ne "${BLUE}Request $i/$COUNT (${LATENCY}ms):${NC} "

        START_TIME=$(date +%s%N)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/simulate/latency?delay=$LATENCY" 2>&1)
        END_TIME=$(date +%s%N)

        ACTUAL_DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

        if [[ "$HTTP_CODE" == "200" ]]; then
            echo -e "${GREEN}✓ Success (took ${ACTUAL_DURATION}ms)${NC}"
            ((success++))
        else
            echo -e "${RED}✗ Failed with HTTP $HTTP_CODE${NC}"
            ((failed++))
        fi

        if [[ $i -lt $COUNT ]]; then
            sleep "$DELAY"
        fi
    done

    echo ""
    echo -e "${GREEN}Successfully completed: $success requests${NC}"
    if [[ $failed -gt 0 ]]; then
        echo -e "${YELLOW}Failed requests: $failed${NC}"
    fi
    echo ""
}

# Function to simulate slow errors
simulate_slow_errors() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Simulating Slow Responses Followed by Errors${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local success=0
    local failed=0

    for i in $(seq 1 $COUNT); do
        LATENCY=$((1500 + (i * 500)))
        if [[ $LATENCY -gt 5000 ]]; then
            LATENCY=5000
        fi

        echo -ne "${BLUE}Request $i/$COUNT (${LATENCY}ms + error):${NC} "

        START_TIME=$(date +%s%N)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/simulate/slow-error?delay=$LATENCY" 2>&1)
        END_TIME=$(date +%s%N)

        ACTUAL_DURATION=$(( (END_TIME - START_TIME) / 1000000 ))

        if [[ "$HTTP_CODE" == "500" ]]; then
            echo -e "${RED}✓ Error 500 after ${ACTUAL_DURATION}ms (Expected)${NC}"
            ((success++))
        else
            echo -e "${YELLOW}✗ Got HTTP $HTTP_CODE${NC}"
            ((failed++))
        fi

        if [[ $i -lt $COUNT ]]; then
            sleep "$DELAY"
        fi
    done

    echo ""
    echo -e "${GREEN}Successfully triggered: $success slow errors${NC}"
    if [[ $failed -gt 0 ]]; then
        echo -e "${YELLOW}Failed to trigger: $failed slow errors${NC}"
    fi
    echo ""
}

# Function to simulate validation errors
simulate_validation_errors() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Simulating Validation Errors (400 Bad Request)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local success=0
    local failed=0

    for i in $(seq 1 $COUNT); do
        echo -ne "${BLUE}Request $i/$COUNT:${NC} "

        # Send empty messages array to trigger validation error
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "$BASE_URL/api/chats/stream" \
            -H "Content-Type: application/json" \
            -d '{"messages":[],"context":{}}' 2>&1)

        if [[ "$HTTP_CODE" == "400" ]]; then
            echo -e "${YELLOW}✓ Error 400 (Expected)${NC}"
            ((success++))
        else
            echo -e "${RED}✗ Got HTTP $HTTP_CODE (Expected 400)${NC}"
            ((failed++))
        fi

        if [[ $i -lt $COUNT ]]; then
            sleep "$DELAY"
        fi
    done

    echo ""
    echo -e "${GREEN}Successfully triggered: $success validation errors${NC}"
    if [[ $failed -gt 0 ]]; then
        echo -e "${YELLOW}Failed to trigger: $failed validation errors${NC}"
    fi
    echo ""
}

# Execute based on error type
case $ERROR_TYPE in
    error)
        simulate_errors
        ;;
    latency)
        simulate_latency
        ;;
    slow-error)
        simulate_slow_errors
        ;;
    validation)
        simulate_validation_errors
        ;;
    all)
        simulate_errors
        simulate_latency
        simulate_slow_errors
        simulate_validation_errors
        ;;
    *)
        echo -e "${RED}Error: Invalid error type '$ERROR_TYPE'${NC}"
        echo "Valid types: error, latency, slow-error, validation, all"
        exit 1
        ;;
esac

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Simulation Complete                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Error simulation completed successfully${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Check Datadog APM Service Map:"
echo -e "   ${BLUE}https://app.datadoghq.com/apm/service/agent-api/operations${NC}"
echo ""
echo "2. View Error Tracking:"
echo -e "   ${BLUE}https://app.datadoghq.com/apm/error-tracking${NC}"
echo ""
echo "3. Check Monitors:"
echo -e "   ${BLUE}https://app.datadoghq.com/monitors/manage?q=agent-api${NC}"
echo ""
echo "4. View Service Dashboard:"
echo -e "   ${BLUE}https://app.datadoghq.com/apm/service/agent-api${NC}"
echo ""
