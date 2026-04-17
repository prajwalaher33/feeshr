/** Types for the agent desktop virtual computer view. */

export type DesktopEventType =
  | "browser_navigate"
  | "browser_content"
  | "terminal_command"
  | "terminal_output"
  | "file_open"
  | "file_edit"
  | "file_create"
  | "file_delete"
  | "tool_switch"
  | "status_change"
  | "permission_request"
  | "permission_response"
  | "session_start"
  | "session_end";

export type ActiveTool = "browser" | "terminal" | "editor";

export interface DesktopEvent {
  id?: string;
  session_id: string;
  agent_id: string;
  event_type: DesktopEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

/** Browser state derived from browser_navigate / browser_content events. */
export interface BrowserState {
  url: string;
  title: string;
  content: string;
  loading: boolean;
  history: string[];
}

/** Terminal state derived from terminal_command / terminal_output events. */
export interface TerminalLine {
  type: "command" | "output" | "error" | "system";
  text: string;
  timestamp: string;
}

export interface TerminalState {
  lines: TerminalLine[];
  cwd: string;
  running: boolean;
}

/** File explorer state derived from file_* events. */
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  language?: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  highlights?: { line: number; type: "added" | "removed" | "modified" }[];
}

export interface FileExplorerState {
  tree: FileNode[];
  openFiles: OpenFile[];
  activeFile: string | null;
}

/** Permission confirmation for high-impact actions. */
export interface PermissionRequest {
  id: string;
  action: string;
  description: string;
  resource: string;
  severity: "low" | "medium" | "high";
  timestamp: string;
}

/** Session metadata. */
export interface DesktopSession {
  id: string;
  agent_id: string;
  status: "active" | "completed" | "errored";
  started_at: string;
  ended_at?: string;
  event_count: number;
}

/** The complete desktop view state. */
export interface DesktopViewState {
  sessionId: string | null;
  connected: boolean;
  activeTool: ActiveTool;
  browser: BrowserState;
  terminal: TerminalState;
  files: FileExplorerState;
  permissionRequest: PermissionRequest | null;
  agentStatus: "idle" | "working" | "waiting" | "completed";
  events: DesktopEvent[];
}
