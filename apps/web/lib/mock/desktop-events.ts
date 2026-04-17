import type { DesktopEvent } from "@/lib/types/desktop";

const SESSION_ID = "mock-session-001";

/** A scripted sequence of desktop events simulating an agent working on a bug fix. */
export const MOCK_DESKTOP_SEQUENCE: Omit<DesktopEvent, "created_at">[] = [
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "session_start",
    payload: { task: "Fix authentication timeout in login flow" },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_command",
    payload: { command: "git clone https://github.com/feeshr/auth-service.git", cwd: "~/workspace" },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_output",
    payload: { output: "Cloning into 'auth-service'...\nremote: Enumerating objects: 1247, done.\nremote: Total 1247, done.\nReceiving objects: 100%", running: false },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_command",
    payload: { command: "cd auth-service && cat src/middleware/session.ts", cwd: "~/workspace/auth-service" },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_output",
    payload: {
      output: `import { NextRequest } from 'next/server';\nimport { getSession } from '../lib/auth';\n\nexport async function sessionMiddleware(req: NextRequest) {\n  const session = await getSession(req);\n  if (!session) {\n    return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  }\n  // BUG: timeout not configurable\n  const timeout = 3600;\n  if (Date.now() - session.created > timeout * 1000) {\n    return Response.json({ error: 'Session expired' }, { status: 401 });\n  }\n}`,
      running: false,
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "file_open",
    payload: {
      path: "src/middleware/session.ts",
      name: "session.ts",
      content: `import { NextRequest } from 'next/server';\nimport { getSession } from '../lib/auth';\n\nexport async function sessionMiddleware(req: NextRequest) {\n  const session = await getSession(req);\n  if (!session) {\n    return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  }\n  // BUG: timeout not configurable\n  const timeout = 3600;\n  if (Date.now() - session.created > timeout * 1000) {\n    return Response.json({ error: 'Session expired' }, { status: 401 });\n  }\n}`,
      language: "typescript",
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "browser_navigate",
    payload: {
      url: "https://github.com/feeshr/auth-service/issues/42",
      title: "Issue #42: Session timeout not configurable",
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "browser_content",
    payload: {
      title: "Issue #42: Session timeout not configurable",
      content: "<h1>Session timeout not configurable</h1><p>The session middleware uses a hardcoded timeout of 3600 seconds. This should be configurable via environment variable SESSION_TIMEOUT_SECONDS.</p><p><strong>Expected:</strong> Timeout reads from process.env.SESSION_TIMEOUT_SECONDS</p><p><strong>Actual:</strong> Hardcoded to 3600</p>",
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "file_open",
    payload: {
      path: "src/config.ts",
      name: "config.ts",
      content: `export const config = {\n  port: parseInt(process.env.PORT ?? '3000'),\n  dbUrl: process.env.DATABASE_URL ?? '',\n  jwtSecret: process.env.JWT_SECRET ?? '',\n};`,
      language: "typescript",
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "file_edit",
    payload: {
      path: "src/config.ts",
      content: `export const config = {\n  port: parseInt(process.env.PORT ?? '3000'),\n  dbUrl: process.env.DATABASE_URL ?? '',\n  jwtSecret: process.env.JWT_SECRET ?? '',\n  sessionTimeoutSeconds: parseInt(process.env.SESSION_TIMEOUT_SECONDS ?? '3600'),\n};`,
      highlights: [{ line: 5, type: "added" }],
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "file_edit",
    payload: {
      path: "src/middleware/session.ts",
      content: `import { NextRequest } from 'next/server';\nimport { getSession } from '../lib/auth';\nimport { config } from '../config';\n\nexport async function sessionMiddleware(req: NextRequest) {\n  const session = await getSession(req);\n  if (!session) {\n    return Response.json({ error: 'Unauthorized' }, { status: 401 });\n  }\n  const timeout = config.sessionTimeoutSeconds;\n  if (Date.now() - session.created > timeout * 1000) {\n    return Response.json({ error: 'Session expired' }, { status: 401 });\n  }\n}`,
      highlights: [
        { line: 3, type: "added" },
        { line: 10, type: "modified" },
      ],
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_command",
    payload: { command: "npm test -- --grep 'session'", cwd: "~/workspace/auth-service" },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_output",
    payload: {
      output: "PASS src/middleware/__tests__/session.test.ts\n  sessionMiddleware\n    ✓ rejects expired sessions (12ms)\n    ✓ accepts valid sessions (3ms)\n    ✓ reads timeout from config (5ms)\n\nTest Suites: 1 passed, 1 total\nTests:       3 passed, 3 total",
      running: false,
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "permission_request",
    payload: {
      id: "perm-001",
      action: "git push",
      description: "Push fix for session timeout to origin/fix/session-timeout",
      resource: "github.com/feeshr/auth-service",
      severity: "medium",
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "permission_response",
    payload: { id: "perm-001", approved: true },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_command",
    payload: { command: "git push origin fix/session-timeout", cwd: "~/workspace/auth-service" },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "terminal_output",
    payload: {
      output: "Enumerating objects: 7, done.\nCounting objects: 100%\nTotal 4 (delta 2), reused 0 (delta 0)\nTo github.com:feeshr/auth-service.git\n * [new branch]      fix/session-timeout -> fix/session-timeout",
      running: false,
    },
  },
  {
    session_id: SESSION_ID,
    agent_id: "",
    event_type: "status_change",
    payload: { status: "completed" },
  },
];

/**
 * Returns a mock desktop event with the given agent ID and a timestamp
 * offset by `index * 2` seconds from now.
 */
export function getMockDesktopEvent(agentId: string, index: number): DesktopEvent {
  const template = MOCK_DESKTOP_SEQUENCE[index % MOCK_DESKTOP_SEQUENCE.length];
  return {
    ...template,
    agent_id: agentId,
    created_at: new Date(Date.now() - (MOCK_DESKTOP_SEQUENCE.length - index) * 2000).toISOString(),
  };
}
