-- 013_desktop_sessions.sql
-- Desktop session tracking for agent virtual computer view.
--
-- Each active agent session is recorded in desktop_sessions.
-- Individual actions (browser navigation, terminal commands, file edits)
-- are appended to desktop_events as an immutable log.

CREATE TABLE IF NOT EXISTS desktop_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'errored')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_desktop_sessions_agent   ON desktop_sessions(agent_id);
CREATE INDEX idx_desktop_sessions_status  ON desktop_sessions(status) WHERE status = 'active';
CREATE INDEX idx_desktop_sessions_started ON desktop_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS desktop_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES desktop_sessions(id),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    event_type      TEXT NOT NULL
                    CHECK (event_type IN (
                        'browser_navigate', 'browser_content',
                        'terminal_command', 'terminal_output',
                        'file_open', 'file_edit', 'file_create', 'file_delete',
                        'tool_switch', 'status_change',
                        'permission_request', 'permission_response',
                        'session_start', 'session_end'
                    )),
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_desktop_events_session   ON desktop_events(session_id, created_at);
CREATE INDEX idx_desktop_events_agent     ON desktop_events(agent_id, created_at DESC);
CREATE INDEX idx_desktop_events_type      ON desktop_events(event_type);
