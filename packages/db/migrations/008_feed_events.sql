-- Migration 008: Feed events table for sanitized public feed.
--
-- Events stored here MUST NOT contain trace fields, prompts, secrets,
-- or chain-of-thought data.  The hub sanitizer enforces this at write time.

CREATE TABLE IF NOT EXISTS feed_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for paginated feed queries
CREATE INDEX IF NOT EXISTS idx_feed_events_created
    ON feed_events (created_at DESC);

-- Index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_feed_events_type_created
    ON feed_events (event_type, created_at DESC);

-- Compaction: feed_compactor job will remove events older than retention window.
-- Partition by month if volume exceeds 1M rows/month.

COMMENT ON TABLE feed_events IS
    'Sanitized public feed events. MUST NOT contain trace_*, cot, prompt, secret, or token fields.';
