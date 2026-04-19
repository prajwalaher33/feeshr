import React from "react";

export const Icons = {
  // Navigation
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h3l1.5-4 3 8L11 8h3" />
    </svg>
  ),
  agents: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </svg>
  ),
  session: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5 8l2 2 4-4" />
    </svg>
  ),
  git: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <path d="M5 5.5v5M11 6.5V5c0-.8-.7-1.5-1.5-1.5H8" />
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4" />
    </svg>
  ),

  // Actions
  search: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="6" cy="6" r="4" />
      <path d="M9.2 9.2l2.8 2.8" />
    </svg>
  ),
  bell: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M3.5 5.5a3.5 3.5 0 017 0v3l1 1.5H2.5l1-1.5z" />
      <path d="M5.5 11a1.5 1.5 0 003 0" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" />
    </svg>
  ),
  play: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 2l7 4-7 4z" />
    </svg>
  ),
  pause: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="2.5" y="2" width="2.5" height="8" rx="0.5" />
      <rect x="7" y="2" width="2.5" height="8" rx="0.5" />
    </svg>
  ),
  skipForward: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 2l5.5 4L2 10z" />
      <rect x="8.5" y="2" width="1.5" height="8" rx="0.5" />
    </svg>
  ),
  chevRight: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3.5 2l3.5 3-3.5 3" />
    </svg>
  ),
  chevDown: (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 3.5l3 3.5 3-3.5" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6.5L5 9l4.5-5.5" />
    </svg>
  ),
  x: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  ),
  external: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M9 3L5 7M9 3H6.5M9 3v2.5M4 3H3a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V8" />
    </svg>
  ),

  // Session event kinds
  brain: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M6 1.5c-2.5 0-4 1.5-4 3.5 0 1.5 1 2.5 2 3v1.5h4V8c1-0.5 2-1.5 2-3 0-2-1.5-3.5-4-3.5z" />
      <path d="M4.5 10.5h3" />
    </svg>
  ),
  terminal: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2 3l3 3-3 3M6.5 9h3.5" />
    </svg>
  ),
  file: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M3 1.5h4l2.5 2.5v7H3z" />
      <path d="M7 1.5v2.5h2.5" />
    </svg>
  ),
  pencil: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M8.5 1.5l2 2-7 7H1.5V8.5z" />
    </svg>
  ),
  folder: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M1.5 3.5h3l1 1h5v5.5h-9z" />
    </svg>
  ),
};

export type KindMeta = {
  color: string;
  bg: string;
  label: string;
  icon: React.ReactNode;
};

export const KIND_META: Record<string, KindMeta> = {
  boot: { color: 'var(--accent)', bg: 'var(--accent-dim)', label: 'INIT', icon: Icons.code },
  plan: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'PLAN', icon: Icons.brain },
  think: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'THINK', icon: Icons.brain },
  read: { color: 'var(--text-2)', bg: 'var(--bg-2)', label: 'READ', icon: Icons.file },
  edit: { color: 'var(--amber)', bg: 'var(--amber-dim)', label: 'EDIT', icon: Icons.pencil },
  shell: { color: 'var(--text-1)', bg: 'var(--bg-2)', label: 'EXEC', icon: Icons.terminal },
  commit: { color: 'var(--green)', bg: 'var(--green-dim)', label: 'COMMIT', icon: Icons.check },
  pr: { color: 'var(--green)', bg: 'var(--green-dim)', label: 'PR', icon: Icons.git },
  review: { color: 'var(--amber)', bg: 'var(--amber-dim)', label: 'REVIEW', icon: Icons.agents },
  merge: { color: 'var(--green)', bg: 'var(--green-dim)', label: 'MERGE', icon: Icons.check },
  fail: { color: 'var(--red)', bg: 'var(--red-dim)', label: 'FAIL', icon: Icons.x },
};
