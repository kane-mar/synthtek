# synthtek

A modular, plugin-based AI agent framework built with Node.js and TypeScript.

[![Tests](https://img.shields.io/badge/tests-1012%20passing-brightgreen)](https://github.com/synthtek/synthtek)
[![E2E](https://img.shields.io/badge/e2e-61%20suites%20passing-brightgreen)](https://github.com/synthtek/synthtek)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Features

- **Plugin System** — Topological dependency resolution, error boundaries, JSON Schema validation
- **Multi-Provider** — 14 AI providers with unified interface (OpenAI, Anthropic, OpenRouter, DeepSeek, Gemini, Mistral, Azure, Ollama, LM Studio, llama.cpp, vLLM, Qwen, multimodal)
- **Channel Integrations** — 14 channels (Telegram, Discord, Slack, Matrix, Email, Feishu, WeCom, QQ, DingTalk, WhatsApp, Teams, WeChat, WebSocket)
- **Agent Loop** — Streaming responses, native tool calls, exponential backoff, circuit breaker, subagent spawning
- **Configuration** — JSON/YAML files, env var overrides, AES-256-GCM secret management, hot-reload
- **Logging** — Structured JSON output, file rotation, per-plugin isolation
- **Security** — Encryption, rate limiting, sandboxing, access control, input sanitization
- **Memory** — Entity extraction, knowledge graph, short/long-term memory with maintenance skills
- **WebUI** — Full management interface with chat, analytics, skills, cron, and system config
- **Docker Ready** — Multi-stage build, Compose profiles for dev/prod
- **CI/CD** — GitHub Actions for testing, linting, Docker publishing, deployment, and e2e testing

## Quick Start

```bash
# Clone and install
git clone https://github.com/synthtek/synthtek.git
cd synthtek
npm install
npm run build

# Configure (create .env or config.json)
cp .env.example .env  # edit with your API keys

# Run
npm start
```

## Supported Providers

| Provider | Models | Streaming | Cost Tracking |
|----------|--------|-----------|---------------|
| OpenAI | GPT-4, GPT-3.5 | ✅ | ✅ |
| Anthropic | Claude Sonnet/Opus/Haiku | ✅ | ✅ |
| OpenRouter | Multi-model routing | ✅ | ✅ |
| Azure | Azure OpenAI models | ✅ | ✅ |
| Gemini | Gemini models | ✅ | ✅ |
| Mistral | Mistral models | ✅ | ✅ |
| DeepSeek | DeepSeek models | ✅ | ✅ |
| vLLM | Local/vLLM models | ✅ | ✅ |
| Ollama | Local models | ✅ | — |
| LM Studio | Local models | ✅ | — |
| llama.cpp | Local models | ✅ | — |

## Supported Channels

| Channel | Messages | Threads | Media | Reactions | Tests |
|---------|----------|---------|-------|-----------|-------|
| Telegram | ✅ | ✅ | ✅ | ✅ | 40 |
| Discord | ✅ | ✅ | ✅ | ✅ | 29 |
| Slack | ✅ | ✅ | ✅ | ✅ | 55 |
| Matrix | ✅ | ✅ | ✅ | ✅ | 20 |
| Feishu | ✅ | ✅ | ✅ | ✅ | 20 |
| WhatsApp | ✅ | ✅ | ✅ | ✅ | 20 |
| QQ | ✅ | ✅ | ✅ | ✅ | 20 |
| WeCom | ✅ | ✅ | ✅ | ✅ | 20 |
| DingTalk | ✅ | ✅ | ✅ | ✅ | 20 |
| Email | ✅ | ✅ | ✅ | ✅ | 20 |
| Teams | ✅ | ✅ | ✅ | ✅ | 20 |
| WeChat | ✅ | ✅ | ✅ | ✅ | 20 |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Channels   │────▶│  Agent Loop  │────▶│  Providers  │
│ (Telegram,  │     │ (message →   │     │ (OpenAI,    │
│  Discord,   │     │  LLM → tools)│     │  Anthropic) │
│  Slack)     │     └──────────────┘     └─────────────┘
└─────────────┘          │
                         ▼
                  ┌──────────────┐
                   │   Memory &   │
                   │   Security   │
                   └──────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture docs.

## Development

```bash
npm run build      # Compile TypeScript
npm test           # Run all tests (1,012 passing, 0 failing, 3 skipped)
npm run dev        # Development mode with source maps
npm run lint       # Lint source code
npm run clean      # Remove dist/
```

## Documentation

- [Architecture](./ARCHITECTURE.md) — System design and data flow
- [Docker Guide](./DOCKER.md) — Docker setup and configuration
- [Backlog](./BACKLOG.md) — Development roadmap and completed items

## Project Stats

- **~28,000 lines** of source code
- **~19,200 lines** of tests
- **125 source files**, **75 test files**
- **1,012 tests passing** (100% green, 3 skipped)
- **61 internal API e2e test suites** passing (Playwright WebUI tests require Chromium)

## License

MIT
