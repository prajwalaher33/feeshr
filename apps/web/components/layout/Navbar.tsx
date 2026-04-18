"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SearchModal from "./SearchModal";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/activity", label: "Playground" },
  { href: "/agents", label: "Agents" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className="transition-all duration-300"
        style={{
          backdropFilter: "blur(40px) saturate(1.5)",
          WebkitBackdropFilter: "blur(40px) saturate(1.5)",
          background: scrolled ? "rgba(3,5,6,0.82)" : "rgba(3,5,6,0.6)",
          borderBottom: `1px solid ${scrolled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}`,
        }}
      >
        <div className="flex items-center justify-between px-[118px] py-3 max-[1024px]:px-6 max-[768px]:px-4">
          {/* Logo */}
          <Link href="/" className="relative shrink-0 h-[44px] w-[82px] overflow-hidden">
            <Image
              src="/logo.png"
              alt="Feeshr"
              width={148}
              height={98}
              className="absolute h-[223%] left-[-41%] top-[-56%] w-[181%] max-w-none"
              priority
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 rounded-lg text-[13px] tracking-[-0.2px] transition-all duration-200 ${
                  isActive(link.href)
                    ? "font-semibold text-cyan-light bg-[rgba(34,211,238,0.06)]"
                    : "font-medium text-secondary hover:text-primary hover:bg-[rgba(255,255,255,0.04)]"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search + CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl px-3.5 py-2.5 h-10 cursor-pointer hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.05)] transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0">
                <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-[13px] text-[#4a5568] whitespace-nowrap" style={{ fontFamily: "var(--font-body)" }}>
                Search...
              </span>
              <kbd className="text-[10px] text-[#4a5568] border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 ml-4 bg-[rgba(255,255,255,0.02)]">⌘K</kbd>
            </button>
            <Link
              href="/connect"
              className="shrink-0 flex items-center h-10 px-6 rounded-lg font-semibold text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #22d3ee, #67e8f9)",
                color: "#021a1f",
              }}
            >
              Signup
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-secondary transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-5 bg-secondary transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-5 bg-secondary transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 top-[68px] z-40 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <div
          className={`absolute right-0 top-0 h-full w-64 bg-surface border-l border-border p-6 transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`text-base transition-colors ${
                  isActive(link.href)
                    ? "font-semibold text-cyan-light"
                    : "font-medium text-secondary hover:text-primary"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/connect"
              onClick={() => setMobileOpen(false)}
              className="btn-cta !text-sm !py-2.5 mt-4"
            >
              Signup
            </Link>
          </div>
        </div>
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}
