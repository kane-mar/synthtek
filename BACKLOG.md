# Synthtek Backlog — Ranked by Criticality

> Generated 2026-04-30. ~131 source files across 6 tiers.
> Tiers 1–2 = operating system. Tiers 3–4 = drivers. Tiers 5–6 = apps.

---

## Tier 1 — Foundation (System Won't Boot Without These)

### Core — the kernel

| # | File | Role | Status |
|---|------|------|--------|
| 1  | `src/core/types.ts`       | Core type definitions          | ✅ Done |
| 2  | `src/core/config.ts`      | Core config                    | ✅ Done |
| 3  | `src/core/logger.ts`      | Logger implementation          | ✅ Done |
| 4  | `src/core/filesystem.ts`  | Async filesystem ops           | ✅ Done |
| 5  | `src/core/executor.ts`    | Command executor               | ✅ Done |
| 6  | `src/core/search.ts`      | File/content search            | ✅ Done |
| 7  | `src/core/messenger.ts`   | Messaging                      | ✅ Done |
| 8  | `src/core/spawner.ts`     | Sub-agent spawner              | ✅ Done |

### Config — boot parameters

| # | File | Role | Status |
|---|------|------|--------|
| 9  | `src/config/types.ts`         | Config types                  | ✅ Done |
| 10 | `src/config/loader.ts`        | Config loading + env merging  | ✅ Done |
| 11 | `src/config/secrets.ts`       | Secret resolution             | ✅ Done |
| 12 | `src/config/schema.ts`        | JSON Schema validation        | ✅ Done |
| 13 | `src/config/hot-reload.ts`    | Hot-reload                    | ✅ Done |
| 14 | `src/config/multi-instance.ts`| Multi-instance                | ✅ Done |

### Logging — system journal

| # | File | Role | Status |
|---|------|------|--------|
| 15 | `src/logging/types.ts`   | Logging types       | ✅ Done |
| 16 | `src/logging/index.ts`   | Logger service      | ✅ Done |
| 17 | `src/logging/plugins.ts` | Per-plugin logger   | ✅ Done |
| 18 | `src/logging/rotation.ts`| Log rotation        | ✅ Done |

### Plugins — module loader

| # | File | Role | Status |
|---|------|------|--------|
| 19 | `src/plugins/types.ts`    | Plugin types          | ✅ Done |
| 20 | `src/plugins/loader.ts`   | Plugin loading        | ✅ Done |
| 21 | `src/plugins/manager.ts`  | Plugin lifecycle      | ✅ Done |
| 22 | `src/plugins/discovery.ts`| Plugin discovery      | ✅ Done |
| 23 | `src/plugins/index.ts`    | Re-exports            | ✅ Done |

**Tier 1 subtotal: 23 files — all completed.**

---

## Tier 2 — Agent Brain (The Actual AI)

### Agent — the thinking engine

| # | File | Role | Status |
|---|------|------|--------|
| 24 | `src/agent/types.ts`      | Agent types                | ✅ Done |
| 25 | `src/agent/loop.ts`       | Agent loop + retry + circuit breaker | ✅ Done |
| 26 | `src/agent/runner.ts`     | Agent runner               | ✅ Done |
| 27 | `src/agent/context.ts`    | Context management         | ✅ Done |
| 28 | `src/agent/tools.ts`      | Tool definitions           | ✅ Done |
| 29 | `src/agent/heartbeat.ts`  | Heartbeat tasks            | ✅ Done |
| 30 | `src/agent/subagent.ts`   | Sub-agent orchestration    | ✅ Done |
| 31 | `src/agent/index.ts`      | Re-exports                 | ✅ Done |

### Memory — persistent cognition

| # | File | Role | Status |
|---|------|------|--------|
| 32 | `src/memory/types.ts`             | Memory types              | ✅ Done |
| 33 | `src/memory/manager.ts`           | Memory manager            | ✅ Done |
| 34 | `src/memory/long-term.ts`         | Long-term memory          | ✅ Done |
| 35 | `src/memory/short-term.ts`        | Short-term memory         | ✅ Done |
| 36 | `src/memory/entity-extractor.ts`  | Entity extraction         | ✅ Done |
| 37 | `src/memory/knowledge-graph.ts`   | Knowledge graph           | ✅ Done |
| 38 | `src/memory/schema-manager.ts`    | Schema management         | ✅ Done |
| 39 | `src/memory/integration.ts`       | Memory integration        | ✅ Done |
| 40 | `src/memory/index.ts`             | Re-exports                | ✅ Done |
| 41 | `src/memory/skills/types.ts`      | Memory skill types        | ✅ Done |
| 42 | `src/memory/skills/reflect.ts`    | Reflection                | ✅ Done |
| 43 | `src/memory/skills/defrag.ts`     | Defragmentation           | ✅ Done |
| 44 | `src/memory/skills/ingest.ts`     | Ingestion                 | ✅ Done |
| 45 | `src/memory/skills/tasks.ts`      | Task memory               | ✅ Done |
| 46 | `src/memory/skills/notes.ts`      | Note memory               | ✅ Done |
| 47 | `src/memory/skills/metadata-search.ts` | Metadata search       | ✅ Done |
| 48 | `src/memory/skills/lifecycle.ts`  | Lifecycle                 | ✅ Done |
| 49 | `src/memory/skills/index.ts`      | Re-exports                | ✅ Done |

### Providers — the LLM connections

| # | File | Role | Status |
|---|------|------|--------|
| 50 | `src/providers/types.ts`              | Provider types            | ✅ Done |
| 51 | `src/providers/registry.ts`           | Provider registry         | ✅ Done |
| 52 | `src/providers/fallback.ts`           | Fallback/chaining         | ✅ Done |
| 53 | `src/providers/base-provider.ts`      | Base provider + config validation + SSE parsing | ✅ Done |
| 54 | `src/providers/openai/provider.ts`    | OpenAI                    | ✅ Done |
| 55 | `src/providers/anthropic/provider.ts` | Anthropic                 | ✅ Done |
| 56 | `src/providers/openrouter/provider.ts`| OpenRouter                | ✅ Done |
| 57 | `src/providers/ollama/provider.ts`    | Ollama                    | ✅ Done |
| 58 | `src/providers/lmstudio/provider.ts`  | LM Studio                 | ✅ Done |
| 59 | `src/providers/llamacpp/provider.ts`  | llama.cpp                 | ✅ Done |
| 60 | `src/providers/gemini/provider.ts`    | Google Gemini             | 🔲 Future |
| 61 | `src/providers/azure/provider.ts`     | Azure OpenAI              | 🔲 Future |
| 62 | `src/providers/mistral/provider.ts`   | Mistral                   | 🔲 Future |
| 63 | `src/providers/deepseek/provider.ts`  | DeepSeek                  | 🔲 Future |
| 64 | `src/providers/vllm/provider.ts`      | vLLM                      | 🔲 Future |
| 65 | `src/providers/cache/prompt-cache.ts` | Prompt caching            | 🔲 Future |
| 66 | `src/providers/multimodal/input.ts`   | Multimodal input          | 🔲 Future |
| 67 | `src/providers/multimodal/index.ts`   | Multimodal re-exports     | 🔲 Future |

### Performance — keeps it fast

| # | File | Role | Status |
|---|------|------|--------|
| 67 | `src/performance/types.ts`          | Performance types     | ✅ Done |
| 68 | `src/performance/cache.ts`          | Caching               | ✅ Done |
| 69 | `src/performance/context-manager.ts`| Context window mgmt   | ✅ Done |
| 70 | `src/performance/parallel-executor.ts` | Parallel execution | ✅ Done |
| 71 | `src/performance/streaming.ts`      | Streaming             | ✅ Done |
| 72 | `src/performance/connection-pool.ts`| Connection pooling    | ✅ Done |
| 73 | `src/performance/index.ts`          | Re-exports            | ✅ Done |

**Tier 2 subtotal: 50 files — core done, 9 future providers/enhancements.**

---

## Tier 3 — Security & Safety

| # | File | Role | Status |
|---|------|------|--------|
| 74 | `src/security/types.ts`       | Security types          | ✅ Done |
| 75 | `src/security/encryption.ts`  | AES-256-GCM + scrypt    | ✅ Done |
| 76 | `src/security/rate-limiter.ts`| Rate limiting           | ✅ Done |
| 77 | `src/security/sandbox.ts`     | Execution sandbox       | ✅ Done |
| 78 | `src/security/access-control.ts` | Access control       | ✅ Done |
| 79 | `src/security/sanitizer.ts`   | Input sanitization      | ✅ Done |
| 80 | `src/security/manager.ts`     | Security manager        | ✅ Done |
| 81 | `src/security/index.ts`       | Re-exports              | ✅ Done |

**Tier 3 subtotal: 8 files — all completed.**

---

## Tier 4 — Communication Channels

### Medium Criticality (Popular)

| # | Channel | Files | Status |
|---|---------|-------|--------|
| 82 | Discord  | `channels/discord/types.ts`, `channels/discord/channel.ts` | ✅ Done |
| 83 | Telegram | `channels/telegram/types.ts`, `channels/telegram/channel.ts` | ✅ Done |
| 84 | Slack    | `channels/slack/types.ts`, `channels/slack/channel.ts` | ✅ Done |
| 85 | WebSocket| `channels/websocket/types.ts`, `channels/websocket/channel.ts`, `channels/websocket/index.ts` | ✅ Done |

### Low Criticality (Regional / Niche)

| # | Channel  | Files | Status |
|---|----------|-------|--------|
| 86 | Matrix   | `channels/matrix/types.ts`, `channels/matrix/channel.ts` | ✅ Done |
| 87 | Feishu   | `channels/feishu/types.ts`, `channels/feishu/channel.ts` | ✅ Done |
| 88 | WhatsApp | `channels/whatsapp/types.ts`, `channels/whatsapp/channel.ts` | ✅ Done |
| 89 | QQ       | `channels/qq/types.ts`, `channels/qq/channel.ts` | ✅ Done |
| 90 | WeCom    | `channels/wecom/types.ts`, `channels/wecom/channel.ts` | ✅ Done |
| 91 | DingTalk | `channels/dingtalk/types.ts`, `channels/dingtalk/channel.ts` | ✅ Done |
| 92 | Email    | `channels/email/types.ts`, `channels/email/channel.ts` | ✅ Done |
| 93 | Teams    | `channels/teams/types.ts`, `channels/teams/channel.ts` | ✅ Done |
| 94 | WeChat   | `channels/wechat/types.ts`, `channels/wechat/channel.ts`, `channels/wechat/index.ts` | ✅ Done |

**Tier 4 subtotal: ~30 files across 13 channels — all completed.**

---

## Tier 5 — Extended Capabilities

### MCP — tool protocol

| # | File | Role | Status |
|---|------|------|--------|
| 95 | `src/mcp/types.ts`         | MCP types            | ✅ Done |
| 96 | `src/mcp/client.ts`        | MCP client           | ✅ Done |
| 97 | `src/mcp/client-types.ts`  | Client types         | ✅ Done |
| 98 | `src/mcp/server.ts`        | MCP server           | ✅ Done |
| 99 | `src/mcp/transport.ts`     | Transport            | ✅ Done |
| 100| `src/mcp/runner.ts`        | Runner               | ✅ Done |
| 101| `src/mcp/built-in-tools.ts`| Built-in tools       | ✅ Done |

### WebUI — browser interface

| # | File | Role | Status |
|---|------|------|--------|
| 102| `src/webui/types.ts`                    | WebUI types           | ✅ Done |
| 103| `src/webui/backend.ts`                  | REST + WebSocket backend | ✅ Done |
| 104| `src/webui/index.ts`                    | Re-exports            | ✅ Done |
| 105| `src/webui/frontend/types.ts`           | Frontend types        | ✅ Done |
| 106| `src/webui/frontend/app.ts`             | App shell             | ✅ Done |
| 107| `src/webui/frontend/chat.ts`            | Chat component        | ✅ Done |
| 108| `src/webui/frontend/dashboard.ts`       | Dashboard             | ✅ Done |
| 109| `src/webui/frontend/plugin-manager.ts`  | Plugin manager        | ✅ Done |
| 110| `src/webui/frontend/config-editor.ts`   | Config editor         | ✅ Done |
| 111| `src/webui/frontend/session-manager.ts` | Session manager       | ✅ Done |
| 112| `src/webui/frontend/media-preview.ts`   | Media preview         | ✅ Done |

### Media — file processing

| # | File | Role | Status |
|---|------|------|--------|
| 113| `src/media/types.ts`     | Media types      | ✅ Done |
| 114| `src/media/processor.ts` | Media processor  | ✅ Done |
| 115| `src/media/index.ts`     | Re-exports       | ✅ Done |

### Linux Service — systemd integration

| # | File | Role | Status |
|---|------|------|--------|
| 116| `src/linux-service/types.ts`         | Service types     | ✅ Done |
| 117| `src/linux-service/service-manager.ts`| Systemd manager  | ✅ Done |
| 118| `src/linux-service/index.ts`         | Re-exports       | ✅ Done |

### Built-in Skills — internal skill registry

| # | File | Role | Status |
|---|------|------|--------|
| 119| `src/skills/built-in/types.ts`  | Skill types   | ✅ Done |
| 120| `src/skills/built-in/registry.ts`| Registry     | ✅ Done |
| 121| `src/skills/built-in/index.ts`  | Re-exports    | ✅ Done |

**Tier 5 subtotal: ~24 files — all completed.**

---

## Tier 6 — Optional / Future

### UX Polish

| # | File | Role | Status |
|---|------|------|--------|
| 122| `src/ux/types.ts`       | UX types        | 🔲 Future |
| 123| `src/ux/polish.ts`      | Cosmetic polish | 🔲 Future |
| 124| `src/ux/index.ts`       | Re-exports      | 🔲 Future |

### ClawHub — external hub

| # | File | Role | Status |
|---|------|------|--------|
| 125| `src/clawhub/types.ts`  | Hub types       | 🔲 Future |
| 126| `src/clawhub/client.ts` | Hub client      | 🔲 Future |
| 127| `src/clawhub/index.ts`  | Re-exports      | 🔲 Future |

### Experimental — unstable features

| # | File | Role | Status |
|---|------|------|--------|
| 128| `src/experimental/types.ts` | Experimental types | 🔲 Future |
| 129| `src/experimental/engine.ts`| Experimental engine| 🔲 Future |
| 130| `src/experimental/index.ts` | Re-exports       | 🔲 Future |

### API — OpenAI compat server

| # | File | Role | Status |
|---|------|------|--------|
| 131| `src/api/openai/types.ts` | OpenAI API types  | 🔲 Future |
| 132| `src/api/openai/server.ts`| OpenAI API server | 🔲 Future |
| 133| `src/api/openai/index.ts` | Re-exports       | 🔲 Future |

### Observability — tracing/debugging

| # | File | Role | Status |
|---|------|------|--------|
| 134| `src/observability/types.ts`   | Observability types | 🔲 Future |
| 135| `src/observability/langsmith.ts`| LangSmith tracing  | 🔲 Future |
| 136| `src/observability/langfuse.ts` | LangFuse tracing   | 🔲 Future |
| 137| `src/observability/index.ts`    | Re-exports        | 🔲 Future |

### CLI — entry point

| # | File | Role | Status |
|---|------|------|--------|
| 138| `src/cli.ts` | CLI entry point | ✅ Done |

**Tier 6 subtotal: ~14 files — mostly future work, CLI entry point done.**

---

## Summary

| Tier | Module | Files | Done | Future |
|------|--------|-------|------|--------|
| 1 | Foundation | 23 | 23 | 0 |
| 2 | Agent Brain | 50 | 41 | 9 |
| 3 | Security | 8 | 8 | 0 |
| 4 | Channels | ~30 | ~30 | 0 |
| 5 | Extended | ~24 | ~24 | 0 |
| 6 | Optional | ~14 | 1 | ~13 |
| **Total** | | **~131** | **~127** | **~22** |

### Remaining Future Items (Ranked)

1. **New Providers** — Gemini, Azure OpenAI, Mistral, DeepSeek, vLLM (Tier 2)
2. **Prompt Caching** — provider-level cache layer (Tier 2)
3. **Multimodal Input** — image/audio/video understanding (Tier 2)
4. **Observability** — LangSmith + LangFuse tracing (Tier 6)
5. **OpenAI Compat API** — serve as an OpenAI-compatible endpoint (Tier 6)
6. **UX Polish** — cosmetic improvements (Tier 6)
7. **ClawHub** — external skill hub integration (Tier 6)
8. **Experimental** — unstable feature incubator (Tier 6)

---

*Legend: ✅ Done | 🔲 Future | 🚧 In Progress*
