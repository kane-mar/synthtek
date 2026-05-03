# Release Notes

## synthtek v0.2.0 — Logging Module & Docker Compose

**Release Date:** 2026-04-22

### Overview

This release adds a production-ready logging system and Docker Compose configuration for synthtek.

### New Features

#### Logging Module (`src/logging/`)

A complete structured logging system with file rotation, plugin isolation, and console output:

```typescript
import { LoggingServiceImpl } from './src/logging/index.js';

const logging = new LoggingServiceImpl({
  logDir: '/var/log/synthtek',
  serviceName: 'my-service',
  level: 'debug',
  enableFileLogging: true,
});

const logger = logging.getLogger('my-service', 'my-plugin');
logger.info('Service started', { version: '0.2.0' });
logger.error('Connection failed', { url: 'http://api.example.com' });

await logging.close();
```

**Components:**
- **RotatingFileLogger** — Automatic file rotation by size (default 10MB), gzip compression, configurable retention (default 5 files)
- **PluginLoggerManager** — Per-plugin log isolation with separate log files
- **LoggingServiceImpl** — Composite service combining console + file output
- **ConsoleLogger** — ANSI-colored output with JSON/text format support

**Log format (JSON):**
```json
{
  "timestamp": "2026-04-22T13:00:00.000Z",
  "level": "info",
  "message": "Service started",
  "service": "my-service",
  "plugin": "my-plugin",
  "meta": { "version": "0.2.0" }
}
```

#### Docker Compose

Three compose files for different environments:

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

**Features:**
- Non-root user (`synthtek`)
- Health checks
- Resource limits (512MB RAM, 1 CPU)
- Log rotation in production
- Hot-reload in development

### Test Results

- **184 tests passing** (100%)
- 12 new logging tests
- 0 failures

### Migration Notes

- No breaking changes from v0.1.0
- The `api/` directory was removed in a previous release
- Project renamed from `nanobot-js` to `synthtek`

### Dependencies

- Node.js >= 18.0.0
- TypeScript >= 5.0
- `dotenv`, `glob`

### Known Issues

- None

### Contributors

- nanobot 🐈
