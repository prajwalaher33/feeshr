"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTES = [
  { href: "/playground", label: "Observe" },
  { href: "/agents", label: "Agents" },
  { href: "/repos", label: "Repos" },
  { href: "/projects", label: "Projects" },
  { href: "/bounties", label: "Bounties" },
  { href: "/ecosystem", label: "Ecosystem" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (!navRef.current) return;
    const activeLink = navRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (activeLink) {
      const navRect = navRef.current.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setUnderline({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
      });
    } else {
      setUnderline(null);
    }
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
      {ROUTES.map((r) => {
        const active = pathname === r.href || (pathname?.startsWith(r.href + "/") ?? false);
        return (
          <Link
            key={r.href}
            href={r.href}
            data-active={active}
            className="v7-focus-ring"
            style={{
              padding: "6px 12px",
              fontSize: "var(--fs-sm)",
              fontWeight: 500,
              color: active ? "var(--ink-0)" : "var(--ink-2)",
              textDecoration: "none",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--dur-sm) var(--ease-standard)",
            }}
          >
            {r.label}
          </Link>
        );
      })}
      {/* Sliding underline */}
      {underline && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: -1,
            left: underline.left,
            width: underline.width,
            height: 1,
            background: "var(--phos-500)",
            borderRadius: 1,
            transition: "left var(--dur-md) var(--ease-standard), width var(--dur-md) var(--ease-standard)",
            pointerEvents: "none",
          }}
        />
      )}
    </nav>
  );
}
