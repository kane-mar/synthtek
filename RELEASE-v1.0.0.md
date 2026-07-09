# SynthTek v1.0.0 — First Stable Release

**A modular, plugin-based AI agent framework.** 14 LLM providers, 14 messaging channels, full WebUI + CLI + TUI, zero unnecessary dependencies.

## Quick Start

```bash
# Docker (recommended)
docker run -d \
  --name synthtek \
  -p 3456:3456 \
  ghcr.io/kane-mar/synthtek:latest

# Open http://localhost:3456
```

```bash
# Or from source
git clone https://github.com/kane-mar/synthtek.git
cd synthtek
npm install && npm run build
npx synthtek webui --port 3456
```

## What's Included

### 14 LLM Providers
OpenAI · Anthropic · Azure OpenAI · Google Gemini · Mistral AI · OpenRouter · DeepSeek · Qwen · vLLM · Ollama · LM Studio · llama.cpp · Multimodal (image+text) · Fallback (auto-failover)

### 14 Messaging Channels
Telegram · Discord · Slack · Matrix · Email · Feishu · WhatsApp · Microsoft Teams · WeChat · WeCom · QQ · DingTalk · WebSocket · TUI (terminal)

### WebUI
- Chat with streaming responses
- Provider management (CRUD)
- Skill installer
- Analytics dashboard with per-route metrics
- 5 themes (Light, Dark, Midnight, Solarized, High Contrast)
- OpenAPI 3.0.3 spec at `/api/openapi.json`
- Live metrics at `/api/metrics`

### Security
- AES-256-GCM encryption with scrypt key derivation
- Token bucket rate limiter
- RBAC access control
- Command sandboxing
- Input sanitizer
- Session poisoning protection

### DevOps
- Multi-stage Docker build (342MB, non-root user)
- Docker Compose with persistent volumes
- Full CI/CD on GitHub Actions (lint → test → build → deploy → e2e)
- Self-hosted runner support

## Project Stats

| Metric | Value |
|--------|-------|
| TypeScript source | 28,250 lines (127 files) |
| Tests | 20,893 lines (82 files) |
| Unit tests passing | **1,055** |
| E2E tests passing | **8/8** API tests |
| Runtime dependencies | **4** (commander, discord.js, glob, telegraf) |
| Biome lint errors | **0** (208 files) |
| Unsafe type casts | **0** in production source code |

## What Changed Since 0.2.0

See the full [CHANGELOG](./CHANGELOG.md) for details, but the highlights:

- **Complete rewrite** of the Telegram channel using `telegraf` — 50% less code, type-safe
- **Extracted `frontend-utils.ts`** — canonical utility functions with 26 tests
- **Consolidated error classification** — 3 implementations → 1
- **Removed 6,400+ lines of dead code** — orphaned modules, duplicate services, stale tests
- **Fixed provider persistence** — data survives page refreshes and container restarts
- **Fixed volume permissions** — works on Synology, Docker Desktop, and bare Linux
- **Added OpenAPI 3.0.3 spec**, metrics collector, pluggable tokenizer
- **Zero type casts** remaining in production code

## Links

- **Repository**: https://github.com/kane-mar/synthtek
- **Issues**: https://github.com/kane-mar/synthtek/issues
- **Packages**: https://github.com/kane-mar/synthtek/pkgs/container/synthtek
- **CI/CD**: https://github.com/kane-mar/synthtek/actions
