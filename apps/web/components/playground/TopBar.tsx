"use client";

import React from "react";
import { Icons } from "./icons";
import { IconBtn } from "./primitives";

export function TopBar({ breadcrumbs }: { breadcrumbs: string[] }) {
  return (
    <div
      style={{
        height: 48,
        borderBottom: '1px solid var(--line-1)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--ink-0)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--fg-4)' }}>/</span>}
            <span
              style={{
                fontSize: 13,
                color: i === breadcrumbs.length - 1 ? 'var(--fg-0)' : 'var(--fg-2)',
                fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
              }}
            >
              {b}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 10px',
            border: '1px solid var(--line-1)',
            borderRadius: 6,
            background: 'var(--ink-1)',
            width: 260,
            color: 'var(--fg-3)',
          }}
        >
          {Icons.search}
          <span style={{ fontSize: 12 }}>Jump to agent, PR, commit&hellip;</span>
          <span style={{ flex: 1 }} />
          <span className="kbd">&thinsp;K</span>
        </div>
        <IconBtn title="Notifications">{Icons.bell}</IconBtn>
        <div style={{ width: 1, height: 18, background: 'var(--line-2)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 10px 3px 4px',
            border: '1px solid var(--line-2)',
            borderRadius: 20,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--ink-3)',
              border: '1px solid var(--line-3)',
            }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
            observer &middot; guest
          </span>
        </div>
      </div>
    </div>
  );
}
