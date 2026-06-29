# Synthtek Deployment Guide

This guide covers every deployment path for **Synthtek** — a modular, plugin-based AI agent framework built on Node.js 20.

---

## Table of Contents

1. [Docker Deployment (Production)](#1-docker-deployment-production)
2. [Docker Compose Setups](#2-docker-compose-setups)
3. [Health Checks](#3-health-checks)
4. [Linux systemd Service Deployment](#4-linux-systemd-service-deployment)
5. [CI/CD Pipeline Overview](#5cicd-pipeline-overview)
6. [Production Checklist](#6-production-checklist)
7. [Troubleshooting Common Deployment Issues](#7-troubleshooting-common-deployment-issues)

---

## 1. Docker Deployment (Production)

### 1.1 Building Images

The project ships a production-optimized `Dockerfile` based on `node:20-slim`.

```bash
# Build locally
docker build -t synthtek:latest .

# Build with a specific tag
docker build -t synthtek:1.0.0 .

# Pull from GitHub Container Registry (GHCR)
docker pull ghcr.io/<owner>/synthtek:latest
```

**Image characteristics:**

| Property       | Value                        |
| -------------- | ---------------------------- |
| Base image     | `node:20-slim`               |
| Runtime user   | `synthtek` (non-root, UID 1000) |
| Working dir    | `/app`                       |
| Data dir       | `/data`                      |
| Default cmd    | `docker-entrypoint.sh node dist/src/cli.js webui` |
| Exposed port   | `8080` (optional, CLI tool)  |
| Health check   | Every 30s, 3s timeout        |

### 1.2 Running Containers

```bash
# Basic run
docker run --rm synthtek:latest node dist/cli.js status

# Run with persistent data
docker run -d \
  --name synthtek \
  --restart unless-stopped \
  -v synthtek-config:/data/config \
  -v synthtek-data:/data \
  -v synthtek-logs:/data/logs \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  synthtek:latest
```

### 1.3 Environment Configuration

| Variable              | Default           | Description                              |
| --------------------- | ----------------- | ---------------------------------------- |
| `NODE_ENV`            | `production`      | Node.js environment mode                 |
| `SYNTHTEK_WORKSPACE`  | `/data`           | Root directory for agent data & plugins  |
| `LOG_LEVEL`           | `info`            | Logging verbosity (`debug`, `info`, `warn`, `error`) |

Pass environment variables via `-e` flags, a `.env` file, or Docker Compose `environment:` blocks.

### 1.4 Volume Mounts for Config, Data, Logs

The base `docker-compose.yml` defines three mount points:

| Mount              | Container Path   | Purpose                                  |
| ------------------ | ---------------- | ---------------------------------------- |
| `./config`         | `/data/config`   | Agent configuration files                |
| `./data`           | `/data`          | Persistent agent data & plugin state     |
| `./logs`           | `/data/logs`     | Application log output                   |

**Named volumes (recommended for production):**

```bash
docker volume create synthtek-config
docker volume create synthtek-data
docker volume create synthtek-logs
```

**Bind mounts (recommended for development):**

```yaml
volumes:
  - ./config:/data/config
  - ./data:/data
  - ./logs:/data/logs
```

---

## 2. Docker Compose Setups

The project uses a **base + override** compose pattern. Always merge the base file with an environment-specific override.

### 2.1 Development (Hot-Reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

**What dev mode enables:**

- **Source mounts** — `./src`, `./tsconfig.json`, `./package.json`, `./package-lock.json`, and `./bin` are bind-mounted into the container so file changes are reflected immediately.
- **Debug logging** — `LOG_LEVEL=debug` and `NODE_ENV=development`.
- **No resource limits** — CPU and memory caps are removed for unrestricted dev work.

**Dev compose override summary:**

```yaml
services:
  synthtek:
    volumes:
      - ./src:/app/src
      - ./tsconfig.json:/app/tsconfig.json
      - ./package.json:/app/package.json
      - ./package-lock.json:/app/package-lock.json
      - ./bin:/app/bin
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    deploy:
      resources:
        limits: {}
        reservations: {}
```

### 2.2 Production (Log Rotation)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**What prod mode enforces:**

- **Log rotation** — JSON-file driver, 10 MB max per file, 3 files retained, compressed.
- **Resource limits** — 512 MB memory cap, 1 CPU cap; 128 MB / 0.25 CPU reserved.
- **Stricter health checks** — 10s start period, 5 retries.
- **Restart policy** — `unless-stopped`.

**Prod compose override summary:**

```yaml
services:
  synthtek:
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('fs').existsSync('/app/dist/cli.js') && process.exit(0)"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 128M
          cpus: "0.25"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
```

### 2.3 Base Compose File Reference

```yaml
services:
  synthtek:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: synthtek
    restart: unless-stopped
    volumes:
      - ./config:/data/config
      - ./data:/data
      - ./logs:/data/logs
    environment:
      - NODE_ENV=production
      - SYNTHTEK_WORKSPACE=/data
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "node", "-e", "require('fs').existsSync('/app/dist/cli.js') && process.exit(0)"]
      interval: 30s
      timeout: 3s
      start_period: 5s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 128M
          cpus: "0.25"
    user: "1000:1000"
```

---

## 3. Health Checks

### 3.1 Dockerfile Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('fs').existsSync('/app/dist/cli.js') && process.exit(0)" || exit 1
```

Verifies that the compiled CLI entry point exists at `/app/dist/cli.js`.

### 3.2 Checking Health Status

```bash
# Inspect container health
docker inspect --format='{{.State.Health.Status}}' synthtek

# View health check logs
docker inspect --format='{{json .State.Health.Log}}' synthtek | jq
```

### 3.3 Health Check Intervals

| Environment | Interval | Timeout | Start Period | Retries |
| ----------- | -------- | ------- | ------------ | ------- |
| Base / Dev  | 30s      | 3s      | 5s           | 3       |
| Production  | 30s      | 3s      | 10s          | 5       |

---

## 4. Linux systemd Service Deployment

For bare-metal or VM deployments without Docker, run Synthtek directly under systemd.

### 4.1 Prerequisites

```bash
# Install Node.js 20 (if not already present)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and build
git clone https://github.com/<owner>/synthtek.git
cd synthtek
npm ci
npm run build
```

### 4.2 Service File Template

Create `/etc/systemd/system/synthtek.service`:

```ini
[Unit]
Description=Synthtek AI Agent Framework
Documentation=https://github.com/<owner>/synthtek
After=network.target

[Service]
Type=simple
User=synthtek
Group=synthtek
WorkingDirectory=/opt/synthtek
ExecStart=/usr/bin/node /opt/synthtek/dist/cli.js
Restart=on-failure
RestartSec=5
StartLimitBurst=5
StartLimitIntervalSec=60

# Environment
Environment=NODE_ENV=production
Environment=SYNTHTEK_WORKSPACE=/var/lib/synthtek
Environment=LOG_LEVEL=info

# Resource limits
MemoryMax=512M
CPUQuota=100%

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/lib/synthtek /var/log/synthtek
PrivateTmp=true

# Logging (journald)
StandardOutput=journal
StandardError=journal
SyslogIdentifier=synthtek

[Install]
WantedBy=multi-user.target
```

### 4.3 Setup Steps

```bash
# Create dedicated user
sudo useradd -r -s /sbin/nologin -d /opt/synthtek synthtek

# Install application
sudo cp -r synthtek /opt/
sudo chown -R synthtek:synthtek /opt/synthtek

# Create data and log directories
sudo mkdir -p /var/lib/synthtek
sudo mkdir -p /var/log/synthtek
sudo chown synthtek:synthtek /var/lib/synthtek /var/log/synthtek

# Install service file
sudo cp synthtek.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable synthtek
sudo systemctl start synthtek
```

### 4.4 Log Management

**View logs in real-time:**

```bash
sudo journalctl -u synthtek -f
```

**Rotate logs with logrotate:**

Create `/etc/logrotate.d/synthtek`:

```
/var/log/journal/*synthtek* {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

**Alternative: redirect to file:**

Change the systemd service `StandardOutput` and `StandardError` lines:

```ini
StandardOutput=append:/var/log/synthtek/synthtek.log
StandardError=append:/var/log/synthtek/synthtek-error.log
```

### 4.5 Auto-Restart Behavior

| Directive            | Value  | Meaning                                          |
| -------------------- | ------ | ------------------------------------------------ |
| `Restart`            | `on-failure` | Restart only on non-zero exit codes            |
| `RestartSec`         | `5`    | Wait 5 seconds before restarting                 |
| `StartLimitBurst`    | `5`    | Allow up to 5 restarts within the interval       |
| `StartLimitIntervalSec` | `60` | Reset burst counter after 60 seconds             |

To change restart behavior:

```ini
# Always restart (even on clean exit)
Restart=always

# Restart on any exit
Restart=on-abnormal
```

### 4.6 Useful systemd Commands

```bash
# Status
sudo systemctl status synthtek

# Restart
sudo systemctl restart synthtek

# Reload config without restart
sudo systemctl reload synthtek

# View recent logs
sudo journalctl -u synthtek --since "1 hour ago"

# Check resource usage
sudo systemctl show synthtek --property MemoryCurrent,CPUTotalUsage
```

---

## 5. CI/CD Pipeline Overview

Synthtek uses three GitHub Actions workflows for continuous integration, Docker image building, and releases.

### 5.1 `ci.yml` — Continuous Integration

**Triggered on:** pushes and pull requests to `main` / `master`.

| Job    | Description                                          |
| ------ | ---------------------------------------------------- |
| `test` | Runs tests against Node.js 18, 20, and 22 (matrix)   |
| `lint` | Lints source code with ESLint                        |
| `docker` | Builds Docker image (only on `main`/`master` push) |

```
push / PR to main ──► test (Node 18/20/22) ──┐
                                              ├──► docker build (main only)
push / PR to main ──► lint ───────────────────┘
```

Key details:
- Uses `npm ci` for deterministic installs.
- Runs `npm run build` before tests.
- Docker build uses Buildx with GHA cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`).
- Docker image is **not pushed** in CI — only built to verify the Dockerfile works.

### 5.2 `docker.yml` — Build and Push to GHCR

**Triggered on:** pushes to `main`, tag pushes (`v*`), and pull requests to `main`.

```
push to main ──► build + push to ghcr.io/<owner>/synthtek:main
push v* tag  ──► build + push to ghcr.io/<owner>/synthtek:<tag>
PR to main  ──► build only (no push)
```

**Tags generated by `docker/metadata-action`:**

| Tag Type              | Example                        |
| --------------------- | ------------------------------ |
| Branch ref            | `main`                         |
| Tag ref               | `v1.0.0`                       |
| Commit SHA            | `abc1234`                      |
| Latest (default branch) | `latest`                    |

**Authentication:** Uses `GITHUB_TOKEN` (automatic) to log in to `ghcr.io`.

### 5.3 `release.yml` — Version Releases

**Triggered on:** tag pushes matching `v*`.

```
push v* tag ──► checkout ──► npm ci ──► build ──► test
                │
                ├─► generate changelog (git log between tags)
                │
                ├─► create GitHub Release with changelog body
                │
                └─► publish to npm (if NPM_TOKEN secret is set)
```

**Changelog generation:**

```bash
TAG="${GITHUB_REF#refs/tags/}"
PREV_TAG=$(git describe --tags --abbrev=0 "${TAG}^" 2>/dev/null || echo "")
git log --pretty=format:"* %s (%h)" "$PREV_TAG".."$TAG"
```

### 5.4 Version Tagging Convention

Synthtek follows **semantic versioning** with `v` prefix:

```bash
# Create and push a release tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

This triggers both `docker.yml` (push image to GHCR) and `release.yml` (create GitHub Release + npm publish).

### 5.5 Required Secrets

| Secret         | Required | Used By      | Purpose                          |
| -------------- | -------- | ------------ | -------------------------------- |
| `GITHUB_TOKEN` | Auto     | docker.yml   | GHCR authentication              |
| `NPM_TOKEN`    | Optional | release.yml  | npm package publishing           |

---

## 6. Production Checklist

Before deploying Synthtek to production, verify each item:

### Pre-Deployment

- [ ] All CI tests pass on the target branch/tag
- [ ] Docker image builds without warnings
- [ ] Environment variables are configured (`NODE_ENV`, `SYNTHTEK_WORKSPACE`, `LOG_LEVEL`)
- [ ] Volume mounts are planned (config, data, logs)
- [ ] Resource limits are appropriate for your host (default: 512 MB RAM, 1 CPU)

### Deployment

- [ ] Container/service starts and passes health check
- [ ] Logs are writable and rotating
- [ ] Data directory persists across restarts
- [ ] Non-root user is enforced (UID 1000)
- [ ] Restart policy is active (`unless-stopped` for Docker, `on-failure` for systemd)

### Post-Deployment

- [ ] Health check reports `healthy`
- [ ] `synthtek status` command returns expected output
- [ ] Log files are being written to the correct path
- [ ] Resource usage is within limits (check with `docker stats` or `systemctl show`)
- [ ] Backup strategy is in place for `/data` and `/data/config`

### Security

- [ ] No sensitive data in Docker image layers
- [ ] Container runs as non-root user
- [ ] `ProtectSystem=strict` enabled (systemd deployments)
- [ ] Network exposure is minimized (port 8080 only if needed)
- [ ] Regular image updates from GHCR

---

## 7. Troubleshooting Common Deployment Issues

### 7.1 Container Fails to Start

**Symptom:** Container exits immediately or enters `Restarting` loop.

```bash
# Check logs
docker logs synthtek

# Check health status
docker inspect --format='{{.State.Health.Status}}' synthtek
```

**Common causes:**

| Cause | Fix |
| ----- | --- |
| Missing `dist/` directory | Rebuild image: `docker build -t synthtek:latest .` |
| Permission denied on volumes | Ensure host directories exist with correct ownership: `chown 1000:1000 ./data ./config ./logs` |
| Out of memory | Increase memory limit in compose or systemd: `memory: 1G` |
| Node.js version mismatch | Verify base image: `docker run synthtek:latest node --version` |

### 7.2 Health Check Failing

**Symptom:** Container status shows `unhealthy`.

```bash
# Run health check manually
docker exec synthtek node -e "require('fs').existsSync('/app/dist/cli.js') && process.exit(0)"

# Check if dist/cli.js exists
docker exec synthtek ls -la /app/dist/cli.js
```

**Fix:** If the file is missing, the build step failed. Rebuild the image:

```bash
docker build --no-cache -t synthtek:latest .
```

### 7.3 Volume Permission Issues

**Symptom:** `EACCES: permission denied` errors in logs.

```bash
# Fix ownership for bind mounts
sudo chown -R 1000:1000 ./config ./data ./logs

# For named volumes, recreate them
docker volume rm synthtek-data
docker volume create synthtek-data
```

### 7.4 systemd Service Won't Start

**Symptom:** `systemctl start synthtek` fails.

```bash
# Check detailed status
sudo systemctl status synthtek -l

# Check journal for errors
sudo journalctl -u synthtek --no-pager -n 50

# Test the command manually as the synthtek user
sudo -u synthtek /usr/bin/node /opt/synthtek/dist/cli.js status
```

**Common causes:**

| Cause | Fix |
| ----- | --- |
| Wrong WorkingDirectory | Verify `/opt/synthtek` exists and is owned by `synthtek` |
| Missing Node.js binary | Check path: `which node` → update `ExecStart` |
| SELinux/AppArmor blocking | Add `:z` or `:Z` suffix to volume mounts, or adjust policies |
| `ProtectSystem=strict` blocking writes | Ensure `ReadWritePaths` includes all writable directories |

### 7.5 Docker Image Pull Fails from GHCR

**Symptom:** `docker pull ghcr.io/<owner>/synthtek:latest` returns `404` or `unauthorized`.

```bash
# Authenticate
echo $GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Verify tag exists
docker pull ghcr.io/<owner>/synthtek:v1.0.0
```

**Fix:** Ensure the `docker.yml` workflow has run successfully for the target tag. Check Actions tab in GitHub.

### 7.6 Logs Growing Too Large

**Symptom:** Disk space exhausted by container logs.

```bash
# Check Docker log sizes
du -sh /var/lib/docker/containers/*/*-json.log

# For compose deployments, verify log rotation config
docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -A 10 logging
```

**Fix:** The prod compose file already configures `max-size: 10m` and `max-file: 3`. If using raw Docker:

```bash
# Add to /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
sudo systemctl restart docker
```

### 7.7 Hot-Reload Not Working in Dev Mode

**Symptom:** Code changes don't reflect in the running container.

```bash
# Verify mounts are active
docker inspect synthtek --format='{{json .Mounts}}' | jq
```

**Fix:** The dev compose mounts source files but the TypeScript compiler isn't watching. For true hot-reload, add a `nodemon` or `ts-node` watch command:

```yaml
# In docker-compose.dev.yml, override the command:
command: npx ts-node --watch src/cli.ts
```

---

## Quick Reference

| Task | Command |
| ---- | ------- |
| Build image | `docker build -t synthtek:latest .` |
| Run dev mode | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` |
| Run prod mode | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| Check health | `docker inspect --format='{{.State.Health.Status}}' synthtek` |
| View logs | `docker logs -f synthtek` |
| Start systemd | `sudo systemctl start synthtek` |
| View systemd logs | `sudo journalctl -u synthtek -f` |
| Create release | `git tag -a v1.0.0 -m "Release v1.0.0" && git push origin v1.0.0` |
