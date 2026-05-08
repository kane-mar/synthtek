# Backlog

WebUI implementation backlog (2026-05-07).

## Critical

- [x] **C1: Navigation Fix – Hash-based routing for header links** — Ensure `#chat`, `#dashboard`, `#plugins`, `#config`, `#sessions`, `#media` correctly route to their pages. Listen to `hashchange` events. Support browser back/forward. ✅ DONE (2026-05-07)

## Important

- [x] **I1: Chat Page – Session selection UI** — Dropdown or list of available sessions. Persist last selected session across page loads (localStorage). ✅ DONE (2026-05-07)
- [x] **I2: Chat Page – Message input with Send button** — Text input field, send button, clear on send, disable while streaming. ✅ DONE (2026-05-07)
- [x] **I3: Chat Page – Real-time message handling** — WebSocket/polling integration, role-based message styling, display messages in chat container.
- [ ] **I4: Settings Page – Themes Section** — Light/Dark mode toggle, primary color picker, font-size adjustment, save to localStorage.
- [ ] **I5: Settings Page – LLM Configuration Section** — Provider selection dropdown, API key input with validation, model selector, temperature slider, save configuration.
- [ ] **I6: Settings Page – Channels Section** — List configured channels, "Add Channel" UI, edit/remove channel, display connection status and logs.
- [ ] **I7: Dashboard Page – Metrics Display** — Total active session count, provider health summary, resource usage metrics (CPU, memory, request rate).
- [ ] **I8: Dashboard Page – Quick-action buttons** — Start chat, view logs, manage providers.

## Nice-to-have

- [ ] **N1: Dashboard – Auto-refresh metrics** — Poll backend every N seconds for live data.
- [ ] **N2: Chat – Markdown rendering for assistant messages** — Render code blocks, bold, italic.
- [ ] **N3: Settings – Form validation feedback** — Inline error messages for invalid inputs.

---

**Started: 2026-05-07.** Working one item at a time using TDD + clean code.
