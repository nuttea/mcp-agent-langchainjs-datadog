#!/bin/bash

# Load Test Script for agent-api using hey
# This script uses hey (https://github.com/rakyll/hey) to generate high-volume
# error traffic for testing Datadog APM under load

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
ENV="dev"
ERROR_TYPE="error"
REQUESTS=100
CONCURRENCY=10
QPS=0  # 0 means no rate limit
DURATION=0  # 0 means use requests count instead

# URLs for environments
DEV_URL="https://dev.platform-engineering-demo.dev"
PROD_URL="https://platform-engineering-demo.dev"

# Function to display usage
usage() {
    cat << EOF
${BLUE}═══════════════════════════════════════════════════════════════${NC}
${CYAN}  Load Test Script for agent-api Error Generation (using hey)${NC}
${BLUE}═══════════════════════════════════════════════════════════════${NC}

${YELLOW}USAGE:${NC}
    $0 [OPTIONS]

${YELLOW}OPTIONS:${NC}
    -e, --env ENV           Environment: dev or prod (default: dev)
    -t, --type TYPE         Error type: error, latency, slow-error, validation, all (default: error)
    -n, --requests N        Total number of requests (default: 100)
    -c, --concurrency N     Number of concurrent workers (default: 10)
    -q, --qps N             Rate limit in queries per second (default: 0 = no limit)
    -d, --duration N        Duration in seconds (overrides --requests, default: 0 = use requests)
    -h, --help              Display this help message

${YELLOW}ERROR TYPES:${NC}
    error                   Simulate 500 internal server errors
    latency                 Simulate high latency responses (5s delay)
    slow-error              Simulate slow responses followed by errors (3s delay)
    validation              Simulate validation errors (400 bad request)
    all                     Run all error types sequentially

${YELLOW}EXAMPLES:${NC}
    ${CYAN}# Generate 1000 errors with 50 concurrent workers${NC}
    $0 --env dev --type error -n 1000 -c 50

    ${CYAN}# Rate-limited test: 10 requests/sec for 30 seconds${NC}
    $0 --env dev --type latency -q 10 -d 30

    ${CYAN}# High concurrency test in production${NC}
    $0 --env prod --type error -n 5000 -c 100

    ${CYAN}# Mixed load test with all error types${NC}
    $0 --env dev --type all -n 500 -c 20

    ${CYAN}# Sustained load: 100 requests/sec for 5 minutes${NC}
    $0 -e dev -t error -q 100 -d 300 -c 50

${YELLOW}LOAD PATTERNS:${NC}
    ${CYAN}Low Load:${NC}      -n 100  -c 5   (testing)
    ${CYAN}Medium Load:${NC}   -n 500  -c 20  (realistic)
    ${CYAN}High Load:${NC}     -n 2000 -c 50  (stress)
    ${CYAN}Extreme Load:${NC}  -n 5000 -c 100 (breaking point)

${YELLOW}PREREQUISITES:${NC}
    Install hey: ${CYAN}brew install hey${NC} (macOS) or ${CYAN}go install github.com/rakyll/hey@latest${NC}

${YELLOW}DATADOG MONITORING:${NC}
    After running this script, check:
    - APM Service Page: https://app.datadoghq.com/apm/services
    - Error Tracking: https://app.datadoghq.com/apm/error-tracking
    - Infrastructure: https://app.datadoghq.com/infrastructure
    - Monitors: https://app.datadoghq.com/monitors/manage

${BLUE}═══════════════════════════════════════════════════════════════${NC}
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
        -n|--requests)
            REQUESTS="$2"
            shift 2
            ;;
        -c|--concurrency)
            CONCURRENCY="$2"
            shift 2
            ;;
        -q|--qps)
            QPS="$2"
            shift 2
            ;;
        -d|--duration)
            DURATION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    echo -e "${RED}Error: Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

# Check if hey is installed
if ! command -v hey &> /dev/null; then
    echo -e "${RED}Error: 'hey' is not installed${NC}"
    echo ""
    echo "Please install hey:"
    echo "  macOS:   ${CYAN}brew install hey${NC}"
    echo "  Linux:   ${CYAN}go install github.com/rakyll/hey@latest${NC}"
    echo "  Windows: ${CYAN}go install github.com/rakyll/hey@latest${NC}"
    echo ""
    echo "GitHub: https://github.com/rakyll/hey"
    exit 1
fi

# Set base URL based on environment
if [[ "$ENV" == "dev" ]]; then
    BASE_URL="$DEV_URL"
else
    BASE_URL="$PROD_URL"
fi

# Print banner
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Agent API Load Test - Error Generation            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Environment:  ${CYAN}$ENV${NC}"
echo -e "  Base URL:     ${CYAN}$BASE_URL${NC}"
echo -e "  Error Type:   ${CYAN}$ERROR_TYPE${NC}"
if [[ $DURATION -gt 0 ]]; then
    echo -e "  Duration:     ${CYAN}${DURATION}s${NC}"
else
    echo -e "  Requests:     ${CYAN}$REQUESTS${NC}"
fi
echo -e "  Concurrency:  ${CYAN}$CONCURRENCY${NC}"
if [[ $QPS -gt 0 ]]; then
    echo -e "  Rate Limit:   ${CYAN}${QPS} req/s${NC}"
else
    echo -e "  Rate Limit:   ${CYAN}unlimited${NC}"
fi
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

# Function to build hey command with common options
build_hey_command() {
    local url=$1
    local method=${2:-GET}
    local data=${3:-}

    local cmd="hey"

    # Duration or request count
    if [[ $DURATION -gt 0 ]]; then
        cmd="$cmd -z ${DURATION}s"
    else
        cmd="$cmd -n $REQUESTS"
    fi

    # Concurrency
    cmd="$cmd -c $CONCURRENCY"

    # Rate limiting
    if [[ $QPS -gt 0 ]]; then
        cmd="$cmd -q $QPS"
    fi

    # Method
    if [[ "$method" != "GET" ]]; then
        cmd="$cmd -m $method"
    fi

    # Data for POST requests
    if [[ -n "$data" ]]; then
        cmd="$cmd -H 'Content-Type: application/json' -d '$data'"
    fi

    # URL
    cmd="$cmd '$url'"

    echo "$cmd"
}

# Function to run load test with hey
run_load_test() {
    local test_name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-}

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Load Test: $test_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local cmd=$(build_hey_command "$url" "$method" "$data")
    echo -e "${YELLOW}Command:${NC} $cmd"
    echo ""

    # Execute the command
    eval $cmd

    echo ""
}

# Load test functions for each error type
load_test_errors() {
    run_load_test \
        "500 Internal Server Errors" \
        "$BASE_URL/api/simulate/error"
}

load_test_latency() {
    # Use 5 second delay for load testing
    run_load_test \
        "High Latency Responses (5s)" \
        "$BASE_URL/api/simulate/latency?delay=5000"
}

load_test_slow_errors() {
    # Use 3 second delay for slow errors
    run_load_test \
        "Slow Responses + Errors (3s)" \
        "$BASE_URL/api/simulate/slow-error?delay=3000"
}

load_test_validation_errors() {
    local json_data='{"messages":[],"context":{}}'

    run_load_test \
        "Validation Errors (400 Bad Request)" \
        "$BASE_URL/api/chats/stream" \
        "POST" \
        "$json_data"
}

# Execute based on error type
case $ERROR_TYPE in
    error)
        load_test_errors
        ;;
    latency)
        load_test_latency
        ;;
    slow-error)
        load_test_slow_errors
        ;;
    validation)
        load_test_validation_errors
        ;;
    all)
        echo -e "${YELLOW}Running all error types sequentially...${NC}"
        echo ""
        load_test_errors
        sleep 2
        load_test_latency
        sleep 2
        load_test_slow_errors
        sleep 2
        load_test_validation_errors
        ;;
    *)
        echo -e "${RED}Error: Invalid error type '$ERROR_TYPE'${NC}"
        echo "Valid types: error, latency, slow-error, validation, all"
        exit 1
        ;;
esac

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Load Test Complete                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Load test completed successfully${NC}"
echo ""
echo -e "${YELLOW}Next Steps - Check Datadog:${NC}"
echo ""
echo "1. ${CYAN}APM Service Overview:${NC}"
echo "   https://app.datadoghq.com/apm/service/agent-api"
echo ""
echo "2. ${CYAN}Error Tracking:${NC}"
echo "   https://app.datadoghq.com/apm/error-tracking"
echo ""
echo "3. ${CYAN}Service Map:${NC}"
echo "   https://app.datadoghq.com/apm/map"
echo ""
echo "4. ${CYAN}Infrastructure Metrics:${NC}"
echo "   https://app.datadoghq.com/infrastructure"
echo ""
echo "5. ${CYAN}Monitors:${NC}"
echo "   https://app.datadoghq.com/monitors/manage?q=agent-api"
echo ""
echo -e "${YELLOW}Key Metrics to Check:${NC}"
echo "  • Error rate spike in APM"
echo "  • Latency percentiles (p50, p95, p99)"
echo "  • Request throughput"
echo "  • Pod CPU/Memory usage"
echo "  • Database query performance"
echo ""
