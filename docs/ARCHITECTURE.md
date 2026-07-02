# Architecture

## Overview

synthtek is a modular AI agent framework designed around five core pillars:

1. **Agent Loop** — Message ingestion, LLM orchestration, tool dispatch, response formatting
2. **Plugin System** — Extensible architecture with dependency resolution and error boundaries
3. **Provider Abstraction** — Unified interface across all AI providers
4. **Channel Layer** — Platform-agnostic message handling (Telegram, Discord, Slack)
5. **Configuration & Logging** — Flexible config with hot-reload and structured logging

## Data Flow

```
User Message
    │
    ▼
┌─────────────┐
│  Channel    │  Parse platform-specific events → unified SlackMessage/TelegramMessage
│  Adapter    │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Agent      │  1. Add message to context window
│  Loop       │  2. Call LLM provider (with retry + circuit breaker)
│             │  3. Parse tool calls from response
│             │  4. Execute tools via Plugin System
│             │  5. Feed results back to LLM (up to maxToolCalls)
│             │  6. Format and send final response
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Channel    │  Format response for platform (blocks, embeds, markdown)
│  Adapter    │
└─────────────┘
```

## Source Structure

```
src/
├── agent/              # Agent loop, context, tools, subagents
│   ├── loop.ts         # Main message→LLM→tools→response cycle
│   ├── context.ts      # Token-aware context window management
│   ├── tools.ts        # Tool registry and execution
│   ├── error-handler.ts # Retry + circuit breaker state machine
│   ├── heartbeat.ts    # Keep-alive during long operations
│   ├── subagent.ts     # Parallel task spawning
│   ├── runner.ts       # Wires channels + sessions + providers
│   ├── session.ts      # Unified session interface
│   ├── response-formatter.ts # Markdown/json/plain/structured
│   ├── builtin-tools.ts # 8 built-in workspace tools
│   └── types.ts        # AgentMessage, ToolCall, AgentLoopConfig
├── channels/           # Channel adapters (14 total)
│   ├── telegram/       # Telegram Bot API (webhook + polling)
│   ├── discord/        # Discord.js (embeds, threads, reactions)
│   ├── slack/          # Slack Web API (blocks, threads)
│   ├── matrix/         # Matrix protocol
│   ├── email/          # IMAP/SMTP
│   ├── feishu/         # Feishu/Lark
│   ├── wecom/          # WeCom
│   ├── qq/             # QQ
│   ├── dingtalk/       # DingTalk
│   ├── whatsapp/       # WhatsApp
│   ├── teams/          # Microsoft Teams
│   ├── wechat/         # WeChat
│   ├── websocket/      # WebSocket channel
│   └── base-channel.ts # Shared base class
├── cli/                # CLI entry point (commander)
│   ├── cli.ts          # Root CLI with 15 commands
│   ├── cli-context.ts  # Lazy singletons
│   └── commands/       # Individual command implementations
├── config/             # Configuration system
│   ├── loader.ts       # JSON/YAML loading + env var merging
│   ├── schema.ts       # Config validation
│   ├── secrets.ts      # AES-256-GCM encryption for API keys
│   ├── hot-reload.ts   # File watcher for live config updates
│   └── multi-instance.ts
├── core/               # Core services + built-in tools
│   ├── cli-validation.ts  # CLI input validation
│   ├── config.ts       # Config service implementation
│   ├── executor.ts     # Shell command execution
│   ├── filesystem.ts   # File read/write
│   ├── logger.ts       # Structured logging (JSON, rotation, per-plugin)
│   ├── search.ts       # Glob + grep file search
│   └── types.ts        # Core type definitions
├── mcp/                # Model Context Protocol
│   ├── client.ts       # MCP client
│   ├── server.ts       # MCP server
│   ├── transport.ts    # Transport layer
│   └── built-in-tools.ts
├── media/              # Media processing
│   ├── processor.ts    # Image/audio/video/document handling
│   └── types.ts
├── memory/             # Memory system
│   ├── entity-extractor.ts # Entity extraction
│   ├── knowledge-graph.ts  # Knowledge graph
│   ├── long-term.ts    # Persistent memory
│   ├── short-term.ts   # Context window memory
│   ├── schema-manager.ts
│   └── skills/         # Memory maintenance skills
├── messaging/          # Message routing
│   ├── chat-service.ts # Unified chat pipeline
│   ├── conversation-store.ts
│   └── types.ts
├── performance/        # Performance optimizations
│   ├── cache.ts        # Response caching
│   ├── connection-pool.ts
│   ├── streaming.ts    # Streaming integration
│   └── parallel-executor.ts
├── plugins/            # Plugin system
│   ├── manager.ts      # Lifecycle orchestration + topological sort
│   ├── loader.ts       # Dynamic module loading
│   ├── discovery.ts    # Directory scanning
│   └── types.ts        # Plugin type definitions
├── providers/          # AI provider implementations (14 providers)
│   ├── openai/         # GPT-4, GPT-3.5
│   ├── anthropic/      # Claude
│   ├── openrouter/     # Multi-model routing
│   ├── ollama/         # Local models
│   ├── lmstudio/       # Local models
│   ├── llamacpp/       # Local models
│   ├── deepseek/       # DeepSeek
│   ├── gemini/         # Google Gemini
│   ├── mistral/        # Mistral AI
│   ├── azure/          # Azure OpenAI
│   ├── vllm/           # vLLM
│   ├── qwen/           # Qwen
│   ├── multimodal/     # Multimodal input
│   ├── registry.ts     # Provider registry
│   ├── fallback.ts     # Multi-provider fallback
│   └── types.ts        # Unified provider interface
├── security/           # Security module
│   ├── encryption.ts   # AES-256-GCM + scrypt
│   ├── rate-limiter.ts # Token bucket
│   ├── access-control.ts # RBAC
│   ├── sandbox.ts      # Command sandboxing
│   └── sanitizer.ts    # Input sanitization
├── skills/             # Skill system
│   ├── built-in/       # Built-in skill registry
│   └── injector.ts     # LangChain/exec/HTTP tool injection
├── webui/              # Web management UI
│   ├── server.ts       # HTTP server
│   ├── backend.ts      # Business logic
│   ├── auth.ts         # API key auth
│   ├── frontend.html   # Single-page frontend
│   └── ...handlers     # Chat, provider, skill routes
```

> **Full architecture reference:** See [ARCHITECTURE.md](/ARCHITECTURE.md) at the project root.

## Core Modules

### Agent Loop (`src/agent/loop.ts`)

The heart of synthtek. Handles the complete request-response cycle:

- **Context Management** — Token-aware window with trim/summarize/hybrid compaction
- **LLM Orchestration** — Streaming + non-streaming, multi-provider fallback
- **Tool Dispatch** — Native `toolCalls` parsing (no regex), up to 20 tool calls per turn
- **Retry Logic** — Exponential backoff (default: 3 retries, 1s→30s, 2x multiplier)
- **Circuit Breaker** — Opens after 5 failures, recovers after 60s timeout
- **Response Formatting** — Markdown, JSON, plain text, structured output

### Plugin System (`src/plugins/`)

Extensible architecture with safety guarantees:

- **Discovery** — Scans directories for plugin manifests
- **Dependency Resolution** — Topological sort using Kahn's algorithm
- **Error Boundaries** — Plugin crashes are isolated; one failure doesn't kill the agent
- **Config Validation** — JSON Schema draft-07 for plugin configuration
- **Lifecycle** — `init → start → stop → teardown` with hooks

### Provider Abstraction (`src/providers/`)

Unified interface so all providers work identically:

```typescript
interface AIProvider {
  generate(messages: ProviderMessage[]): Promise<ChatCompletion>;
  stream(messages: ProviderMessage[]): AsyncIterable<StreamChunk>;
  getCost(): CostInfo;
}
```

Supported: OpenAI, Anthropic, OpenRouter, Azure, Gemini, Mistral, DeepSeek, Qwen, vLLM, Ollama, LM Studio, llama.cpp.

### Configuration (`src/config/`)

Flexible multi-source configuration:

- JSON/YAML config files
- Environment variable overrides (`SYNTHTEK_*` prefix)
- Secret resolution with uppercase-safe regex
- Hot-reload via file watcher
- Multi-instance support

### Logging (`src/core/logger.ts`)

Structured logging with isolation — implemented in the core module:

- JSON format output via `SimpleLogger`
- 4 levels: debug, info, warn, error
- File rotation (10MB max, 5 files, gzip compression)
- Per-plugin log file isolation via `PluginLoggerManager`

## Extension Points

- **New Provider** — Implement `AIProvider` interface, register in `registry.ts`
- **New Channel** — Implement channel adapter, parse events to unified message format
- **New Plugin** — Create manifest + lifecycle methods, declare dependencies
- **New Tool** — Register in `ToolRegistry`, implement execute method
