FROM node:20-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Create non-root user
RUN groupadd -r synthtek && useradd -r -g synthtek -d /app -s /sbin/nologin synthtek
RUN chown -R synthtek:synthtek /app

USER synthtek

# Set environment
ENV NODE_ENV=production
ENV SYNTHTEK_WORKSPACE=/data

# Expose nothing by default (CLI tool)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "import('fs').then(fs => { fs.existsSync('/app/dist/cli.js') ? process.exit(0) : process.exit(1) })" || exit 1

# Default command
CMD ["node", "dist/cli.js", "status"]
