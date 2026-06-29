# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Build TypeScript
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies required for building/downloading packages (like Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends unzip build-essential && rm -rf /var/lib/apt/lists/*

# Install ALL dependencies (including dev for build)
COPY package.json package-lock.json ./
RUN npm install -g npm@latest && npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && echo "Build successful"

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: Production runtime (minimal)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Install system dependencies required for running packages (like Puppeteer)
# and for skill installation via npx (git for cloning skills repos)
RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip build-essential git \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Pre-install skills.sh CLI globally so `npx skills` doesn't need to download it
# on the first skill install (which can timeout on slow connections)
RUN npm install -g skills && npm cache clean --force

# Copy compiled source (not tests) from builder
COPY --from=builder /app/dist/src/ ./dist/src/

# Create non-root user and ensure data directory is writable
RUN groupadd -r synthtek && \
    useradd -r -g synthtek -d /data -s /bin/bash synthtek && \
    chown -R synthtek:synthtek /app && \
    mkdir -p /data && \
    chown synthtek:synthtek /data && \
    mkdir -p /data/.npm && \
    chown synthtek:synthtek /data/.npm

# Copy docker-entrypoint.sh (before switching to non-root user)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Run as root so entrypoint can fix data permissions.
# The entrypoint drops privileges after setup.

# Environment
ENV NODE_ENV=production
ENV SYNTHTEK_WORKSPACE=/data
ENV HOME=/data

# Speed up npx by caching to persistent volume
ENV npm_config_cache=/data/.npm

# CLI tool — no ports needed by default (channels may need them)
EXPOSE 8080

# Health check — probes the WebUI health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "import('http').then(h => h.get('http://127.0.0.1:8080/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1)))" || exit 1

# Default: start WebUI server on port 8080
ENTRYPOINT ["docker-entrypoint.sh", "node", "dist/src/cli.js"]
CMD ["webui"]
