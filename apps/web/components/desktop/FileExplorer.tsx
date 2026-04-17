"use client";

import { useDesktopStore } from "@/lib/stores/desktop-store";
import { WindowFrame } from "./WindowFrame";

const EDITOR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const LANG_COLORS: Record<string, string> = {
  typescript: "text-cyan",
  javascript: "text-amber",
  python: "text-mint",
  rust: "text-coral",
  json: "text-violet",
  css: "text-indigo",
  html: "text-coral",
  markdown: "text-secondary",
  text: "text-muted",
};

function getLanguageColor(lang: string): string {
  return LANG_COLORS[lang.toLowerCase()] ?? "text-muted";
}

function FileTabBar() {
  const { files } = useDesktopStore();

  if (files.openFiles.length === 0) return null;

  return (
    <div className="flex items-center gap-0 bg-surface border-b border-border-subtle overflow-x-auto shrink-0">
      {files.openFiles.map((file) => {
        const isActive = file.path === files.activeFile;
        return (
          <div
            key={file.path}
            className={`flex items-center gap-2 px-4 py-2 text-xs border-r border-border-subtle cursor-default transition-colors ${
              isActive
                ? "bg-bg text-primary border-b-2 border-b-cyan"
                : "text-muted hover:text-secondary"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className={`w-2 h-2 rounded-full ${getLanguageColor(file.language)}`}>
              <span className="sr-only">{file.language}</span>
            </span>
            <span className="truncate max-w-[120px]">{file.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function CodeView() {
  const { files } = useDesktopStore();
  const activeFile = files.openFiles.find((f) => f.path === files.activeFile);

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        <span className="text-xs">No file open</span>
      </div>
    );
  }

  const lines = activeFile.content.split("\n");
  const highlightMap = new Map(
    (activeFile.highlights ?? []).map((h) => [h.line, h.type]),
  );

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", lineHeight: "1.7" }}>
        <tbody>
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const hl = highlightMap.get(lineNum);
            const bgClass = hl === "added"
              ? "bg-[rgba(61,217,158,0.08)]"
              : hl === "removed"
                ? "bg-[rgba(239,68,68,0.08)]"
                : hl === "modified"
                  ? "bg-[rgba(245,158,11,0.08)]"
                  : "";
            const gutterClass = hl === "added"
              ? "text-mint"
              : hl === "removed"
                ? "text-coral"
                : hl === "modified"
                  ? "text-amber"
                  : "text-muted";

            return (
              <tr key={i} className={bgClass}>
                <td className={`px-3 py-0 text-right select-none w-10 ${gutterClass}`}>
                  {hl === "added" && <span className="mr-1">+</span>}
                  {hl === "removed" && <span className="mr-1">-</span>}
                  {hl === "modified" && <span className="mr-1">~</span>}
                  {lineNum}
                </td>
                <td className="px-4 py-0 text-secondary whitespace-pre">{line}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FileExplorer() {
  const { files, activeTool } = useDesktopStore();
  const activeFile = files.openFiles.find((f) => f.path === files.activeFile);
  const title = activeFile ? activeFile.path : "Editor";

  return (
    <WindowFrame
      title={title}
      icon={EDITOR_ICON}
      active={activeTool === "editor"}
    >
      <div className="flex flex-col h-full">
        <FileTabBar />
        <div className="flex-1 min-h-0">
          <CodeView />
        </div>
        {/* Status bar */}
        {activeFile && (
          <div className="flex items-center gap-4 px-4 py-1.5 bg-surface border-t border-border-subtle text-[10px] text-muted shrink-0" style={{ fontFamily: "var(--font-mono)" }}>
            <span className={getLanguageColor(activeFile.language)}>
              {activeFile.language}
            </span>
            <span>{activeFile.content.split("\n").length} lines</span>
            {activeFile.highlights && activeFile.highlights.length > 0 && (
              <span className="text-amber">
                {activeFile.highlights.length} change{activeFile.highlights.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
