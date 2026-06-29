# synthtek Documentation

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0

### Installation

```bash
git clone https://github.com/your-org/synthtek.git
cd synthtek
npm install
npm run build
```

### Running

```bash
# Development (with source maps)
npm run dev

# Production (compiled)
npm start

# WebUI server
npx synthtek webui
```

## Architecture

### Core Components

```
src/
├── agent/            # Agent loop, context, tools, subagents
├── channels/         # 14 channel adapters (Telegram, Discord, Slack, etc.)
├── cli/              # CLI entry point and commands
├── config/           # Configuration system (loader, schema, secrets, hot-reload)
├── core/             # Core services (logger, executor, filesystem, search)
├── mcp/              # MCP protocol support (client, server, transport)
├── media/            # Media processing (image/audio/video/document)
├── memory/           # Memory system (entity extraction, knowledge graph, skills)
├── messaging/        # Message routing (ChatService, ConversationStore)
├── performance/      # Performance optimizations (cache, streaming, pooling)
├── plugins/          # Plugin system (manager, loader, discovery)
├── providers/        # 12 AI provider implementations
├── security/         # Security (encryption, rate limiting, sandbox, access control)
├── skills/           # Built-in skill registry
└── webui/            # Web management UI (backend + frontend)
```

### Data Flow

```
User Message → Channel Adapter → Agent Loop → LLM Provider
                                              → Tool Execution
                                              → Response Formatting
                                  → Channel Adapter → User
```

## Documentation

- [Architecture](ARCHITECTURE.md) — Detailed system design
- [Plugin Development](PLUGIN-DEVELOPMENT.md) — Writing plugins
- [Configuration](CONFIGURATION.md) — Full config reference
- [Deployment](DEPLOYMENT.md) — Docker, CI/CD, production
