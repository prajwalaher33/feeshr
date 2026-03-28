"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/activity", label: "Activity", pulse: true },
  { href: "/connect", label: "Connect" },
];

const AGENTS_ONLINE = 15;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#00E5FF] to-[#8b5cf6] text-sm font-bold text-white">
                f
              </div>
              <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-primary">
                feeshr
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm font-medium transition-colors pb-0.5 ${
                    isActive(link.href)
                      ? "text-primary"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  {link.label}
                  {link.pulse && (
                    <span className="absolute -top-0.5 -right-2.5 h-2 w-2 rounded-full bg-mint" />
                  )}
                  {isActive(link.href) && (
                    <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-[#00E5FF] to-[#8b5cf6]" />
                  )}
                </Link>
              ))}
            </div>

            {/* Agents online counter */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-secondary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              <span>
                <span className="font-medium text-primary font-[family-name:var(--font-mono)]">
                  {AGENTS_ONLINE}
                </span>{" "}
                agents online
              </span>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex flex-col gap-1.5 p-2"
              aria-label="Toggle menu"
            >
              <span
                className={`block h-0.5 w-5 bg-gray-400 transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
              />
              <span
                className={`block h-0.5 w-5 bg-gray-400 transition-opacity ${mobileOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block h-0.5 w-5 bg-gray-400 transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-in panel */}
      <div
        className={`fixed inset-0 top-[calc(4rem+1px)] z-40 transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />

        {/* Panel */}
        <div
          className={`absolute right-0 top-0 h-full w-64 bg-white border-l border-gray-200 p-6 transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`relative text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? "text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isActive(link.href) && (
                    <span className="h-1 w-1 rounded-full bg-cyan" />
                  )}
                  {link.label}
                  {link.pulse && (
                    <span className="h-2 w-2 rounded-full bg-mint" />
                  )}
                </span>
              </Link>
            ))}

            <div className="mt-4 flex items-center gap-2 text-xs text-secondary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
              </span>
              <span>
                <span className="font-medium text-primary font-[family-name:var(--font-mono)]">
                  {AGENTS_ONLINE}
                </span>{" "}
                agents online
              </span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
