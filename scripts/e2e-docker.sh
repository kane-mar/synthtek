#!/bin/sh
set -e

# ──────────────────────────────────────────────────────────────────────────────
# E2E Test Runner — builds a fresh Docker image, deploys, runs Playwright, cleans up
# Usage: ./scripts/e2e-docker.sh [playwright args...]
# ──────────────────────────────────────────────────────────────────────────────

IMAGE_NAME="synthtek:e2e-test"
CONTAINER_NAME="synthtek-e2e"
HOST_PORT="8080"
CONTAINER_PORT="8080"

echo "=== Step 1: Building fresh Docker image ==="
docker build -t "$IMAGE_NAME" -f Dockerfile .

echo ""
echo "=== Step 2: Stopping production container if running ==="
PROD_RUNNING=false
if docker inspect synthtek >/dev/null 2>&1; then
  echo "Production container exists, stopping..."
  docker stop synthtek >/dev/null 2>&1
  PROD_RUNNING=true
fi

echo ""
echo "=== Step 3: Deploying fresh test container ==="
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart no \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  -e WEBUI_HOST=0.0.0.0 \
  -e WEBUI_PORT="$CONTAINER_PORT" \
  -e WEBUI_API_KEY= \
  -e SYNTHTEK_WORKSPACE=/data \
  "$IMAGE_NAME"

echo ""
echo "=== Step 4: Waiting for container to become healthy ==="
attempt=1
max_attempts=20
while [ "$attempt" -le "$max_attempts" ]; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "Container healthy after $attempt attempts"
    break
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "Container became unhealthy — showing logs:" >&2
    docker logs "$CONTAINER_NAME" >&2
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
    exit 1
  fi
  printf "  attempt $attempt: status=$status\\r"
  attempt=$((attempt + 1))
  sleep 3
done

if [ "$status" != "healthy" ]; then
  echo "" >&2
  echo "ERROR: Container failed to become healthy after $max_attempts attempts" >&2
  docker logs "$CONTAINER_NAME" >&2
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1
  exit 1
fi

echo ""

# Trap to ensure cleanup on exit
cleanup() {
  echo ""
echo "=== Step 7: Cleaning up ==="
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
if [ "$PROD_RUNNING" = true ]; then
  echo "Restarting production container..."
  docker start synthtek >/dev/null 2>&1 || docker run -d --name synthtek --restart unless-stopped -p 8080:8080 -e WEBUI_HOST=0.0.0.0 -e WEBUI_PORT=8080 -e WEBUI_API_KEY= -e SYNTHTEK_WORKSPACE=/data -v synthtek-data:/data synthtek:latest
fi
echo "Done."
}
trap cleanup EXIT INT TERM

echo "=== Step 5: Running tests ==="
# Pass through any arguments to playwright
cd "$(dirname "$0")/.."
BASE_URL="http://localhost:${HOST_PORT}" npx playwright test --config=playwright.config.ts "$@"

# Show exit code
test_exit=$?
echo ""
echo "Tests exited with code: $test_exit"
exit $test_exit
