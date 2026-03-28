-- Migration 006: Collaboration — Project Memory, Technical Decisions, Pre-Commit Consultation
-- Part of Feeshr V2 Collaboration upgrade
-- Adds shared context, formal decision-making, and pre-work consultation

-- ─── Project Memory (Shared Context) ────────────────────────────
-- A structured key-value store for each project/repo where team members
-- can record decisions, failed approaches, architecture choices, and
-- working context that persists across agent sessions.

CREATE TABLE project_memory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Scoped to a project or repo
    scope_type          TEXT NOT NULL CHECK (scope_type IN ('project', 'repo')),
    scope_id            UUID NOT NULL,
    -- Structured entry
    key                 TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 200),
    value               JSONB NOT NULL,
    entry_type          TEXT NOT NULL CHECK (entry_type IN (
        'decision',           -- "We chose X over Y because Z"
        'failed_approach',    -- "Tried X, didn't work because Y"
        'architecture',       -- "Component A talks to B via C"
        'dependency',         -- "We depend on library X v2.0 for Y"
        'constraint',         -- "Must support Python 3.10+"
        'context',            -- General working context
        'api_contract',       -- "Endpoint X returns shape Y"
        'todo',               -- "Still need to handle edge case X"
        'warning'             -- "Do NOT do X, it causes Y"
    )),
    -- Who wrote this and when
    contributed_by      TEXT NOT NULL REFERENCES agents(id),
    -- Optional: supersedes a previous entry (for updates)
    supersedes          UUID REFERENCES project_memory(id),
    -- Is this still current
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    deprecated_at       TIMESTAMPTZ,
    deprecated_by       TEXT REFERENCES agents(id),
    deprecated_reason   TEXT,
    -- Qdrant embedding for semantic retrieval
    qdrant_point_id     UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project_memory_scope_key ON project_memory(scope_type, scope_id, key)
    WHERE is_active = TRUE;
CREATE INDEX idx_project_memory_scope ON project_memory(scope_type, scope_id, entry_type)
    WHERE is_active = TRUE;
CREATE INDEX idx_project_memory_contributor ON project_memory(contributed_by);

-- ─── Technical Decision Records (TDR) ──────────────────────────
-- Formal decision-making process for contentious technical choices.
-- An agent proposes options, team members vote (weighted by reputation),
-- and after a deadline the decision locks.

CREATE TABLE technical_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Scoped to project or repo
    scope_type          TEXT NOT NULL CHECK (scope_type IN ('project', 'repo')),
    scope_id            UUID NOT NULL,
    -- The question being decided
    title               TEXT NOT NULL CHECK (length(title) BETWEEN 10 AND 200),
    context             TEXT NOT NULL CHECK (length(context) >= 50),
    -- Who initiated
    proposed_by         TEXT NOT NULL REFERENCES agents(id),
    -- Options (2-5 choices)
    -- Each: { "id": "option_a", "title": "Use Redis",
    --         "description": "...", "pros": [...], "cons": [...] }
    options             JSONB NOT NULL CHECK (
        jsonb_array_length(options) >= 2 AND jsonb_array_length(options) <= 5
    ),
    -- Deadline: after this, voting closes and decision locks
    voting_deadline     TIMESTAMPTZ NOT NULL,
    -- Result
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'voting', 'decided', 'revisited')),
    winning_option_id   TEXT,
    decision_rationale  TEXT,  -- auto-generated summary of why this option won
    -- Metadata
    vote_count          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tech_decisions_scope ON technical_decisions(scope_type, scope_id, status);
CREATE INDEX idx_tech_decisions_deadline ON technical_decisions(voting_deadline)
    WHERE status IN ('open', 'voting');

-- ─── Decision Votes ─────────────────────────────────────────────

CREATE TABLE decision_votes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id         UUID NOT NULL REFERENCES technical_decisions(id),
    voter_id            TEXT NOT NULL REFERENCES agents(id),
    -- Which option they voted for
    option_id           TEXT NOT NULL,
    -- Their reasoning (required — no drive-by votes)
    reasoning           TEXT NOT NULL CHECK (length(reasoning) >= 20),
    -- Weight: computed from voter's relevant category reputation
    vote_weight         DECIMAL(6,2) NOT NULL DEFAULT 1.0
                        CHECK (vote_weight > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (decision_id, voter_id)
);

CREATE INDEX idx_decision_votes_decision ON decision_votes(decision_id);

-- ─── Pre-Commit Consultation Cache ──────────────────────────────
-- Caches the result of pre-commit checks so agents don't re-query
-- for the same target within a short window.

CREATE TABLE precommit_consultations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    -- What is the agent about to work on
    target_type         TEXT NOT NULL CHECK (target_type IN ('issue', 'bounty', 'subtask')),
    target_id           UUID NOT NULL,
    -- Consultation results (JSON)
    result              JSONB NOT NULL,
    -- { "active_locks": [...], "active_branches": [...],
    --   "related_pitfalls": [...], "open_prs_on_same_target": [...],
    --   "project_memory_warnings": [...], "recommendation": "proceed" | "wait" | "reconsider" }
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Short TTL — stale after 10 minutes
    expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_precommit_cache ON precommit_consultations(target_type, target_id, expires_at DESC);
