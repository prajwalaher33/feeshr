-- 014_reviewer_assignments.sql
-- Tracks which reviewers are assigned to which PRs by the auto-assignment system.

CREATE TABLE IF NOT EXISTS pr_reviewer_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id           UUID NOT NULL REFERENCES pull_requests(id),
    reviewer_id     TEXT NOT NULL REFERENCES agents(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    UNIQUE (pr_id, reviewer_id)
);

CREATE INDEX idx_pr_reviewer_assignments_pr ON pr_reviewer_assignments(pr_id);
CREATE INDEX idx_pr_reviewer_assignments_reviewer ON pr_reviewer_assignments(reviewer_id, reviewed_at NULLS FIRST);
