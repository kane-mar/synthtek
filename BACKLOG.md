# Backlog

WebUI implementation backlog (2026-05-07).

## Critical

- [x] **C1: Navigation Fix – Hash-based routing for header links** — Ensure `#chat`, `#dashboard`, `#plugins`, `#config`, `#sessions`, `#media` correctly route to their pages. Listen to `hashchange` events. Support browser back/forward. ✅ DONE (2026-05-07)
- [x] **C2: Auth Fix – Optional API key (open mode)** — When `SYNTHTEK_API_KEY` is not set, allow all requests without authentication. WebUI frontend does not send auth headers. ✅ DONE (2026-05-12)
- [x] **C3: Missing API routes** — Add `/api/chat/completions`, `/api/cron`, `/api/providers/presets` endpoints. ✅ DONE (2026-05-12)
- [x] **C4: Docker deployment** — Dockerfile, docker-compose.yml, and deployment instructions. ✅ DONE (2026-05-12)

## Important

- [x] **I1: Chat Page – Session selection UI** — Dropdown or list of available sessions. Persist last selected session across page loads (localStorage). ✅ DONE (2026-05-07)
- [x] **I2: Chat Page – Message input with Send button** — Text input field, send button, clear on send, disable while streaming. ✅ DONE (2026-05-07)
- [x] **I3: Chat Page – Real-time message handling** — WebSocket/polling integration, role-based message styling, display messages in chat container. ✅ DONE (2026-05-12)
- [x] **I4: Settings Page – Themes Section** — Light/Dark mode toggle, primary color picker, font-size adjustment, save to localStorage. ✅ DONE (2026-05-12)
- [x] **I5: Settings Page – LLM Configuration Section** — Provider selection dropdown, API key input with validation, model selector, temperature slider, save configuration. ✅ DONE (2026-05-12)
- [x] **I6: Settings Page – Channels Section** — List configured channels, "Add Channel" UI, edit/remove channel, display connection status and logs. ✅ DONE (2026-05-12)
- [x] **I7: Dashboard Page – Metrics Display** — Total active session count, provider health summary, resource usage metrics (CPU, memory, request rate). ✅ DONE (2026-05-12)
- [x] **I8: Dashboard Page – Quick-action buttons** — Start chat, view logs, manage providers. ✅ DONE (2026-05-12)

## Nice-to-have

- [x] **N1: Dashboard – Auto-refresh metrics** — Poll backend every N seconds for live data. ✅ DONE (2026-05-12)
- [x] **N2: Chat – Markdown rendering for assistant messages** — Render code blocks, bold, italic. ✅ DONE (2026-05-12)
- [x] **N3: Settings – Form validation feedback** — Inline error messages for invalid inputs. ✅ DONE (2026-05-12)

---

**E2E Test Fixes (2026-05-12)**

- [x] **E1: Sidebar e2e test suite** — 46 tests covering sidebar structure, click navigation, content rendering, sequential navigation, keyboard navigation, browser history, active state transitions, and edge cases. ✅ DONE (2026-05-12)
- [x] **E2: WebUI e2e test suite** — 88 tests covering layout, chat, themes, config, API endpoints, accessibility, and full workflow. ✅ DONE (2026-05-12)
- [x] **E3: Test fixes** — Fixed selector mismatches (`#chat-input` → `#msg-input`), theme element assertions, coming-soon placeholder content, removed invalid Space key test. ✅ DONE (2026-05-12)

---

**Frontend App Event Handlers (2026-05-12)**

- [x] **F1: FrontendApp – Theme toggle method** — `toggleTheme()` switches between light/dark modes with notification. ✅ DONE (2026-05-12)
- [x] **F2: FrontendApp – Event listener script generation** — `initEventListenersScript()` generates inline JavaScript for all button click handlers: navigation, theme toggle, auth, chat send, session select, plugin toggle, config save, notification dismiss, media remove, font size, color picker, clear sessions, Enter key. ✅ DONE (2026-05-12)
- [x] **F3: FrontendApp – Render integration** — Event listener script injected into rendered HTML after footer. ✅ DONE (2026-05-12)
- [x] **F4: FrontendApp – Tests** — 19 new tests for `toggleTheme` (3), `initEventListenersScript` (14), and render integration (2). Total: 55 tests in frontend-app.test.ts. ✅ DONE (2026-05-12)

---

**Future Enhancements**

- [x] **FE1: Analytics – Identify meaningful metrics and expand analytics page** — Audit the system to identify meaningful analytics data points (request volume, token usage, latency, error rates, provider costs, session activity, channel usage, plugin health). Design and implement an expanded analytics page in the WebUI with charts, filters, and time-range selectors. ✅ DONE (2026-06-01)

---

**Started: 2026-05-07.** Working one item at a time using TDD + clean code.
