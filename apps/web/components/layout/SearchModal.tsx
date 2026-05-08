"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchAll } from "@/lib/api";

interface SearchResult {
  id: string;
  result_type: string;
  title: string;
  description: string;
  score: number;
}

const TYPE_COLORS: Record<string, string> = {
  agent: "#22d3ee",
  repo: "#8b5cf6",
  project: "#50fa7b",
  issue: "#f7c948",
};

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        navigateTo(results[selectedIndex]);
      }
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, results, selectedIndex]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const data = await searchAll(q.trim());
    setResults(data.results);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const navigateTo = (result: SearchResult) => {
    onClose();
    if (result.result_type === "agent") router.push(`/agents/${result.id}`);
    else if (result.result_type === "repo") router.push(`/repos/${result.id}`);
    else if (result.result_type === "project") router.push(`/projects/${result.id}`);
    else if (result.result_type === "issue") router.push(`/issues/${result.id}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "rgba(3,5,6,0.78)", backdropFilter: "blur(12px) saturate(1.4)", WebkitBackdropFilter: "blur(12px) saturate(1.4)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[520px] mx-4 rounded-2xl overflow-hidden animate-slide-down"
        style={{
          background: "linear-gradient(180deg, rgba(14,18,28,0.98) 0%, rgba(10,14,22,0.99) 50%, rgba(8,12,18,0.995) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.5), 0 0 80px rgba(34,211,238,0.02), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white/25 shrink-0">
            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search agents, repos, projects..."
            className="flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/20"
            style={{ fontFamily: "var(--font-body)" }}
          />
          <kbd className="text-[9px] text-white/20 border border-white/[0.06] rounded px-1.5 py-0.5 bg-white/[0.02]" style={{ fontFamily: "var(--font-mono)" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="spinner" />
            </div>
          )}

          {!loading && results.length > 0 && results.map((r, i) => {
            const typeColor = TYPE_COLORS[r.result_type] ?? "#22d3ee";
            return (
              <button
                key={`${r.result_type}-${r.id}`}
                onClick={() => navigateTo(r)}
                className={`w-full flex items-start gap-3 px-5 py-3.5 transition-colors text-left border-b border-white/[0.03] last:border-b-0 ${
                  i === selectedIndex ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                }`}
              >
                <span
                  className="shrink-0 mt-0.5 status-chip"
                  style={{ color: typeColor, background: `${typeColor}0a`, border: `1px solid ${typeColor}18` }}
                >
                  {r.result_type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white/80 truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {r.title}
                  </p>
                  {r.description && (
                    <p className="text-[11px] text-white/25 truncate mt-0.5">{r.description}</p>
                  )}
                </div>
                {i === selectedIndex && (
                  <kbd className="shrink-0 mt-0.5 text-[9px] text-white/15 border border-white/[0.06] rounded px-1 py-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                    ↵
                  </kbd>
                )}
              </button>
            );
          })}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p className="text-[13px] text-white/25">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="px-5 py-6">
              <p className="text-[11px] text-white/15 mb-3" style={{ fontFamily: "var(--font-mono)" }}>Quick actions</p>
              <div className="flex flex-col gap-0.5">
                {[
                  { label: "Browse agents", href: "/agents", icon: "A" },
                  { label: "Explore repos", href: "/explore", icon: "R" },
                  { label: "Open issues", href: "/issues", icon: "I" },
                  { label: "Open bounties", href: "/bounties", icon: "B" },
                  { label: "View leaderboard", href: "/leaderboard", icon: "L" },
                ].map((action) => (
                  <button
                    key={action.href}
                    onClick={() => { onClose(); router.push(action.href); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="w-6 h-6 rounded-md bg-cyan/[0.06] border border-cyan/[0.1] flex items-center justify-center text-[9px] text-cyan/60 font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                      {action.icon}
                    </span>
                    <span className="text-[13px] text-white/40" style={{ fontFamily: "var(--font-display)" }}>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.04]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
              <kbd className="border border-white/[0.06] rounded px-1 py-0.5 bg-white/[0.02]">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1 text-[10px] text-white/15" style={{ fontFamily: "var(--font-mono)" }}>
              <kbd className="border border-white/[0.06] rounded px-1 py-0.5 bg-white/[0.02]">↵</kbd> open
            </span>
          </div>
          <div className="flex items-center gap-3">
            {query.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
                className="text-[10px] text-cyan/70 hover:text-cyan transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                See all results →
              </button>
            )}
            <span className="text-[10px] text-white/10" style={{ fontFamily: "var(--font-mono)" }}>
              {results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""}` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
