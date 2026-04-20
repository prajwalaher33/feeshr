/**
 * V7 Design Tokens — "Obsidian & Phosphor"
 * Single source of truth. CSS variables defined in globals.css mirror these.
 * Never hardcode hex values in components — import from here or use var(--*).
 */

// ─── Color ──────────────────────────────────────────────────────────────────

export const color = {
  bg: {
    0: "var(--bg-0)",
    1: "var(--bg-1)",
    2: "var(--bg-2)",
    3: "var(--bg-3)",
  },
  line: {
    default: "var(--line)",
    strong: "var(--line-strong)",
  },
  ink: {
    0: "var(--ink-0)",
    1: "var(--ink-1)",
    2: "var(--ink-2)",
    3: "var(--ink-3)",
    4: "var(--ink-4)",
  },
  phos: {
    50: "var(--phos-50)",
    200: "var(--phos-200)",
    400: "var(--phos-400)",
    500: "var(--phos-500)",
    600: "var(--phos-600)",
    900: "var(--phos-900)",
  },
  semantic: {
    ok: "var(--ok)",
    warn: "var(--warn)",
    err: "var(--err)",
    info: "var(--info)",
  },
  hue: {
    a: "var(--hue-a)",
    b: "var(--hue-b)",
    c: "var(--hue-c)",
    d: "var(--hue-d)",
    e: "var(--hue-e)",
    f: "var(--hue-f)",
  },
} as const;

// Raw hex values — only for use in tokens.ts, globals.css, and generated code.
export const rawColor = {
  bg0: "#07080A",
  bg1: "#0B0D10",
  bg2: "#111418",
  bg3: "#171B20",
  line: "#1E242B",
  lineStrong: "#2A3138",
  ink0: "#F4F5F7",
  ink1: "#C5CBD3",
  ink2: "#8A919B",
  ink3: "#5A616B",
  ink4: "#3A4049",
  phos50: "#EFFFE9",
  phos200: "#B6F5A3",
  phos400: "#64E04B",
  phos500: "#3BD01F",
  phos600: "#2AA815",
  phos900: "#0E3A08",
  ok: "#3BD01F",
  warn: "#E8B339",
  err: "#E5484D",
  info: "#5B8DEF",
  hueA: "#7FB4FF",
  hueB: "#B28CFF",
  hueC: "#FF9AA8",
  hueD: "#FFC978",
  hueE: "#7FE0C2",
  hueF: "#F088D5",
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

export const font = {
  body: "var(--font-inter)",
  display: "var(--font-instrument)",
  mono: "var(--font-jetbrains)",
} as const;

export const fontSize = {
  xs: "0.6875rem",   // 11
  sm: "0.8125rem",   // 13
  md: "0.9375rem",   // 15
  lg: "1.125rem",    // 18
  xl: "1.5rem",      // 24
  "2xl": "2.25rem",  // 36
  "3xl": "clamp(3rem, 6vw, 5.5rem)",
  display: "clamp(5rem, 12vw, 11rem)",
} as const;

// ─── Spacing ────────────────────────────────────────────────────────────────

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96, 128] as const;

// ─── Radii ──────────────────────────────────────────────────────────────────

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  pill: "999px",
} as const;

// ─── Elevation ──────────────────────────────────────────────────────────────

export const elevation = {
  1: "0 0 0 1px var(--line)",
  2: "0 0 0 1px var(--line), 0 1px 0 0 rgba(255,255,255,0.03) inset",
  phos: "0 0 0 1px var(--phos-500), 0 0 24px -8px var(--phos-500)",
} as const;
