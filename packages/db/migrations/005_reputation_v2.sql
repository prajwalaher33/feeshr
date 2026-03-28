-- Migration 005: Categorical Reputation, Reviewer Trust, and Collusion Detection
-- Part of Feeshr V2 Reputation upgrade
-- Replaces flat reputation with per-category scores and adds reviewer accountability

-- ─── Categorical Reputation ─────────────────────────────────────
-- Instead of one number, agents have skill-specific reputation scores.
-- The overall reputation is the SUM of all category scores.

CREATE TABLE reputation_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    category            TEXT NOT NULL,  -- 'python', 'typescript', 'security', 'testing', etc.
    score               INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    -- Derived from peer reviews in this category
    review_count        INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    avg_review_score    DECIMAL(5,2) DEFAULT 0.0 CHECK (avg_review_score BETWEEN 0 AND 100),
    -- Trend
    score_30d_ago       INTEGER NOT NULL DEFAULT 0,
    trend               TEXT NOT NULL DEFAULT 'stable'
                        CHECK (trend IN ('rising', 'stable', 'declining')),
    last_activity_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, category)
);

CREATE INDEX idx_rep_cat_agent ON reputation_categories(agent_id);
CREATE INDEX idx_rep_cat_category ON reputation_categories(category, score DESC);

-- ─── Reviewer Trust Scores ──────────────────────────────────────
-- Tracks how accurate each reviewer's assessments are over time.
-- Updated when a PR is merged and later found to have bugs,
-- or when a rejected PR is re-evaluated.

CREATE TABLE reviewer_trust (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id         TEXT NOT NULL REFERENCES agents(id),
    -- Category-specific trust (a great Python reviewer may not be great at Rust)
    category            TEXT NOT NULL,
    -- Trust metrics
    reviews_given       INTEGER NOT NULL DEFAULT 0 CHECK (reviews_given >= 0),
    accurate_reviews    INTEGER NOT NULL DEFAULT 0 CHECK (accurate_reviews >= 0),
    missed_issues       INTEGER NOT NULL DEFAULT 0 CHECK (missed_issues >= 0),
    false_positives     INTEGER NOT NULL DEFAULT 0 CHECK (false_positives >= 0),
    -- Computed trust score: accurate / (accurate + missed + false_positives)
    trust_score         DECIMAL(5,4) NOT NULL DEFAULT 0.5
                        CHECK (trust_score BETWEEN 0 AND 1),
    -- How much weight this reviewer's opinion carries (multiplier on review scores)
    review_weight       DECIMAL(4,2) NOT NULL DEFAULT 1.0
                        CHECK (review_weight BETWEEN 0.1 AND 3.0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (reviewer_id, category)
);

CREATE INDEX idx_reviewer_trust_reviewer ON reviewer_trust(reviewer_id);
CREATE INDEX idx_reviewer_trust_category ON reviewer_trust(category, trust_score DESC);

-- ─── Review Outcome Tracking ────────────────────────────────────
-- Links a review verdict to what actually happened after merge.
-- This is how we know if a reviewer was right or wrong.

CREATE TABLE review_outcomes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id           UUID NOT NULL REFERENCES pr_reviews(id),
    pr_id               UUID NOT NULL REFERENCES pull_requests(id),
    reviewer_id         TEXT NOT NULL REFERENCES agents(id),
    -- What the reviewer said
    original_verdict    TEXT NOT NULL CHECK (original_verdict IN ('approve', 'request_changes', 'reject')),
    -- What actually happened
    outcome             TEXT NOT NULL CHECK (outcome IN (
        'correct_approve',      -- approved, no bugs found after merge
        'correct_reject',       -- rejected, author agreed changes were needed
        'missed_bug',           -- approved, but bug found within 14 days of merge
        'missed_security',      -- approved, but security issue found
        'false_reject',         -- rejected, but another reviewer approved and PR merged successfully
        'false_positive',       -- flagged issue that wasn't actually a problem
        'pending'               -- not enough time has passed to evaluate
    )),
    -- Evidence
    evidence_ref        TEXT,  -- link to the bug report, security finding, or re-review
    -- Time to outcome
    days_to_outcome     INTEGER,
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_outcomes_reviewer ON review_outcomes(reviewer_id, outcome);
CREATE INDEX idx_review_outcomes_pr ON review_outcomes(pr_id);
CREATE INDEX idx_review_outcomes_pending ON review_outcomes(created_at)
    WHERE outcome = 'pending';

-- ─── Reputation Decay Configuration ─────────────────────────────
-- Smart decay: proportional to tier, per-category

CREATE TABLE reputation_decay_log (
    id                  BIGSERIAL PRIMARY KEY,
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    category            TEXT NOT NULL,
    decay_amount        INTEGER NOT NULL CHECK (decay_amount < 0),
    reason              TEXT NOT NULL CHECK (reason IN ('inactivity', 'quality_decline')),
    -- What tier was the agent at when decay happened
    tier_at_decay       TEXT NOT NULL,
    -- How many days inactive
    inactive_days       INTEGER,
    old_score           INTEGER NOT NULL,
    new_score           INTEGER NOT NULL CHECK (new_score >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decay_log_agent ON reputation_decay_log(agent_id, created_at DESC);

-- ─── Collusion Detection ────────────────────────────────────────
-- Tracks review pairs to detect rubber-stamping

CREATE TABLE review_pair_stats (
    reviewer_id         TEXT NOT NULL REFERENCES agents(id),
    author_id           TEXT NOT NULL REFERENCES agents(id),
    -- How many times this reviewer approved this author
    approve_count       INTEGER NOT NULL DEFAULT 0,
    reject_count        INTEGER NOT NULL DEFAULT 0,
    change_request_count INTEGER NOT NULL DEFAULT 0,
    -- Computed approval rate for this specific pair
    pair_approval_rate  DECIMAL(5,4) DEFAULT 0.0,
    -- Platform average approval rate for comparison
    -- (if pair rate >> platform rate, flag for investigation)
    flagged             BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_at          TIMESTAMPTZ,
    last_review_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (reviewer_id, author_id)
);

CREATE INDEX idx_review_pairs_flagged ON review_pair_stats(flagged)
    WHERE flagged = TRUE;

-- ─── Modify Existing Tables ─────────────────────────────────────

-- Add categorical reputation reference to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    reputation_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Format: {"python": 450, "typescript": 200, "security": 150}
-- Total reputation = SUM of all category scores
-- This is a DENORMALIZED cache — source of truth is reputation_categories table

-- Add is_platform_agent flag to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    is_platform_agent BOOLEAN NOT NULL DEFAULT FALSE;

-- Platform agents are excluded from leaderboards and rankings
CREATE INDEX IF NOT EXISTS idx_agents_external ON agents(reputation DESC)
    WHERE is_platform_agent = FALSE;

-- Add category to reputation_events table
ALTER TABLE reputation_events ADD COLUMN IF NOT EXISTS
    category TEXT DEFAULT 'general';
-- Existing events get 'general', new events get specific category

-- Add review_weight to pr_reviews (how much this review counts)
ALTER TABLE pr_reviews ADD COLUMN IF NOT EXISTS
    effective_weight DECIMAL(4,2) DEFAULT 1.0;
-- Set from reviewer's trust_score at time of review
