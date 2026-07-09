# Synthtek

**v1.0.1** — A modular, plugin-based AI agent framework built with Node.js and TypeScript.

[![Tests](https://img.shields.io/badge/tests-1055%20passing-brightgreen)](https://github.com/kane-mar/synthtek)
[![E2E](https://img.shields.io/badge/e2e-228%20suites%20passing-brightgreen)](https://github.com/kane-mar/synthtek)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

---

## Features

- **14 AI Providers** — Unified interface for OpenAI, Anthropic, OpenRouter, DeepSeek, Gemini, Mistral, Azure, Ollama, LM Studio, llama.cpp, vLLM, Qwen, multimodal, and a fallback chain
- **14 Channel Integrations** — Telegram, Discord, Slack, Matrix, Email, Feishu, WeCom, QQ, DingTalk, WhatsApp, Teams, WeChat, WebSocket
- **Agent Loop** — Streaming responses, native tool calls, exponential backoff, circuit breaker, subagent spawning, pluggable tokenizer
- **Built-in Tools** — File I/O, workspace search (glob/grep), web fetching, command execution, code editing
- **Skill System** — File-based skill loading with `SkillInjector` wired into the runtime. Installed skills: agent-collaboration, backlog-management, definition-of-done, kanban-board
- **Configuration** — JSON/YAML files with env var overrides, hot-reload support, AES-256-GCM secret management
- **Structured Logging** — JSON output with file rotation, per-module isolation
- **Security** — Encryption, rate limiting, command sandboxing, RBAC access control, input sanitization, session poisoning protection
- **WebUI** — Full management interface with chat, analytics, metrics, provider CRUD, skill manager, system config, cron management, and OpenAPI 3.0.3 docs
- **CLI** — 15 commands via `commander`: agent, chat, config, exec, file, init, logs, plugin, restart, search, spawn, status, stop, webui
- **Docker Ready** — Multi-stage build (342MB), non-root user, healthcheck, Docker Compose profiles for dev/prod
- **CI/CD** — GitHub Actions for testing (matrix: Node 22.x & 24.x), linting, Docker publishing, production deployment, and E2E testing

---

## Quick Start

### Using Docker (recommended)

```bash
# Pull and run the WebUI
docker run -d \
  --name synthtek \
  -p 3456:3456 \
  -e WEBUI_PORT=3456 \
  -e SYNTHTEK_WORKSPACE=/data \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest

# Open http://localhost:3456
```

Then configure a provider via the WebUI settings tab (OpenAI, Anthropic, Ollama, etc.) and start chatting.

### Using Docker Compose

```bash
# Clone and start
git clone https://github.com/kane-mar/synthtek.git
cd synthtek
docker compose up -d --build

# Open http://localhost:3456
```

### Using Node.js directly

```bash
# Prerequisites: Node.js >= 20.0.0
git clone https://github.com/kane-mar/synthtek.git
cd synthtek
npm install
npm run build

# Start the WebUI
npm start webui -- --port 3456

# Or start the interactive chat CLI
npm start chat
```

---

## Getting Started with Docker

### Pull the Image

```bash
docker pull ghcr.io/kane-mar/synthtek:latest
```

### Run the WebUI

The WebUI provides a browser-based interface for managing providers, chatting with agents, viewing analytics, and configuring the system.

```bash
docker run -d \
  --name synthtek \
  --restart unless-stopped \
  -p 3456:3456 \
  -e WEBUI_PORT=3456 \
  -e WEBUI_HOST=0.0.0.0 \
  -e SYNTHTEK_WORKSPACE=/data \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest
```

**Open http://localhost:3456** in your browser.

### Run with an AI Provider

Set your API key via environment variables:

```bash
docker run -d \
  --name synthtek \
  -p 3456:3456 \
  -e WEBUI_PORT=3456 \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_MODEL=gpt-4o \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest
```

Or configure providers via the WebUI after starting — they persist in the `/data` volume.

### Run Channels

```bash
# Telegram
docker run -d \
  --name synthtek-telegram \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_TELEGRAM_TOKEN=your-bot-token \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest telegram

# Discord
docker run -d \
  --name synthtek-discord \
  -e SYNTHTEK_PROVIDER=openai \
  -e SYNTHTEK_API_KEY=sk-... \
  -e SYNTHTEK_DISCORD_TOKEN=your-bot-token \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest discord
```

### Run with a Local Provider (Ollama)

```bash
docker run -d \
  --name synthtek-ollama \
  --network host \
  -e SYNTHTEK_PROVIDER=ollama \
  -e SYNTHTEK_BASE_URL=http://localhost:11434 \
  -e SYNTHTEK_MODEL=llama3 \
  -v synthtek_data:/data \
  ghcr.io/kane-mar/synthtek:latest
```

### Verify It's Running

```bash
curl http://localhost:3456/api/health
# → {"name":"webui","status":"started","connected":true,"uptime":...}

curl http://localhost:3456/api/version
# → {"version":"1.0.0"}
```

### Docker Compose (Production)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBUI_PORT` | `3456` | WebUI listen port |
| `WEBUI_HOST` | `0.0.0.0` | WebUI bind address |
| `WEBUI_API_KEY` | `""` | Optional API key for WebUI auth (empty = open mode) |
| `WEBUI_MAX_SESSIONS` | `100` | Maximum concurrent chat sessions |
| `WEBUI_SESSION_TIMEOUT` | `3600` | Session idle timeout in seconds |
| `SYNTHTEK_WORKSPACE` | `/data` | Workspace directory for config, conversations, and skills |
| `SYNTHTEK_PROVIDER` | `openai` | Default LLM provider |
| `SYNTHTEK_API_KEY` | `""` | Provider API key |
| `SYNTHTEK_BASE_URL` | — | Custom base URL for provider |
| `SYNTHTEK_MODEL` | — | Model name (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |
| `SYNTHTEK_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

### Data Persistence

All data (providers, conversations, config, installed skills) is stored in the mounted volume:

```bash
# Backup
docker run --rm -v synthtek_data:/data -v $(pwd):/backup alpine tar czf /backup/synthtek-backup.tar.gz -C /data .

# Restore
docker run --rm -v synthtek_data:/data -v $(pwd):/backup alpine tar xzf /backup/synthtek-backup.tar.gz -C /data

# Inspect
docker volume inspect synthtek_data
```

### Updating

```bash
docker compose pull
docker compose up -d --build
```

### Troubleshooting Docker

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' synthtek

# View logs
docker logs -f synthtek

# Check resource usage
docker stats synthtek

# Fix volume permissions (UID 999 = synthtek user)
docker run --rm -v synthtek_data:/data alpine chown -R 999:999 /data
```

---

## Supported Providers

| Provider | Models | Streaming | Cost Tracking |
|----------|--------|-----------|---------------|
| OpenAI | GPT-4, GPT-3.5, o1, o3-mini | ✅ | ✅ |
| Anthropic | Claude Sonnet/Opus/Haiku | ✅ | ✅ |
| OpenRouter | Multi-model routing | ✅ | ✅ |
| Azure OpenAI | Azure-hosted OpenAI models | ✅ | ✅ |
| Gemini | Gemini 1.5/2.0 | ✅ | ✅ |
| Mistral | Mistral/Mixtral | ✅ | ✅ |
| DeepSeek | DeepSeek-V2/V3/R1 | ✅ | ✅ |
| Qwen | Qwen 2.5 | ✅ | ✅ |
| vLLM | Any vLLM-served model | ✅ | ✅ |
| Ollama | Any Ollama model | ✅ | — |
| LM Studio | Any LM Studio model | ✅ | — |
| llama.cpp | Any llama.cpp model | ✅ | — |
| Multimodal | Image + text input | ✅ | — |
| Fallback | Provider chain with failover | ✅ | ✅ |

---

## Supported Channels

| Channel | Messages | Threads | Media | Reactions | Tests |
|---------|----------|---------|-------|-----------|-------|
| Telegram | ✅ | ✅ | ✅ | ✅ | 40+ |
| Discord | ✅ | ✅ | ✅ | ✅ | 29 |
| Slack | ✅ | ✅ | ✅ | ✅ | 55 |
| Matrix | ✅ | ✅ | ✅ | ✅ | 20 |
| Email (IMAP/SMTP) | ✅ | ✅ | ✅ | — | 20 |
| Feishu | ✅ | ✅ | ✅ | ✅ | 20 |
| WeCom (WeChat Work) | ✅ | ✅ | ✅ | ✅ | 20 |
| QQ | ✅ | ✅ | ✅ | ✅ | 20 |
| DingTalk | ✅ | ✅ | ✅ | ✅ | 20 |
| WhatsApp | ✅ | ✅ | ✅ | ✅ | 20 |
| Teams | ✅ | ✅ | ✅ | ✅ | 20 |
| WeChat | ✅ | — | — | — | 8 |
| WebSocket | ✅ | — | — | — | 6 |

All channels extend `BaseChannel` with a consistent lifecycle (`connect`, `disconnect`, `onMessage`, `sendMessage`) except WebSocket and WeChat (standalone implementations).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Entry Points                             │
│    CLI (commander, 15 commands)    WebUI    Docker               │
├──────────────────────────────────────────────────────────────────┤
│                       Agent Runtime                              │
│   AgentSession → AgentLoop (generator-based, streaming)          │
│     ├── ContextWindowManager (pluggable tokenizer)               │
│     ├── ToolRegistry (timeout, retry, dedup, schema)             │
│     ├── AgentErrorHandler (classification, circuit breaker)      │
│     ├── ResponseFormatter (markdown/json/plain/structured)       │
│     ├── AgentHooks (init, message, LLM, tool lifecycle events)   │
│     ├── Subagent (parallel child agents with configurable scope) │
│     └── Heartbeat (periodic health checks)                       │
├──────────────────────┬───────────────────────────────────────────┤
│     Channel Layer    │          Provider Layer                   │
│  Telegram (telegraf) │   OpenAI    Anthropic   OpenRouter        │
│  Discord (discord.js)│   Azure     Gemini      Mistral   DeepSeek│
│  Slack   Matrix      │   Qwen      vLLM        Ollama            │
│  Email   Feishu      │   LM Studio llama.cpp                     │
│  WhatsApp  Teams     │   Multimodal  Fallback                    │
│  WeChat  WeCom  QQ   │   All extend BaseProvider:                │
│  DingTalk WebSocket  │   fetchWithRetry + parseSSEStream         │
│  All extend          │   + calculateCost + buildConfig           │
│   BaseChannel        │                                           │
├──────────────────────┴───────────────────────────────────────────┤
│                     Core Services                                │
│  Config (JSON/YAML + env + CLI)    Logger (JSON + file rotation) │
│  Filesystem (async I/O)            Executor (command execution)  │
│  Search (glob + grep)              CLI-Validation (sanitize)     │
├──────────────────────────────────────────────────────────────────┤
│                     Cross-Cutting                                │
│  Security: Encryption (AES-256-GCM) | RateLimiter (token bucket) │
│           | AccessControl (RBAC) | ShellSandbox                  │
│           | InputSanitizer | SessionPoisoning protection         │
│  WebUI:   MetricsCollector (per-route) | AnalyticsTracker        │
│           | OpenAPI 3.0.3 spec (16 endpoints)                    │
│           | SkillManager | ProviderManager                       │
│  Tokenizer: CharacterCount (4 chars/token) | GptBpeTokenizer     │
│             | Pluggable registry pattern                         │
│  Skills:   BuiltInSkillsRegistry | SkillInjector (file-based)    │
│            | Scripts, references, TUI extensions                 │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Generator-based streaming** — The agent loop uses `AsyncGenerator` for streaming LLM responses to clients (WebUI, CLI, and channels)
- **Channel registry** — All 14 channels are registered in a static array, eliminating 200+ lines of per-channel startup code
- **BaseProvider pattern** — Consolidated 1,020+ lines of duplicate fetch/retry/stream-parsing/cost-calculation into a single base class
- **Zero-framework HTTP** — The WebUI backend uses raw Node.js `http.createServer` with a unified RouteEntry router — no Express, no Fastify
- **Pluggable tokenizer** — `Tokenizer` interface with character-count (fast, default) and GPT-2 BPE-style (~90% accuracy) implementations
- **File-based skills** — Skills are loaded from `.skills/` directories as YAML/JSON files with command triggers — no plugin compilation needed
- **Zero type casts** — The entire codebase compiles with `strict: true` and zero `any` casts in production code (discord.js interop documented as intentional)

---

## Project Structure

```
src/
  cli/          CLI entry point (commander) + 15 commands
  agent/        Agent runtime (loop, session, tools, context, tokenizer, subagent, heartbeat)
  channels/     14 channel integrations (Telegram, Discord, Slack, ...)
  providers/    14 LLM providers (OpenAI, Anthropic, Ollama, ...)
  webui/        WebUI backend (server, routes, provider/skill manager, analytics, metrics, OpenAPI) + frontend.html
  config/       Configuration system (loader, schema, agent-config)
  core/         Core services (logger, filesystem, executor, search, cli-validation)
  security/     Security (encryption, rate-limiter, access-control, sandbox, sanitizer)
  skills/       Skill system (registry, injector, built-in skills)

tests/          ~1,055 tests across 82 test files
  agent/        Agent loop, session, tools, context, tokenizer, retry, subagent, heartbeat
  channels/     All 14 channels
  providers/    All 12 dedicated providers + base, registry, multimodal, fallback, reasoning
  config/       Schema, secrets, agent-config, multi-instance
  webui/        Backend, server, auth, analytics, metrics, provider-manager, skill-manager, OpenAPI
  cli/          CLI commands
  e2e/          Playwright E2E browser tests
```

---

## Development

```bash
# Prerequisites
node --version  # >= 20.0.0
npm --version   # >= 10.0.0

# Setup
git clone https://github.com/kane-mar/synthtek.git
cd synthtek
npm install
npm run build

# Test (1,055 passing, 0 failing)
npm test

# Lint (Biome — 0 errors on 126 source + 82 test files)
npm run lint

# Run WebUI locally
npm start webui -- --port 3456

# Run interactive chat CLI
npm start chat

# Run E2E browser tests (requires Chromium system deps)
npx playwright install --with-deps chromium
npm run test:e2e

# Clean build artifacts
npm run clean
```

---

## Project Stats

- **~28,250 lines** of TypeScript source (126 files)
- **~20,900 lines** of tests (82 files)
- **4 runtime dependencies:** `commander`, `discord.js`, `glob`, `telegraf`
- **1,055 tests passing** (100% green, 1 intentionally skipped)
- **228 test suites** across all modules
- **228 E2E internal API test suites** passing
- **0 Biome lint errors/warnings**
- **0 type casts** in production code (discord.js interop documented)
- **Docker image:** 342MB, multi-stage build, non-root user (UID 999)

---

## Acknowledgements

Built with TypeScript, Node.js, and a philosophy of minimal dependencies. The channel and provider patterns draw inspiration from LangChain and Home Assistant, adapted for an agent-first architecture.
