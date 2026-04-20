# Changelog

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
