# synthtek

A modular, plugin-based AI agent framework built with Node.js and TypeScript.

[![Tests](https://img.shields.io/badge/tests-304%20passing-brightgreen)](https://github.com/synthtek/synthtek)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Features

- **Plugin System** — Topological dependency resolution, error boundaries, JSON Schema validation
- **Multi-Provider** — OpenAI, Anthropic, OpenRouter, Ollama, LM Studio, llama.cpp with unified interface
- **Channel Integrations** — Telegram, Discord, Slack with full feature parity
- **Agent Loop** — Streaming responses, tool calls, exponential backoff, circuit breaker, subagent spawning
- **Configuration** — JSON/YAML files, env var overrides, secret management, hot-reload
- **Logging** — Structured JSON output, file rotation, per-plugin isolation
- **Docker Ready** — Multi-stage build, Compose profiles for dev/prod
- **CI/CD** — GitHub Actions for testing, Docker publishing, automated releases

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
                  │   Plugins    │
                  │ (tools,      │
                  │  hooks)      │
                  └──────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture docs.

## Development

```bash
npm run build      # Compile TypeScript
npm test           # Run all 304 tests
npm run dev        # Development mode with source maps
npm run lint       # Lint source code
npm run clean      # Remove dist/
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [Plugin Development](docs/PLUGIN-DEVELOPMENT.md) — How to write plugins
- [Configuration](docs/CONFIGURATION.md) — Full config reference
- [Deployment](docs/DEPLOYMENT.md) — Docker, systemd, CI/CD

## Project Stats

- **~31,000 lines** of source code
- **~20,200 lines** of tests
- **174 source files**, **87 test files**
- **100% tests passing** (all green)

## License

MIT
