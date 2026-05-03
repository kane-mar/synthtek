# Plugin Development Guide

## What Is a Plugin?

A plugin in synthtek is a self-contained module that extends agent capabilities. Plugins follow a strict lifecycle, declare dependencies, validate configuration via JSON Schema, and run in isolated error boundaries.

## Plugin Manifest

Every plugin starts with a manifest defining metadata, dependencies, and config schema:

```typescript
interface PluginManifest {
  name: string;                       // Unique identifier
  version: string;                    // Semver
  description?: string;
  author?: string;
  requires?: string[];               // Dependency names (loaded first)
  configSchema?: Record<string, unknown>;  // JSON Schema draft-07
  main?: string;                     // Entry point (relative to plugin root)
}
```

## Plugin Lifecycle

```
discover → load → init → start → [running] → stop → teardown
```

| Phase | Description |
|-------|-------------|
| **Discover** | Scanner finds plugin manifests in configured directories |
| **Load** | Dynamic `import()` of the entry module |
| **Init** | Plugin receives `PluginContext` (config, logger, events) |
| **Start** | Plugin activates, registers tools/hooks |
| **Running** | Plugin handles events and tool calls |
| **Stop** | Graceful shutdown, cleanup resources |
| **Teardown** | Final cleanup, unregister everything |

## PluginContext API

Every plugin receives a `PluginContext` on init:

```typescript
interface PluginContext {
  config: Record<string, unknown>;    // Validated plugin config
  logger: Logger;                     // Structured logger (isolated file)
  emit: (event: string, data: unknown) => void;   // Publish event
  on: (event: string, handler: (data: unknown) => void) => void;  // Subscribe
  events: EventEmitter;               // Plugin-specific emitter
}
```

## Step-by-Step: Your First Plugin

### 1. Create Directory Structure

```
my-plugin/
├── package.json
├── manifest.json
└── index.ts
```

### 2. Write the Manifest

```json
{
  "name": "weather-plugin",
  "version": "1.0.0",
  "description": "Fetches weather data",
  "requires": [],
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" },
      "units": { "type": "string", "enum": ["metric", "imperial"] }
    },
    "required": ["apiKey"]
  },
  "main": "dist/index.js"
}
```

### 3. Implement the Plugin

```typescript
import { Plugin, PluginContext } from 'synthtek/plugins';

export class WeatherPlugin implements Plugin {
  private context: PluginContext;
  private apiKey: string;

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    this.apiKey = context.config.apiKey as string;
    this.context.logger.info('Weather plugin initialized');
  }

  async start(): Promise<void> {
    // Register tools, event handlers, etc.
    this.context.logger.info('Weather plugin started');
  }

  async stop(): Promise<void> {
    // Cleanup resources
    this.context.logger.info('Weather plugin stopped');
  }
}
```

### 4. Configure in synthtek

```json
{
  "plugins": [
    {
      "name": "weather-plugin",
      "enabled": true,
      "config": {
        "apiKey": "your-api-key",
        "units": "metric"
      }
    }
  ]
}
```

## Dependency Resolution

Plugins declare dependencies via `requires`. synthtek loads them in topological order using Kahn's algorithm:

```json
{
  "name": "advanced-analytics",
  "requires": ["data-fetcher", "cache-plugin"]
}
```

If `data-fetcher` requires `auth-plugin`, the load order is:
`auth-plugin → data-fetcher → cache-plugin → advanced-analytics`

Circular dependencies are detected and rejected at load time.

## Config Schema Validation

Plugin configs are validated against JSON Schema draft-07 before `init()` is called. Invalid configs prevent the plugin from starting:

```json
{
  "configSchema": {
    "type": "object",
    "properties": {
      "timeout": { "type": "number", "minimum": 100, "maximum": 30000 },
      "retries": { "type": "integer", "minimum": 0, "maximum": 10 },
      "endpoints": {
        "type": "array",
        "items": { "type": "string", "format": "uri" }
      }
    },
    "required": ["timeout"]
  }
}
```

## Event System

Plugins communicate through the global event bus:

```typescript
// Publishing
this.context.emit('weather.updated', { city: 'London', temp: 15 });

// Subscribing
this.context.on('agent.message.received', (data) => {
  this.context.logger.debug('New message received', data);
});
```

Common events:
- `agent.message.received` — New user message
- `agent.message.sent` — Response sent
- `agent.tool.executed` — Tool call completed
- `agent.error` — Error occurred in agent loop

## Error Handling

Plugins run in isolated error boundaries. A crash in one plugin doesn't affect others:

```typescript
try {
  await plugin.init(context);
  await plugin.start();
} catch (err) {
  this.logger.error(`Plugin ${name} failed: ${err.message}`);
  this.state.set(name, { status: 'error', error: err.message });
  // Other plugins continue normally
}
```

## Testing Plugins

Use Node's built-in test runner:

```typescript
import { describe, it, beforeEach } from 'node:test';
import { equal, ok } from 'node:assert';
import { WeatherPlugin } from '../src/plugins/weather-plugin.js';

describe('WeatherPlugin', () => {
  let plugin: WeatherPlugin;

  beforeEach(() => {
    plugin = new WeatherPlugin();
  });

  it('initializes with valid config', async () => {
    await plugin.init({
      config: { apiKey: 'test-key', units: 'metric' },
      logger: console,
      emit: () => {},
      on: () => {},
      events: new (require('node:events').EventEmitter)(),
    });
    ok(true, 'Plugin initialized without error');
  });
});
```

## Packaging & Distribution

```json
{
  "name": "@my-org/weather-plugin",
  "synthtek-plugin": true,
  "files": ["dist/", "manifest.json"],
  "scripts": {
    "build": "tsc"
  }
}
```

Install via npm, then point synthtek's plugin discovery at the installed package directory.
