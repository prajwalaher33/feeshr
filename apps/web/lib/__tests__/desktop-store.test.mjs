/**
 * Desktop store tests — runs with `node --test`.
 *
 * Tests the desktop store's event processing logic to verify that
 * each desktop event type correctly updates the corresponding state slice.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Inline store logic for testing (no JSX/React dependency) ────

const MAX_TERMINAL_LINES = 500;
const MAX_EVENTS = 1000;

function createInitialState() {
  return {
    sessionId: null,
    connected: false,
    activeTool: "terminal",
    browser: { url: "", title: "", content: "", loading: false, history: [] },
    terminal: { lines: [], cwd: "~", running: false },
    files: { tree: [], openFiles: [], activeFile: null },
    permissionRequest: null,
    agentStatus: "idle",
    events: [],
  };
}

function processEvent(state, event) {
  const events = [event, ...state.events].slice(0, MAX_EVENTS);
  const sessionId = event.session_id ?? state.sessionId;
  const p = event.payload;

  switch (event.event_type) {
    case "session_start":
      return {
        ...createInitialState(),
        sessionId,
        connected: true,
        agentStatus: "working",
        events,
      };

    case "session_end":
      return { ...state, agentStatus: "completed", events };

    case "browser_navigate":
      return {
        ...state,
        events,
        activeTool: "browser",
        browser: {
          ...state.browser,
          url: p.url ?? state.browser.url,
          title: p.title ?? "",
          loading: true,
          history: [...state.browser.history, p.url ?? ""],
        },
      };

    case "browser_content":
      return {
        ...state,
        events,
        browser: {
          ...state.browser,
          content: p.content ?? "",
          title: p.title ?? state.browser.title,
          loading: false,
        },
      };

    case "terminal_command": {
      const line = { type: "command", text: p.command ?? "", timestamp: event.created_at };
      return {
        ...state,
        events,
        activeTool: "terminal",
        terminal: {
          ...state.terminal,
          lines: [...state.terminal.lines, line].slice(-MAX_TERMINAL_LINES),
          cwd: p.cwd ?? state.terminal.cwd,
          running: true,
        },
      };
    }

    case "terminal_output": {
      const outLine = {
        type: p.is_error ? "error" : "output",
        text: p.output ?? "",
        timestamp: event.created_at,
      };
      return {
        ...state,
        events,
        terminal: {
          ...state.terminal,
          lines: [...state.terminal.lines, outLine].slice(-MAX_TERMINAL_LINES),
          running: p.running ?? false,
        },
      };
    }

    case "file_open": {
      const filePath = p.path ?? "";
      const exists = state.files.openFiles.some((f) => f.path === filePath);
      const newFile = {
        path: filePath,
        name: p.name ?? filePath.split("/").pop() ?? "",
        content: p.content ?? "",
        language: p.language ?? "text",
      };
      return {
        ...state,
        events,
        activeTool: "editor",
        files: {
          ...state.files,
          openFiles: exists ? state.files.openFiles : [...state.files.openFiles, newFile],
          activeFile: filePath,
        },
      };
    }

    case "file_edit": {
      const editPath = p.path ?? "";
      return {
        ...state,
        events,
        activeTool: "editor",
        files: {
          ...state.files,
          openFiles: state.files.openFiles.map((f) =>
            f.path === editPath
              ? { ...f, content: p.content ?? f.content, highlights: p.highlights ?? f.highlights }
              : f,
          ),
          activeFile: editPath,
        },
      };
    }

    case "tool_switch":
      return { ...state, events, activeTool: p.tool ?? state.activeTool };

    case "status_change":
      return { ...state, events, agentStatus: p.status ?? state.agentStatus };

    case "permission_request":
      return {
        ...state,
        events,
        permissionRequest: {
          id: p.id ?? "",
          action: p.action ?? "",
          description: p.description ?? "",
          resource: p.resource ?? "",
          severity: p.severity ?? "medium",
          timestamp: event.created_at,
        },
      };

    case "permission_response":
      return { ...state, events, permissionRequest: null };

    default:
      return { ...state, events };
  }
}

function makeEvent(type, payload = {}) {
  return {
    session_id: "sess-001",
    agent_id: "agent-001",
    event_type: type,
    payload,
    created_at: new Date().toISOString(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("Desktop store: processEvent", () => {
  let state;

  beforeEach(() => {
    state = createInitialState();
  });

  it("session_start resets state and sets working status", () => {
    state = processEvent(state, makeEvent("session_start", { task: "Fix bug" }));
    assert.equal(state.sessionId, "sess-001");
    assert.equal(state.agentStatus, "working");
    assert.equal(state.connected, true);
    assert.equal(state.events.length, 1);
  });

  it("session_end sets completed status", () => {
    state = processEvent(state, makeEvent("session_start"));
    state = processEvent(state, makeEvent("session_end"));
    assert.equal(state.agentStatus, "completed");
  });

  it("browser_navigate updates URL and sets loading", () => {
    state = processEvent(state, makeEvent("browser_navigate", {
      url: "https://example.com",
      title: "Example",
    }));
    assert.equal(state.browser.url, "https://example.com");
    assert.equal(state.browser.loading, true);
    assert.equal(state.activeTool, "browser");
    assert.equal(state.browser.history.length, 1);
  });

  it("browser_content clears loading and sets content", () => {
    state = processEvent(state, makeEvent("browser_navigate", { url: "https://x.com" }));
    state = processEvent(state, makeEvent("browser_content", {
      content: "<h1>Hello</h1>",
      title: "Page Title",
    }));
    assert.equal(state.browser.loading, false);
    assert.equal(state.browser.content, "<h1>Hello</h1>");
    assert.equal(state.browser.title, "Page Title");
  });

  it("terminal_command appends a command line and sets running", () => {
    state = processEvent(state, makeEvent("terminal_command", {
      command: "ls -la",
      cwd: "/home/agent",
    }));
    assert.equal(state.terminal.lines.length, 1);
    assert.equal(state.terminal.lines[0].type, "command");
    assert.equal(state.terminal.lines[0].text, "ls -la");
    assert.equal(state.terminal.cwd, "/home/agent");
    assert.equal(state.terminal.running, true);
    assert.equal(state.activeTool, "terminal");
  });

  it("terminal_output appends output and clears running", () => {
    state = processEvent(state, makeEvent("terminal_command", { command: "echo hi" }));
    state = processEvent(state, makeEvent("terminal_output", {
      output: "hi",
      running: false,
    }));
    assert.equal(state.terminal.lines.length, 2);
    assert.equal(state.terminal.lines[1].type, "output");
    assert.equal(state.terminal.running, false);
  });

  it("terminal_output marks errors correctly", () => {
    state = processEvent(state, makeEvent("terminal_output", {
      output: "command not found",
      is_error: true,
      running: false,
    }));
    assert.equal(state.terminal.lines[0].type, "error");
  });

  it("file_open adds file to open files and sets editor active", () => {
    state = processEvent(state, makeEvent("file_open", {
      path: "src/index.ts",
      name: "index.ts",
      content: "console.log('hi');",
      language: "typescript",
    }));
    assert.equal(state.files.openFiles.length, 1);
    assert.equal(state.files.activeFile, "src/index.ts");
    assert.equal(state.activeTool, "editor");
  });

  it("file_open does not duplicate already-open files", () => {
    state = processEvent(state, makeEvent("file_open", { path: "a.ts", content: "x" }));
    state = processEvent(state, makeEvent("file_open", { path: "a.ts", content: "y" }));
    assert.equal(state.files.openFiles.length, 1);
  });

  it("file_edit updates content and highlights of open file", () => {
    state = processEvent(state, makeEvent("file_open", { path: "a.ts", content: "old" }));
    state = processEvent(state, makeEvent("file_edit", {
      path: "a.ts",
      content: "new",
      highlights: [{ line: 1, type: "modified" }],
    }));
    assert.equal(state.files.openFiles[0].content, "new");
    assert.equal(state.files.openFiles[0].highlights.length, 1);
  });

  it("tool_switch changes the active tool", () => {
    state = processEvent(state, makeEvent("tool_switch", { tool: "browser" }));
    assert.equal(state.activeTool, "browser");
  });

  it("status_change updates agent status", () => {
    state = processEvent(state, makeEvent("status_change", { status: "waiting" }));
    assert.equal(state.agentStatus, "waiting");
  });

  it("permission_request sets the permission dialog", () => {
    state = processEvent(state, makeEvent("permission_request", {
      id: "perm-1",
      action: "git push",
      description: "Push to main",
      resource: "github.com/repo",
      severity: "high",
    }));
    assert.notEqual(state.permissionRequest, null);
    assert.equal(state.permissionRequest.action, "git push");
    assert.equal(state.permissionRequest.severity, "high");
  });

  it("permission_response clears the permission dialog", () => {
    state = processEvent(state, makeEvent("permission_request", { id: "p" }));
    state = processEvent(state, makeEvent("permission_response", { id: "p", approved: true }));
    assert.equal(state.permissionRequest, null);
  });

  it("events list is capped at MAX_EVENTS", () => {
    for (let i = 0; i < MAX_EVENTS + 50; i++) {
      state = processEvent(state, makeEvent("status_change", { status: "working" }));
    }
    assert.equal(state.events.length, MAX_EVENTS);
  });

  it("full workflow processes correctly", () => {
    // Simulate a complete agent workflow
    state = processEvent(state, makeEvent("session_start", { task: "Fix auth bug" }));
    assert.equal(state.agentStatus, "working");

    state = processEvent(state, makeEvent("terminal_command", { command: "git clone repo" }));
    state = processEvent(state, makeEvent("terminal_output", { output: "Cloning...", running: false }));

    state = processEvent(state, makeEvent("browser_navigate", { url: "https://github.com/issue/42" }));
    state = processEvent(state, makeEvent("browser_content", { content: "<p>Bug report</p>" }));

    state = processEvent(state, makeEvent("file_open", { path: "src/auth.ts", content: "old code" }));
    state = processEvent(state, makeEvent("file_edit", {
      path: "src/auth.ts",
      content: "fixed code",
      highlights: [{ line: 5, type: "modified" }],
    }));

    state = processEvent(state, makeEvent("permission_request", {
      id: "p1",
      action: "git push",
      description: "Push fix",
      resource: "origin/fix-branch",
      severity: "medium",
    }));
    assert.notEqual(state.permissionRequest, null);

    state = processEvent(state, makeEvent("permission_response", { approved: true }));
    assert.equal(state.permissionRequest, null);

    state = processEvent(state, makeEvent("session_end"));
    assert.equal(state.agentStatus, "completed");
    // session_start resets events, so total is events after the reset
    assert.equal(state.events.length, 10);
    assert.equal(state.terminal.lines.length, 2);
    assert.equal(state.browser.url, "https://github.com/issue/42");
    assert.equal(state.files.openFiles.length, 1);
    assert.equal(state.files.openFiles[0].content, "fixed code");
  });
});
