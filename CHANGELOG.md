# Changelog

All notable changes to synthtek will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Logging module** (`src/logging/`): Complete structured logging system with:
  - `RotatingFileLogger` — file-based logger with automatic size-based rotation, compression, and retention
  - `PluginLoggerManager` — per-plugin log isolation with separate log files per plugin
  - `LoggingServiceImpl` — composite logging service combining console + file output
  - `ConsoleLogger` — ANSI-colored console output with JSON/text format support
  - `PluginLogger` — wrapper that injects plugin context into log entries
  - Full type definitions in `types.ts` (LogLevel, LogEntry, Logger interface, etc.)
  - 12 passing tests covering all components
- **Docker Compose** files for development and production:
  - `docker-compose.yml` — base configuration with health checks, resource limits, non-root user
  - `docker-compose.dev.yml` — development overrides with hot-reload volume mounts
  - `docker-compose.prod.yml` — production overrides with log rotation
- **Plugin system** completed:
  - Topological sort (Kahn's algorithm) for dependency resolution
  - Error boundaries for plugin isolation
  - JSON Schema validation for plugin configuration
  - 60/62 tests passing
- **Provider Abstraction Layer**:
  - OpenAI, Anthropic, OpenRouter, Ollama, LM Studio, llama.cpp providers
  - Streaming support with `processMessageStream`
  - Cost tracking across providers
  - MultiProvider error aggregation
- **Agent Loop**:
  - Native `toolCalls` (no regex parsing)
  - Exponential backoff retry
  - Circuit breaker state machine
  - Response formatting (markdown/json/plain/structured)
  - 84 tests passing
- **CI/CD**:
  - `ci.yml` — testing, linting
  - `docker.yml` — Docker publishing to GHCR
- **Dockerfile** — multi-stage build with non-root user, health check
- **TypeScript 5.x** with strict mode, ES2022 target, NodeNext module resolution
- **Node.js built-in test runner** (replaced Vitest)
- **Dependencies**: `dotenv`, `glob`

### Changed
- Renamed project from `nanobot-js` to **synthtek**
- Switched from Vitest to Node's built-in `node --test` runner
- Consolidated duplicate service implementations
- Resolved conflicting `AgentConfig` interfaces

### Removed
- `api/` directory (removed per user preference)

## [0.1.0] — 2026-04-20

### Added
- Initial project scaffolding
- Plugin system foundation
- Provider abstraction layer
- Agent loop core

---

## Version History

| Version | Date       | Notes                          |
|---------|------------|--------------------------------|
| 0.1.0   | 2026-04-20 | Initial release                |
| 0.2.0   | 2026-04-22 | Logging module, Docker Compose |
