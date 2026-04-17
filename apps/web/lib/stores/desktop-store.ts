import { create } from "zustand";
import type {
  DesktopViewState,
  DesktopEvent,
  ActiveTool,
  BrowserState,
  TerminalLine,
  FileNode,
  OpenFile,
  PermissionRequest,
} from "@/lib/types/desktop";

const MAX_TERMINAL_LINES = 500;
const MAX_EVENTS = 1000;

interface DesktopStore extends DesktopViewState {
  /** Process an incoming desktop event and update the relevant state slices. */
  processEvent: (event: DesktopEvent) => void;
  /** Set connection status. */
  setConnected: (connected: boolean) => void;
  /** Switch the currently visible tool pane. */
  setActiveTool: (tool: ActiveTool) => void;
  /** Dismiss a permission request. */
  dismissPermission: () => void;
  /** Reset all desktop state. */
  reset: () => void;
}

const initialBrowser: BrowserState = {
  url: "",
  title: "",
  content: "",
  loading: false,
  history: [],
};

const initialState: DesktopViewState = {
  sessionId: null,
  connected: false,
  activeTool: "terminal",
  browser: initialBrowser,
  terminal: { lines: [], cwd: "~", running: false },
  files: { tree: [], openFiles: [], activeFile: null },
  permissionRequest: null,
  agentStatus: "idle",
  events: [],
};

export const useDesktopStore = create<DesktopStore>((set) => ({
  ...initialState,

  processEvent: (event) =>
    set((s) => {
      const events = [event, ...s.events].slice(0, MAX_EVENTS);
      const sessionId = event.session_id ?? s.sessionId;
      const p = event.payload;

      switch (event.event_type) {
        case "session_start":
          return {
            ...initialState,
            sessionId,
            connected: true,
            agentStatus: "working",
            events,
          };

        case "session_end":
          return { ...s, agentStatus: "completed", events };

        case "browser_navigate":
          return {
            ...s,
            events,
            activeTool: "browser",
            browser: {
              ...s.browser,
              url: (p.url as string) ?? s.browser.url,
              title: (p.title as string) ?? "",
              loading: true,
              history: [...s.browser.history, (p.url as string) ?? ""],
            },
          };

        case "browser_content":
          return {
            ...s,
            events,
            browser: {
              ...s.browser,
              content: (p.content as string) ?? "",
              title: (p.title as string) ?? s.browser.title,
              loading: false,
            },
          };

        case "terminal_command": {
          const line: TerminalLine = {
            type: "command",
            text: (p.command as string) ?? "",
            timestamp: event.created_at,
          };
          return {
            ...s,
            events,
            activeTool: "terminal",
            terminal: {
              ...s.terminal,
              lines: [...s.terminal.lines, line].slice(-MAX_TERMINAL_LINES),
              cwd: (p.cwd as string) ?? s.terminal.cwd,
              running: true,
            },
          };
        }

        case "terminal_output": {
          const outLine: TerminalLine = {
            type: (p.is_error as boolean) ? "error" : "output",
            text: (p.output as string) ?? "",
            timestamp: event.created_at,
          };
          return {
            ...s,
            events,
            terminal: {
              ...s.terminal,
              lines: [...s.terminal.lines, outLine].slice(-MAX_TERMINAL_LINES),
              running: (p.running as boolean) ?? false,
            },
          };
        }

        case "file_open": {
          const filePath = (p.path as string) ?? "";
          const exists = s.files.openFiles.some((f) => f.path === filePath);
          const newFile: OpenFile = {
            path: filePath,
            name: (p.name as string) ?? filePath.split("/").pop() ?? "",
            content: (p.content as string) ?? "",
            language: (p.language as string) ?? "text",
          };
          return {
            ...s,
            events,
            activeTool: "editor",
            files: {
              ...s.files,
              openFiles: exists ? s.files.openFiles : [...s.files.openFiles, newFile],
              activeFile: filePath,
            },
          };
        }

        case "file_edit": {
          const editPath = (p.path as string) ?? "";
          return {
            ...s,
            events,
            activeTool: "editor",
            files: {
              ...s.files,
              openFiles: s.files.openFiles.map((f) =>
                f.path === editPath
                  ? {
                      ...f,
                      content: (p.content as string) ?? f.content,
                      highlights: (p.highlights as OpenFile["highlights"]) ?? f.highlights,
                    }
                  : f,
              ),
              activeFile: editPath,
            },
          };
        }

        case "file_create": {
          const createPath = (p.path as string) ?? "";
          const node: FileNode = {
            name: (p.name as string) ?? createPath.split("/").pop() ?? "",
            path: createPath,
            type: "file",
            language: (p.language as string) ?? undefined,
          };
          return {
            ...s,
            events,
            files: {
              ...s.files,
              tree: [...s.files.tree, node],
            },
          };
        }

        case "file_delete": {
          const delPath = (p.path as string) ?? "";
          return {
            ...s,
            events,
            files: {
              ...s.files,
              tree: s.files.tree.filter((n) => n.path !== delPath),
              openFiles: s.files.openFiles.filter((f) => f.path !== delPath),
              activeFile: s.files.activeFile === delPath ? null : s.files.activeFile,
            },
          };
        }

        case "tool_switch":
          return {
            ...s,
            events,
            activeTool: (p.tool as ActiveTool) ?? s.activeTool,
          };

        case "status_change":
          return {
            ...s,
            events,
            agentStatus: (p.status as DesktopViewState["agentStatus"]) ?? s.agentStatus,
          };

        case "permission_request": {
          const req: PermissionRequest = {
            id: (p.id as string) ?? event.id ?? "",
            action: (p.action as string) ?? "",
            description: (p.description as string) ?? "",
            resource: (p.resource as string) ?? "",
            severity: (p.severity as PermissionRequest["severity"]) ?? "medium",
            timestamp: event.created_at,
          };
          return { ...s, events, permissionRequest: req };
        }

        case "permission_response":
          return { ...s, events, permissionRequest: null };

        default:
          return { ...s, events };
      }
    }),

  setConnected: (connected) => set({ connected }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  dismissPermission: () => set({ permissionRequest: null }),

  reset: () => set(initialState),
}));
