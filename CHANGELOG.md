# Changelog

All notable changes to synthtek will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-07

### Highlights

**First stable release.** SynthTek is a modular, plugin-based AI agent framework with 14 LLM providers, 14 messaging channels, a full WebUI, CLI, and Docker deployment — built with zero unnecessary dependencies.

Key metrics at release:
- **1,055 unit tests passing, 0 failing**
- **28,250 lines of TypeScript source** across 127 files
- **20,893 lines of tests** across 82 files
- **4 runtime dependencies** (commander, discord.js, glob, telegraf)
- **0 Biome lint errors** across 208 files
- **0 unsafe type casts** in production source code
- **Full CI/CD pipeline** (lint → test → build → deploy → e2e) running on GitHub Actions

### Added

- **14 LLM providers**: OpenAI, Anthropic, Azure OpenAI, Google Gemini, Mistral AI, OpenRouter, DeepSeek, Qwen, vLLM, Ollama, LM Studio, llama.cpp, Multimodal (image+text), Fallback (MultiProvider with automatic failover)
- **14 messaging channels**: Telegram, Discord, Slack, Matrix, Email, Feishu, WhatsApp, Microsoft Teams, WeChat, WeCom, QQ, DingTalk, WebSocket, and a TUI (terminal UI)
- **WebUI**: Full single-page application (1,570 lines) with chat interface, provider CRUD, skill installer, analytics dashboard, theme system (5 themes), cron job management, OpenAPI 3.0.3 spec, and real-time metrics
- **CLI**: 15 commands covering chat, configuration, channel management, skill installation, and server mode
- **Security module**: AES-256-GCM encryption with scrypt key derivation, token bucket rate limiter, RBAC access control, command sandboxing, input sanitization, session poisoning protection
- **Agent framework**: Generator-based streaming agent loop, pluggable tokenizer (character-count + GPT-2 BPE-style), context window management with compaction, tool registry with timeout/retry/dedup/output validation, circuit breaker error handling, subagent support
- **Skill system**: Built-in skills registry (search, TDD, cron, memory) with a file-based external skill loader via SkillInjector
- **Zero-dependency metrics collector**: Per-route request counts, success/error tracking, avg latency, uptime, memory usage — served at `GET /api/metrics`
- **OpenAPI 3.0.3**: Complete spec covering all 16 REST API endpoints, served at `GET /api/openapi.json`
- **Version indicator**: Version displayed in WebUI sidebar and TUI bottom bar
- **Docker support**: Multi-stage build (342MB), non-root user (UID 999), healthcheck, docker-compose with persistent data volumes
- **Self-hosted GitHub Actions runner**: Full CI/CD pipeline including E2E browser tests against production deployment

### Changed

- **Telegram channel**: Replaced 1,100+ lines of custom HTTP API calls with the `telegraf` library (4.16.3) — 50% LOC reduction, type-safe API, battle-tested retry logic
- **Frontend**: Extracted `frontend-utils.ts` with 26 functional tests — canonical `escapeHtml`, `renderMarkdown`, formatters. Eliminated duplicate `escapeHtml` (two implementations existed in the same file)
- **Config schema**: `AgentLoopConfig` now imported from canonical `agent/types.ts` — eliminated duplication with `config/schema.ts`
- **Error classification**: Consolidated 3 separate implementations (`retry.ts`, `error-handler.ts`, `chat-handler.ts`) into a single `classifyError()` in `retry.ts`
- **Runner typing**: Replaced `any` casts in `wireChannel()` with proper generic type parameters
- **Provider persistence**: Added write verification (read-back check), diagnostics endpoint, and proper error propagation to frontend
- **Deployment**: Port changed from 8080 to 3456, volume permissions fixed with `a+rwX`, cache-control headers added to all API responses
- **Removed 6,400+ lines of dead code**: Orphaned modules (memory, plugins, media, MCP, performance), duplicate config services, stale test files

### Fixed

- Provider data no longer disappears on page refresh (cache-control + write verification)
- EACCES permission errors on Synology volumes (fallback `chmod a+rwX` in entrypoint)
- Telegram channel type safety (30+ `any` casts eliminated)
- Discord channel type safety (16 `as any` casts documented as intentional)
- WebUI chat state no longer lost when navigating between pages
- Conversation persistence across container restarts
- Zero `any` type escapes remain in production source code
- All E2E tests pass against live production deployment (8 API tests)

### Removed

- `src/memory/` (19 files) — orphaned entity extraction, knowledge graph, memory managers
- `src/plugins/` (5 files) — orphaned plugin loading/runtime system
- `src/media/` (3 files) — orphaned media processing pipeline
- `src/mcp/` (8 files) — orphaned Model Context Protocol support
- `src/performance/` (7 files) — orphaned cache, connection pool, parallel executor
- `src/config/multi-instance.ts` (207 lines) — unused multi-instance config support
- `src/config/secret.ts` (136 lines) — unused secrets management
- `src/config/loader.ts` (280 lines) — unused config loading
- `src/config/hot-reload.ts` (128 lines) — unused hot-reload support
- Duplicate `RateLimiter` in `cli-validation.ts` (delegated to `security/rate-limiter.ts`)
- Stale `console.log` JSDoc in `session.ts`
- Unused `ChannelUsageRecord` type in `webui/types.ts`
- Duplicate `ProviderType` definition in `schema.ts` (imported from `providers/types.ts`)

## [0.2.0] — 2026-04-22

### Added
- Logging module with JSON output and file rotation
- Docker Compose configuration

## [0.1.0] — 2026-04-20

### Added
- Initial project scaffolding
- Plugin system foundation
- Provider abstraction layer
- Agent loop core
