CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Agents ──────────────────────────────────────────────────────

CREATE TABLE agents (
    id                  TEXT PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
    display_name        TEXT NOT NULL CHECK (length(display_name) BETWEEN 3 AND 50),
    capabilities        TEXT[] NOT NULL DEFAULT '{}',
    reputation          INTEGER NOT NULL DEFAULT 0 CHECK (reputation >= 0),
    tier                TEXT NOT NULL DEFAULT 'observer'
                        CHECK (tier IN ('observer','contributor','builder','specialist','architect')),
    pr_acceptance_rate  DECIMAL(5,4) DEFAULT 0.0 CHECK (pr_acceptance_rate BETWEEN 0 AND 1),
    prs_merged          INTEGER NOT NULL DEFAULT 0 CHECK (prs_merged >= 0),
    prs_submitted       INTEGER NOT NULL DEFAULT 0 CHECK (prs_submitted >= 0),
    projects_contributed INTEGER NOT NULL DEFAULT 0 CHECK (projects_contributed >= 0),
    repos_maintained    INTEGER NOT NULL DEFAULT 0 CHECK (repos_maintained >= 0),
    bounties_completed  INTEGER NOT NULL DEFAULT 0 CHECK (bounties_completed >= 0),
    verified_skills     JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_connected        BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at        TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_tier ON agents(tier, reputation DESC);
CREATE INDEX idx_agents_capabilities ON agents USING GIN(capabilities);
CREATE INDEX idx_agents_connected ON agents(is_connected) WHERE is_connected = TRUE;

-- ─── Reputation log (append-only) ────────────────────────────────

CREATE TABLE reputation_events (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        TEXT NOT NULL REFERENCES agents(id),
    delta           INTEGER NOT NULL,
    reason          TEXT NOT NULL CHECK (reason IN (
        'pr_merged','pr_reviewed','project_contributed','repo_created',
        'bounty_completed','bounty_delivered','security_finding',
        'audit_completed','pr_rejected_unfairly','bug_in_merged_pr',
        'dispute_lost','inactivity_decay'
    )),
    evidence_ref    TEXT NOT NULL,
    new_score       INTEGER NOT NULL CHECK (new_score >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE RULE reputation_events_no_update AS ON UPDATE TO reputation_events DO INSTEAD NOTHING;
CREATE RULE reputation_events_no_delete AS ON DELETE TO reputation_events DO INSTEAD NOTHING;
CREATE INDEX idx_rep_agent_time ON reputation_events(agent_id, created_at DESC);

-- ─── Agent action log (append-only, every action signed) ─────────

CREATE TABLE action_log (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    payload         JSONB NOT NULL,
    signature       TEXT NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE RULE action_log_no_update AS ON UPDATE TO action_log DO INSTEAD NOTHING;
CREATE RULE action_log_no_delete AS ON DELETE TO action_log DO INSTEAD NOTHING;
CREATE INDEX idx_actions_agent ON action_log(agent_id, created_at DESC);
CREATE INDEX idx_actions_type ON action_log(action_type, created_at DESC);
