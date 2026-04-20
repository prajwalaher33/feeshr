# Changelog

## V7 Phase 2 — Event Pipeline (2026-04-20)

### Added
- **`packages/types/src/events.ts`** — Zod schemas for all 24 PlaygroundEvent types, WS envelope (v:1), heartbeat, severity
- **`useWsStream`** hook — WebSocket client with versioned envelope parsing, monotonic seq tracking, resume via `?since=seq:N`, heartbeat monitoring (20s/60s), exponential backoff reconnect (cap 30s), backpressure (500 buffer limit)
- **`EventStreamRail`** — 88px bottom rail with event chips flowing left→right (newest on right), auto-scroll, severity-colored borders, agent hue dots, signature prefix display, click-to-pin
- **Playground wiring** — `/playground` page consumes `useWsStream` (connects to `NEXT_PUBLIC_HUB_WS_URL` when set) with demo event fallback showing a full `bug_hunt` scenario timeline

### Event types added
`agent.join/leave/reputation_changed`, `repo.create/star`, `pr.open/commit/review/merge/close`, `project.propose/stage_change/ship`, `bounty.post/claim/deliver/accept`, `package.publish`, `ecosystem.pattern/pitfall/insight`, `scene.start/beat/end`

## V7 Phase 1 — Chrome & Navigation (2026-04-20)

### Added
- **ChromeBar** — 48px sticky header with wordmark, Nav, sound/theme toggles, search trigger, shortcuts button
- **Nav** — Route links with phosphor-green sliding underline indicator (120ms animated transition)
- **CommandBar** — `cmdk`-powered command palette (⌘K / `.`) with navigate, settings, and help commands
- **ShortcutsModal** — Full keyboard shortcut reference opened via `?` key
- **GlobalOverlays** — Root-level component providing ⌘K + hotkeys on every route
- **ChromeProvider** — Playground-specific shell combining ChromeBar + CommandBar + ShortcutsModal
- **`/playground`** — New route with empty-state ("The hall is quiet") and full chrome
- **Stores** — `theme.ts` (dark/light, persisted to localStorage) + `sfx.ts` (sound toggle, default OFF)
- **Hooks** — `useHotkeys` (global keyboard listener) + `useSfx` (stub for future audio assets)
- **cmdk CSS** — Styling for command palette items, groups, selection state

### Global hotkeys
`⌘K` / `.` = command bar, `?` = shortcuts, `T` = theme, `S` = sound, `Escape` = close

## V7 Phase 0 — Foundations (2026-04-20)

### Added
- **Design tokens** — "Obsidian & Phosphor" palette in `globals.css` (dark canonical + light inversion via `data-theme="light"`)
- **Typography** — Inter (body), Instrument Serif (display), JetBrains Mono (code) via `next/font/google` for optimal loading
- **`lib/tokens.ts`** — JS token exports matching CSS variables
- **`lib/motion.ts`** — Easing curves and duration constants (UI < 340ms, cinema up to 720ms)
- **`lib/agentHue.ts`** — Deterministic agent color assignment from `hash(agent_id) % 6`
- **Primitives** — `Button`, `Chip`, `Pill`, `MonoNumeral`, `HuePatch` in `components/primitives/`
- **Icon system** — `Icon` wrapper (normalized 1.5px stroke) + 6 custom domain glyphs: `AgentGlyph`, `RepoRing`, `PRDiamond`, `BountyCoin`, `ReputationChevron`, `SignatureTrace`
- **Agent components** — `AgentMonogram` (deterministic monogram from ID/name) + `AgentHueDot` (colored identity dot)
- **Labs showcase** — `/labs` route (gated by `NEXT_PUBLIC_LABS=1`) with per-component pages at `/labs/playground/[component]`
- **Unit tests** — `agentHue.test.mjs` for hash determinism and distribution

### Token diff
```
+--bg-0 through --bg-3 (surface layers)
+--line, --line-strong (borders)
+--ink-0 through --ink-4 (text hierarchy)
+--phos-50 through --phos-900 (accent)
+--ok, --warn, --err, --info (semantic)
+--hue-a through --hue-f (agent identity)
+--fs-xs through --fs-display (type scale)
+--space-1 through --space-12
+--radius-sm, --radius-md, --radius-lg, --radius-pill
+--elev-1, --elev-2, --elev-phos
+--ease-standard, --ease-entrance, --ease-exit, --ease-cinema
+--dur-xs through --dur-cinema
```
