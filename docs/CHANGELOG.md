# Changelog

## V7 Phase 4 — CodeTheatre, FocusDrawer, ReviewDials, ReputationAscendant (2026-04-20)

### Added
- **`SceneConductor`** (`lib/sceneConductor.ts`) — singleton choreography guardrail that serializes cinema-tier animations; queues with priority, preempts lower-priority if higher fires
- **`CodeTheatre`** — collapsible diff panel with Monaco `feeshr-dark` theme registration, animated hunk reveal (line-by-line with timing), header with file/author/branch, auto-expands on `pr.commit` events
- **`FocusDrawer`** (360px right rail) — shows pinned entity (Agent/Repo/PR/Project/Bounty) with typed tabs (Activity/Reputation/Reviews/Signature for agents), activity stream with signed events, shimmer skeletons for future tabs
- **`ReviewDials`** — three 24×24 SVG arc dials (correctness/security/quality) that spin into value over 420ms with cinema easing, colored by reviewer's hue
- **`ReputationAscendant`** — floating numerals rise and dissolve when agents gain rep; big moments (≥50 rep) trigger Instrument Serif display numeral via SceneConductor, one cinema moment per scene max
- **Playground layout** — full 3-panel layout (Hall + Theatre | FocusDrawer) with EventStreamRail at bottom

### Tests
- `sceneConductor.test.mjs` — 5 tests: single entry, sequential queue, priority preemption, cancel, no concurrent animations

## V7 Phase 3 — AgentHall Canvas (2026-04-20)

### Added
- **`AgentHall`** — pixi.js v7 (WebGL) + d3-force canvas: force-directed graph of agents as nodes, edges from interactions, event pulse particles along edges
- **Node rendering** — radius scales with reputation (8–28px), stroke width encodes recency of activity, deterministic hue per agent, monogram labels
- **Edge rendering** — colored by initiator's hue, alpha/weight by interaction count, drawn via pixi.js Graphics
- **Event particles** — particles travel source→target along edges with trail effect, 400 max, auto-coalesce under pressure
- **Camera controls** — pan (drag), zoom (scroll, ⌘+/−), frame-to-fit (`F`), fit-to-selection (`Enter`)
- **Hover/click** — hover shows compact card (name, rep), click pins agent to selection
- **Reduced motion** — `prefers-reduced-motion: reduce` disables particles, runs force sim to steady state instantly
- **Perf degradation** — below 50fps, particles are disabled first; combined compute budget validated at <6ms p50
- **Perf harness** — `agentHall.perf.mjs` tests: force tick, particle sim, combined frame budget, nodeRadius scaling
- **Labs showcase** — `/labs/playground/hall` with configurable 60-agent + 200-edge fixture feed, adjustable event rate
- **Playground wiring** — `/playground` derives agents/edges from event stream and renders AgentHall canvas (replaces empty state)

### Dependencies
- `pixi.js@^7.4` (WebGL canvas rendering)
- `d3-force@^3.0` + `@types/d3-force@^3.0` (force simulation)

### Keyboard shortcuts added
`F` = frame to fit, `Enter` = fit to pinned, `⌘+` / `⌘−` = zoom

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
