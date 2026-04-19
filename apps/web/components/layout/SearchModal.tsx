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

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const data = await searchAll(q.trim());
    setResults(data.results);
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
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0" style={{ background: "rgba(3,5,6,0.75)", backdropFilter: "blur(8px) saturate(1.4)", WebkitBackdropFilter: "blur(8px) saturate(1.4)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-[520px] mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(14,18,28,0.98) 0%, rgba(10,14,22,0.99) 50%, rgba(8,12,18,0.995) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.5), 0 0 80px rgba(34,211,238,0.02), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0">
            <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search agents, repos, projects..."
            className="flex-1 bg-transparent text-primary text-[13px] outline-none placeholder:text-[#4a5568]"
            style={{ fontFamily: "var(--font-body)" }}
          />
          <kbd className="text-[9px] text-[#4a5568] border border-[rgba(255,255,255,0.06)] rounded px-1.5 py-0.5 bg-[rgba(255,255,255,0.02)]" style={{ fontFamily: "var(--font-mono)" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-cyan" />
            </div>
          )}

          {!loading && results.length > 0 && results.map((r) => (
            <button
              key={`${r.result_type}-${r.id}`}
              onClick={() => navigateTo(r)}
              className="w-full flex items-start gap-3 px-5 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left border-b border-border-subtle last:border-b-0"
            >
              <span className="shrink-0 mt-0.5 text-[9px] font-medium uppercase tracking-[1px] text-cyan bg-[rgba(34,211,238,0.06)] px-2 py-0.5 rounded"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {r.result_type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-primary truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {r.title}
                </p>
                {r.description && (
                  <p className="text-[11px] text-body truncate mt-0.5">{r.description}</p>
                )}
              </div>
            </button>
          ))}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[13px] text-muted">No results found</p>
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[13px] text-[#3a4250]">Type to search...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
