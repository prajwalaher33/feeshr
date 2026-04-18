"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useDesktopStore } from "@/lib/stores/desktop-store";

const LANG_DOT_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3776ab",
  rust: "#dea584",
  json: "#8b5cf6",
  css: "#264de4",
  html: "#e34f26",
  markdown: "#7a8394",
  text: "#5a6270",
};

function getLanguageDotColor(lang: string): string {
  return LANG_DOT_COLORS[lang.toLowerCase()] ?? "#5a6270";
}

function FileTabBar() {
  const { files } = useDesktopStore();

  if (files.openFiles.length === 0) return null;

  return (
    <div className="flex items-center gap-0 border-b border-[rgba(255,255,255,0.04)] overflow-x-auto shrink-0 bg-[rgba(255,255,255,0.01)]">
      {files.openFiles.map((file) => {
        const isActive = file.path === files.activeFile;
        return (
          <div
            key={file.path}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] border-r border-[rgba(255,255,255,0.03)] cursor-default transition-all relative ${
              isActive
                ? "bg-[#060a12] text-[#e2e8f0]"
                : "text-[#5a6270] hover:text-[#7a8394] bg-[rgba(255,255,255,0.01)]"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ backgroundColor: getLanguageDotColor(file.language) }}
            />
            <span className="truncate max-w-[120px]">{file.name}</span>
            {isActive && (
              <motion.div
                layoutId="active-file-tab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
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
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#2a3040]">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        <span className="text-[12px] text-[#3a4250]">No file open</span>
      </div>
    );
  }

  const lines = activeFile.content.split("\n");
  const highlightMap = new Map(
    (activeFile.highlights ?? []).map((h) => [h.line, h.type]),
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeFile.path}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="overflow-auto h-full"
      >
        <table className="w-full border-collapse" style={{ fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.8" }}>
          <tbody>
            {lines.map((line, i) => {
              const lineNum = i + 1;
              const hl = highlightMap.get(lineNum);
              const bgColor = hl === "added"
                ? "rgba(40,200,64,0.06)"
                : hl === "removed"
                  ? "rgba(255,107,107,0.06)"
                  : hl === "modified"
                    ? "rgba(247,201,72,0.06)"
                    : "transparent";
              const gutterColor = hl === "added"
                ? "#28c840"
                : hl === "removed"
                  ? "#ff6b6b"
                  : hl === "modified"
                    ? "#f7c948"
                    : "#3a4250";
              const borderColor = hl === "added"
                ? "rgba(40,200,64,0.3)"
                : hl === "removed"
                  ? "rgba(255,107,107,0.3)"
                  : hl === "modified"
                    ? "rgba(247,201,72,0.3)"
                    : "transparent";

              return (
                <tr key={i} style={{ backgroundColor: bgColor }}>
                  <td
                    className="px-3 py-0 text-right select-none w-12"
                    style={{ color: gutterColor, borderLeft: `2px solid ${borderColor}` }}
                  >
                    <span className="text-[11px]">{lineNum}</span>
                  </td>
                  <td className="px-4 py-0 text-[#9aa5b4] whitespace-pre">{line}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>
    </AnimatePresence>
  );
}

export function FileExplorer() {
  const { files } = useDesktopStore();
  const activeFile = files.openFiles.find((f) => f.path === files.activeFile);

  return (
    <div className="flex flex-col h-full">
      <FileTabBar />
      <div className="flex-1 min-h-0">
        <CodeView />
      </div>
      {/* Status bar */}
      {activeFile && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-t border-[rgba(255,255,255,0.04)] text-[10px] text-[#5a6270] shrink-0 bg-[rgba(255,255,255,0.01)]" style={{ fontFamily: "var(--font-mono)" }}>
          <div className="flex items-center gap-1.5">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ backgroundColor: getLanguageDotColor(activeFile.language) }}
            />
            <span>{activeFile.language}</span>
          </div>
          <span>{activeFile.content.split("\n").length} lines</span>
          {activeFile.highlights && activeFile.highlights.length > 0 && (
            <span className="text-[#f7c948]">
              {activeFile.highlights.length} change{activeFile.highlights.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="ml-auto">{activeFile.path}</span>
        </div>
      )}
    </div>
  );
}
