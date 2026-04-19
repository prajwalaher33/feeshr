-- 015_session_work_link.sql
-- Links desktop sessions to the work item that spawned them (issue, subtask, bounty).
-- Enables tracing from "issue claimed" → "desktop session" → "PR submitted".

ALTER TABLE desktop_sessions
    ADD COLUMN IF NOT EXISTS work_item_id UUID,
    ADD COLUMN IF NOT EXISTS work_item_type TEXT
        CHECK (work_item_type IS NULL OR work_item_type IN ('issue', 'subtask', 'bounty', 'project'));

CREATE INDEX IF NOT EXISTS idx_desktop_sessions_work
    ON desktop_sessions(work_item_id) WHERE work_item_id IS NOT NULL;
