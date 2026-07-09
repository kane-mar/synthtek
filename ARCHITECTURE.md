# Architecture

> **Last updated:** 2026-07-05  
> **Tests:** 1,012 passing, 3 skipped, 370 suites (100% green) – all tests pass  
> **E2E:** 61 internal API e2e test suites passing (Playwright WebUI tests require Chromium)  
> **Source:** 125 TypeScript files (~28,000 LOC) + 75 test files (~19,200 LOC)  
> **Lint:** Clean (0 errors, 0 warnings) – Biome

---

## Overview

Synthtek is a modular plugin-based AI agent framework built with Node.js (>=20.0.0) and TypeScript (ES2022). It follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       Entry Points                          │
│          CLI (commander)  │  WebUI  │  Docker               │
├─────────────────────────────────────────────────────────────┤
│                     Agent Runtime                            │
│   AgentSession → AgentLoop → ToolRegistry → BuiltinTools   │
├──────────────────────┬──────────────────────────────────────┤
│    Channel Layer     │         Provider Layer               │
│  Telegram  Discord   │   OpenAI  Anthropic  DeepSeek        │
│  Slack  Matrix  ...  │   Ollama  LM Studio  ...             │
├──────────────────────┴──────────────────────────────────────┤
│                    Core Services                             │
│   Config   Logger   Filesystem   Executor   Search           │
├─────────────────────────────────────────────────────────────┤
│                   Cross-Cutting                              │
│   Security (encryption, rate-limit, access-control)          │
│   Performance (streaming, cache, connection-pool)            │
│   Memory (entity-extraction, knowledge-graph, long/short)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Map

### `src/cli/` — CLI Entry Point
- **`cli.ts`** — root CLI using `commander`; defines commands
- **Commands** (15): `agent`, `chat`, `config`, `exec`, `file`, `init`, `logs`, `plugin`, `restart`, `search`, `spawn`, `status`, `stop`, `webui`
- **`cli-context.ts`** — lazy singletons for logger, config, rate-limiter

### `src/agent/` — Agent Runtime (core brain)
| File | Lines | Responsibility |
|------|-------|----------------|
| `session.ts` | 191 | Unified session interface wrapping loop + store + history |
| `loop.ts` | 956 | Core message→LLM→tools→response cycle |
| `runner.ts` | ~260 | Wires channels + sessions + providers together (consolidated from 14 start methods → channel registry) |
| `context.ts` | 160 | Context window management with compaction/trimming |
| `tools.ts` | 348 | Tool registry with timeout, retry, validation |
| `builtin-tools.ts` | ~455 | 8 built-in tools (read/write/edit file, exec, glob, grep, list_dir, web_fetch) |
| `error-handler.ts` | ~155 | Retry + circuit breaker state machine (dead code `formatErrorMessage` removed) |
| `response-formatter.ts` | 140 | Response formatting (markdown/json/plain/structured) |
| `subagent.ts` | 192 | Spawn child agents for parallel task execution |
| `heartbeat.ts` | 100 | Periodic health checks |
| `types.ts` | 104 | Agent types (AgentMessage, ToolCall, AgentLoopConfig, etc.) |

### `src/channels/` — Channel Integrations (14 channels)
All channels extend `BaseChannel` with consistent lifecycle:

| Channel | File Size | Features |
|---------|-----------|----------|
| Telegram | 1,491 lines | Messages, media, threads, reactions, webhook/polling |
| Discord | 1,241 lines | Messages, embeds, threads, reactions |
| Slack | 594 lines | Messages, threads, blocks |
| Matrix | 457 lines | Messages, threads |
| Email | 372 lines | IMAP/SMTP |
| Feishu, WeCom, QQ, DingTalk, WhatsApp, Teams, WeChat, WebSocket | ~300-400 each | Full implementations |

### `src/providers/` — LLM Providers (14 providers)
All extend `BaseProvider` which provides:
- `getConfig()` — config access with defaults
- `fetchWithRetry()` — HTTP calls with timeout, retry, circuit breaker
- `parseSSEStream()` — SSE stream parsing
- `calculateCost()` — token-based cost estimation

**Providers:** OpenAI, Anthropic, OpenRouter, Azure, Gemini, Mistral, DeepSeek, Qwen, vLLM, Ollama, LM Studio, llama.cpp + Fallback provider

### `src/webui/` — Web UI (back-end only)
- **`server.ts`** — HTTP server bootstrap (routes delegated to handler modules)
- **`backend.ts`** — Business logic (sessions, messages, analytics, tools)
- **`auth.ts`** — API key authentication
- **`chat-handler.ts`** — Chat completion endpoint
- **`provider-manager.ts`** — Provider CRUD
- **`provider-routes.ts`** — Provider API routes
- **`skill-manager.ts`** — Skill installation/lifecycle
- **`skill-routes.ts`** — Skill API routes
- **`frontend.html`** — Single-page frontend (~500 lines HTML+JS)

### `src/config/` — Configuration System
- **`loader.ts`** — JSON/YAML file loading with env var overrides
- **`schema.ts`** — JSON Schema validation
- **`secrets.ts`** — AES-256-GCM encryption for API keys
- **`hot-reload.ts`** — File watcher for config changes
- **`agent-config.ts`** — Agent-specific config (system prompt, etc.)
- **`multi-instance.ts`** — Multi-instance coordination

### `src/core/` — Core Services
- **`logger.ts`** — SimpleLogger (JSON output, file rotation)
- **`config.ts`** — ConfigServiceImpl
- **`filesystem.ts`** — Async file operations
- **`executor.ts`** — Command execution
- **`search.ts`** — Workspace search (glob + grep)
- **`cli-validation.ts`** — CLI input validation + rate limiting

### `src/security/` — Security
- **`encryption.ts`** — AES-256-GCM with scrypt key derivation
- **`rate-limiter.ts`** — Token bucket rate limiter
- **`access-control.ts`** — Role-based access control
- **`sandbox.ts`** — Command sandboxing
- **`sanitizer.ts`** — Input sanitization

### Optional/Standalone Modules (tested but not integrated into runtime)
These modules have full test coverage but are not yet wired into the main runtime:

- **`src/memory/`** — Entity extraction, knowledge graph, long/short-term memory
- **`src/plugins/`** — Plugin system (discovery, loading, lifecycle)
- **`src/media/`** — Media processing (image/audio/video/document)
- **`src/mcp/`** — Model Context Protocol (client, server, transport)
- **`src/performance/`** — Cache, connection pool, context manager, parallel executor (except streaming which IS integrated)
- **`src/skills/injector.ts`** — Skill injector for LangChain/exec/HTTP tools

---

## Critical Data Flows

### Message Processing
```
User Message
  → Channel (Telegram/Discord/WebUI)
    → AgentSession.processMessage()
      → [Clear old context]
      → [Load history from ConversationStore]
      → [Persist user message]
      → AgentLoop.processMessage()
        → ToolRegistry (register + execute tools)
        → ContextWindowManager (track tokens, compact if needed)
        → LLM Provider (chat/completion API)
        → ErrorHandler (retry + circuit breaker)
        → ResponseFormatter (format response)
      → [Persist assistant response]
    → Channel sends reply
```

### Startup Sequence
```
cli.ts / Docker
  → ConfigLoader (load config files + env vars)
  → Logger setup
  → AgentRunner.start()
    → startAllChannels() via CHANNEL_REGISTRY (14 channels, dynamic import)
      → For each configured channel:
        → import(channelModule)
        → wireChannel() → register onMessage handler → channel.connect()
    → Provider setup (from config or fallback chain)
    → Ready to process messages
```

### Channel Registration
All 14 channels are registered in `AgentRunner.CHANNEL_REGISTRY` — a static array
mapping channel name → import path → class name → getChatId extractor.
`startAllChannels()` iterates the registry and starts only configured channels,
eliminating 200+ lines of repetitive `startXxx` methods.

---

## Testing Strategy
- **Test framework:** Node.js built-in `node --test`
- **Test runner:** `npm test` (builds TypeScript, runs compiled JS)
- **Tests:** 1,313 across 80 test files (after dead code removal)
- **E2E:** Playwright tests for WebUI (`tests/e2e/*.spec.ts`); internal API e2e tests
- **CI:** GitHub Actions (test + lint on push/PR, docker build on main)
- **Lint:** Biome (`npm run lint`) – zero errors on 261 files

---

## Building & Running

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Run (CLI)
node dist/src/cli.js webui

# Docker
docker compose up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Configuration

Configuration is loaded from:
1. Environment variables (`SYNTHTEK_*`)
2. Config file (`config.json` / `config.yaml`)
3. CLI flags

See `README.md` (Environment Variables section) for environment variable reference.
See `src/config/loader.ts` for loading logic.
