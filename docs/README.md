# synthtek Documentation

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
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
# Development
npm run dev

# Production
npm start
```

## Architecture

### Core Components

```
src/
├── cli/              # CLI entry point and commands
├── logging/          # Structured logging system
│   ├── types.ts      # Type definitions
│   ├── rotation.ts   # Rotating file logger
│   ├── plugins.ts    # Per-plugin log isolation
│   └── index.ts      # Logging service
├── plugins/          # Plugin system
│   ├── registry.ts   # Plugin registry
│   ├── loader.ts     # Plugin loading
│   ├── resolver.ts   # Dependency resolution (topological sort)
│   └── validator.ts  # JSON Schema validation
├── providers/        # AI provider abstraction
│   ├── registry.ts   # Provider registry
│   ├── openai.ts     # OpenAI provider
│   ├── anthropic.ts  # Anthropic provider
│   ├── openrouter.ts # OpenRouter provider
│   ├── ollama.ts     # Ollama provider
│   ├── lmstudio.ts   # LM Studio provider
│   └── llama.cpp.ts  # llama.cpp provider
├── agents/           # Agent loop
│   ├── loop.ts       # Main agent loop
│   ├── stream.ts     # Message streaming
│   ├── retry.ts      # Exponential backoff retry
│   ├── circuit.ts    # Circuit breaker
│   └── formatter.ts  # Response formatting
└── tools/            # Tool system
    ├── registry.ts   # Tool registry
    └── executor.ts   # Tool execution
```

### Logging

The logging system provides structured output with file rotation and plugin isolation.

```typescript
import { LoggingServiceImpl } from './src/logging/index.js';

const logging = new LoggingServiceImpl({
  logDir: '/var/log/synthtek',
  serviceName: 'my-service',
  level: 'debug',
  enableFileLogging: true,
});

// Get a logger for a specific service
const logger = logging.getLogger('my-service');
logger.info('Service started');

// Get a plugin-specific logger (isolated log file)
const pluginLogger = logging.getLogger('my-service', 'my-plugin');
pluginLogger.error('Plugin error', { error: 'timeout' });

await logging.close();
```

#### Log Levels

| Level  | Description                    |
|--------|--------------------------------|
| debug  | Detailed debugging information |
| info   | General operational messages   |
| warn   | Warning conditions             |
| error  | Error conditions               |

#### File Rotation

- **Default max file size:** 10MB
- **Default max files:** 5
- **Compression:** gzip (enabled by default)
- **Naming:** `{service}-{YYYY}-{MM}-{DD}.log`

### Plugin System

Plugins are loaded in dependency order using topological sort (Kahn's algorithm).

```typescript
import { PluginRegistry } from './src/plugins/registry.js';

const registry = new PluginRegistry();

// Register a plugin
registry.register({
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['auth-plugin'],
  load: async () => { /* ... */ },
});

// Load all plugins in dependency order
await registry.loadAll();
```

### Provider Abstraction

All AI providers implement a common interface:

```typescript
interface AIProvider {
  generate(messages: Message[]): Promise<Generation>;
  stream(messages: Message[]): AsyncIterable<StreamChunk>;
  getCost(): CostInfo;
}
```

Supported providers:
- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude)
- OpenRouter (multi-model)
- Ollama (local models)
- LM Studio (local models)
- llama.cpp (local models)

### Agent Loop

The agent loop handles the core agent behavior:

```typescript
import { AgentLoop } from './src/agents/loop.js';

const loop = new AgentLoop({
  provider: openaiProvider,
  tools: toolRegistry,
  maxTurns: 10,
  retry: {
    maxRetries: 3,
    backoff: 'exponential',
  },
  circuitBreaker: {
    threshold: 5,
    timeout: 30000,
  },
});

const result = await loop.run({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Configuration

### Environment Variables

| Variable              | Description                    | Default              |
|-----------------------|--------------------------------|----------------------|
| SYNTHTEK_LOG_DIR      | Log directory path             | `/tmp/logs/synthtek` |
| SYNTHTEK_LOG_LEVEL    | Log level (debug/info/warn/error) | `info`          |
| SYNTHTEK_WORKSPACE    | Workspace directory            | `~/.synthtek`        |
| OPENAI_API_KEY        | OpenAI API key                 | —                    |
| ANTHROPIC_API_KEY     | Anthropic API key              | —                    |
| OPENROUTER_API_KEY    | OpenRouter API key             | —                    |

### Plugin Configuration

Plugins can be configured via JSON Schema:

```json
{
  "my-plugin": {
    "enabled": true,
    "config": {
      "apiKey": "sk-..."
    }
  }
}
```

## Docker

### Development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Dockerfile

The Dockerfile uses a multi-stage build:
1. **Build stage:** Install dependencies, compile TypeScript
2. **Runtime stage:** Copy built artifacts, run as non-root user

### Health Check

```bash
docker exec <container> node -e "require('fs').existsSync('/app/dist/cli.js')"
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test dist/tests/logging/*.test.js

# Run with coverage
node --test --experimental-test-coverage dist/tests/**/*.test.js
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## License

MIT
