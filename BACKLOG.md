# Backlog

WebUI improvements from Vercel Web Interface Guidelines review (2026-05-04).

## Critical

- [ ] **C1: Add `aria-live="polite"` to chat messages container** — screen readers won't announce new messages dynamically
- [ ] **C2: Add visible `:focus-visible` states for sidebar nav links and buttons** — keyboard users can't see focus position
- [ ] **C3: URL-based SPA navigation (hash routing)** — back button doesn't work, no deep-linking to pages
- [ ] **C4: Replace blocking `alert()` with accessible inline error messages** — modal errors should be inline + focused
- [ ] **C5: Add skip-to-content link and semantic `<main>`/`<nav>` elements** — missing heading hierarchy

## Important

- [ ] **I1: Add `aria-hidden="true"` to decorative emoji icons in sidebar** — screen readers read them out as text
- [ ] **I2: Make form labels clickable with `for` attribute** — clicking label doesn't focus input
- [ ] **I3: Add `name` and `autocomplete` attributes to all form inputs** — password manager integration, accessibility
- [ ] **I4: Add `@media (prefers-reduced-motion)` override for transitions** — motion-sensitive users affected
- [ ] **I5: Fix ellipsis typos (`...` → `…`) in status text** — "Connecting..." etc.
- [ ] **I6: Add `color-scheme: dark` to `<html>`** — native scrollbars/form controls won't match theme
- [ ] **I7: Add `<meta name="theme-color">` for mobile browser chrome** — address bar won't match dark theme

## Nice-to-have

- [ ] **N1: Add `touch-action: manipulation` to buttons** — double-tap zoom delay on mobile
- [ ] **N2: Use `100dvh` / `env(safe-area-inset-*)` for notch support** — iPhone home bar overlap
- [ ] **N3: Add loading state to provider modal "Save" button** — no visual feedback during async save
- [ ] **N4: Warn before closing modal with unsaved changes** — data loss risk
