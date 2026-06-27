# Synthtek Docker Guide

## Quick Start

```bash
# Clone and build
git clone <repo> && cd synthtek
docker compose up -d --build

# Access WebUI at http://localhost:8080
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SYNTHTEK_PROVIDER` | No | `openai` | LLM provider (openai, anthropic, openrouter, ollama, lmstudio, llamacpp, vllm) |
| `SYNTHTEK_API_KEY` | **No** | `""` | API key (optional — provider fails at runtime if needed but not provided) |
| `SYNTHTEK_BASE_URL` | No | — | Custom base URL (for local providers) |
| `SYNTHTEK_MODEL` | No | — | Model name (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `SYNTHTEK_TIMEOUT` | No | — | Request timeout in ms |
| `SYNTHTEK_MAX_RETRIES` | No | — | Max retry attempts |
| `SYNTHTEK_SYSTEM_PROMPT` | No | — | System prompt |
| `SYNTHTEK_LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |
| `SYNTHTEK_STREAM` | No | `false` | Stream output (true/false) |
| `SYNTHTEK_WORKSPACE` | No | `/data` | Workspace directory |
| `WEBUI_HOST` | No | `0.0.0.0` | WebUI host |
| `WEBUI_PORT` | No | `8080` | WebUI port |
| `WEBUI_API_KEY` | No | `""` | WebUI API key (leave empty for open mode) |
| `WEBUI_MAX_SESSIONS` | No | `100` | Max concurrent sessions |
| `WEBUI_SESSION_TIMEOUT` | No | `3600` | Session timeout in seconds |

### Provider Examples

#### OpenAI
```yaml
environment:
  - SYNTHTEK_PROVIDER=openai
  - SYNTHTEK_API_KEY=sk-...
  - SYNTHTEK_MODEL=gpt-4o
```

#### Anthropic
```yaml
environment:
  - SYNTHTEK_PROVIDER=anthropic
  - SYNTHTEK_API_KEY=sk-ant-...
  - SYNTHTEK_MODEL=claude-sonnet-4-20250514
```

#### OpenRouter
```yaml
environment:
  - SYNTHTEK_PROVIDER=openrouter
  - SYNTHTEK_API_KEY=sk-or-...
  - SYNTHTEK_MODEL=openai/gpt-4o
```

#### Ollama (local, no API key needed)
```yaml
environment:
  - SYNTHTEK_PROVIDER=ollama
  - SYNTHTEK_BASE_URL=http://host.docker.internal:11434
  - SYNTHTEK_MODEL=llama3
```

#### LM Studio (local, no API key needed)
```yaml
environment:
  - SYNTHTEK_PROVIDER=lmstudio
  - SYNTHTEK_BASE_URL=http://host.docker.internal:1234
  - SYNTHTEK_MODEL=local-model
```

#### llama.cpp (local, no API key needed)
```yaml
environment:
  - SYNTHTEK_PROVIDER=llamacpp
  - SYNTHTEK_BASE_URL=http://host.docker.internal:8080
  - SYNTHTEK_MODEL=local-model
```

#### vLLM (local, no API key needed)
```yaml
environment:
  - SYNTHTEK_PROVIDER=vllm
  - SYNTHTEK_BASE_URL=http://host.docker.internal:8000
  - SYNTHTEK_MODEL=meta-llama/Llama-3-8b
```

## Docker Compose Profiles

### Development
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Production
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Production with Reverse Proxy (Nginx)
```yaml
services:
  synthtek:
    # ... (from docker-compose.yml)
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - synthtek
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

### Production with Traefik
```yaml
services:
  synthtek:
    # ... (from docker-compose.yml)
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.synthtek.rule=Host(`synthtek.example.com`)"
      - "traefik.http.routers.synthtek.tls=true"
      - "traefik.http.routers.synthtek.tls.certresolver=letsencrypt"
      - "traefik.http.services.synthtek.loadbalancer.server.port=8080"
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

## Docker CLI

### Build
```bash
docker build -t synthtek:latest .
```

### Run (WebUI)
```bash
docker run -d \
  --name synthtek \
  -p 8080:8080 \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_MODEL=gpt-4o \
  -v synthtek-data:/data \
  synthtek:latest
```

### Run (CLI mode)
```bash
docker run -it --rm \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  synthtek:latest cli
```

### Run (Telegram channel)
```bash
docker run -d \
  --name synthtek-telegram \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_TELEGRAM_TOKEN=... \
  -v synthtek-data:/data \
  synthtek:latest telegram
```

### Run (Discord channel)
```bash
docker run -d \
  --name synthtek-discord \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_DISCORD_TOKEN=... \
  -v synthtek-data:/data \
  synthtek:latest discord
```

### Run (Slack channel)
```bash
docker run -d \
  --name synthtek-slack \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_SLACK_TOKEN=... \
  -v synthtek-data:/data \
  synthtek:latest slack
```

### Run (with local Ollama)
```bash
docker run -d \
  --name synthtek-ollama \
  --network host \
  -e SYNTHTEK_PROVIDER=ollama \
  -e SYNTHTEK_BASE_URL=http://localhost:11434 \
  -e SYNTHTEK_MODEL=llama3 \
  -v synthtek-data:/data \
  synthtek:latest
```

## Health Check

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' synthtek

# Test WebUI health endpoint
curl http://localhost:8080/api/health
```

## Logs

```bash
# Follow logs
docker logs -f synthtek

# Last 100 lines
docker logs --tail 100 synthtek

# Since specific time
docker logs --since 2026-05-01T00:00:00 synthtek
```

## Data Persistence

```bash
# Create volume
docker volume create synthtek-data

# Inspect volume
docker volume inspect synthtek-data

# Backup
docker run --rm -v synthtek-data:/data -v $(pwd):/backup alpine tar czf /backup/synthtek-backup.tar.gz -C /data .

# Restore
docker run --rm -v synthtek-data:/data -v $(pwd):/backup alpine tar xzf /backup/synthtek-backup.tar.gz -C /data
```

## Updating

```bash
# Pull latest and rebuild
docker compose pull
docker compose up -d --build

# Or with CLI
docker pull synthtek:latest
docker stop synthtek
docker rm synthtek
docker run -d --name synthtek ... synthtek:latest
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs synthtek

# Check if port is in use
lsof -i :8080

# Check disk space
docker system df
```

### Provider connection issues
```bash
# Test provider connectivity from container
docker exec -it synthtek node -e "fetch('http://host.docker.internal:11434/api/tags').then(r => r.json()).then(console.log)"

# Check DNS resolution
docker exec -it synthtek nslookup host.docker.internal
```

### Permission issues
```bash
# Fix volume permissions
docker run --rm -v synthtek-data:/data alpine chown -R 1000:1000 /data
```

### Memory issues
```bash
# Check container resource usage
docker stats synthtek

# Set memory limit in docker-compose.yml
services:
  synthtek:
    deploy:
      resources:
        limits:
          memory: 1G
```

## Security

### API Key Protection
```yaml
# Use Docker secrets for sensitive data
services:
  synthtek:
    secrets:
      - synthtek_api_key

secrets:
  synthtek_api_key:
    file: ./secrets/api_key.txt
```

### Network Isolation
```yaml
networks:
  synthtek-network:
    driver: bridge
    internal: true  # No external access
```

### Read-Only Filesystem
```yaml
services:
  synthtek:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - synthtek-data:/data
```
