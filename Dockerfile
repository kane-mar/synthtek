# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: Build TypeScript
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

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

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled source (not tests) from builder
COPY --from=builder /app/dist/src/ ./dist/src/

# Create non-root user
RUN groupadd -r synthtek && \
    useradd -r -g synthtek -d /app -s /sbin/nologin synthtek && \
    chown -R synthtek:synthtek /app

USER synthtek

# Environment
ENV NODE_ENV=production
ENV SYNTHTEK_WORKSPACE=/data

# CLI tool — no ports needed by default (channels may need them)
EXPOSE 8080

# Health check (ESM-compatible)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "import('fs').then(fs => process.exit(fs.existsSync('/app/dist/src/cli.js') ? 0 : 1))" || exit 1

# Default: start WebUI server on port 8080
ENTRYPOINT ["node", "dist/src/cli.js"]
CMD ["webui"]
