#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Production Deploy Script
# Pulls the latest Docker image from GHCR and redeploys the container.
#
# Prerequisites:
#   - Docker installed on the production server
#   - Logged into GHCR (docker login ghcr.io)
#
# Usage:
#   PRODUCTION_HOST=my-server.local \
#   PRODUCTION_USER=admin \
#   PRODUCTION_SSH_KEY="$(cat ~/.ssh/id_rsa)" \
#   IMAGE=ghcr.io/your-org/synthtek:latest \
#   PORT_MAPPING=8080:8080 \
#   CONFIG_DIR=/opt/synthtek/config \
#   DATA_DIR=/opt/synthtek/data \
#   bash scripts/production-deploy.sh
#
# Or via SSH directly:
#   ssh user@server 'bash -s' < scripts/production-deploy.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/synthtek/synthtek:latest}"
PORT_MAPPING="${PORT_MAPPING:-8080:8080}"
CONFIG_DIR="${CONFIG_DIR:-/opt/synthtek/config}"
DATA_DIR="${DATA_DIR:-/opt/synthtek/data}"
CONTAINER_NAME="${CONTAINER_NAME:-synthtek}"

echo "🚀 Deploying $IMAGE to production..."

# Pull latest image
echo "--- Pulling image ---"
docker pull "$IMAGE"

# Stop and remove existing container
echo "--- Stopping old container ---"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Ensure data directories exist
mkdir -p "$CONFIG_DIR" "$DATA_DIR"

# Start new container
echo "--- Starting new container ---"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$PORT_MAPPING" \
  -v "$CONFIG_DIR:/root/.synthtek/config" \
  -v "$DATA_DIR:/root/.synthtek/data" \
  -e SYNTHTEK_PORT="${PORT_MAPPING%%:*}" \
  "$IMAGE"

# Health check
echo "--- Health check ---"
HEALTH_URL="http://127.0.0.1:${PORT_MAPPING%%:*}/api/health"
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✅ Container is healthy (attempt $i)"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "❌ Health check failed after 30 attempts"
    docker logs "$CONTAINER_NAME" --tail 20
    exit 1
  fi
  sleep 5
done

echo "✅ Production deployment complete!"
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
