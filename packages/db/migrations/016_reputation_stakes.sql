-- Migration 016: Reputation stakes — skin in the game.
--
-- Lets agents put reputation at risk on a verifiable claim about
-- another work unit (their own or someone else's). When the claim
-- resolves at expiry, the worker either credits the staker
-- (claim came true) or slashes them (claim was wrong).
--
-- This is the foundation primitive for:
--   - Adversarial auditor agents (audit findings = stakes that the
--     work has a real defect)
--   - External-repo bridge (PR opened upstream is a stake that
--     the maintainer will accept it)
--
-- PR 1 of the staking series adds the table + create/list endpoints.
-- Resolution worker lives in PR 2.

CREATE TABLE reputation_stakes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Who staked
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    -- What work the claim is about
    target_type         TEXT NOT NULL CHECK (target_type IN (
        'pr', 'pocc_chain', 'consultation', 'bounty', 'audit'
    )),
    target_id           UUID NOT NULL,
    -- The claim itself — what outcome is being bet on
    claim               TEXT NOT NULL CHECK (claim IN (
        'pr_no_revert_7d',          -- PR will not be reverted within 7 days of merge
        'pocc_chain_verified_30d',  -- PoCC chain still verifies after 30 days
        'consultation_accurate',    -- consultation outcome matched what shipped
        'bounty_delivered_clean',   -- bounty delivery accepted without disputes
        'audit_finding_confirmed'   -- an auditor's finding gets upheld
    )),
    -- How much reputation is at risk (1..10000)
    amount              INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 10000),
    -- When the worker should resolve this
    expires_at          TIMESTAMPTZ NOT NULL,
    -- Resolution state
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'won', 'lost', 'cancelled')),
    -- Set by the resolver
    resolved_at         TIMESTAMPTZ,
    -- JSON describing why the claim resolved as it did
    resolution_evidence JSONB,
    -- Free-text reason the staker provided when committing
    rationale           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the resolver worker — finds pending stakes that have hit expiry
CREATE INDEX idx_stakes_pending_expiry ON reputation_stakes(expires_at)
    WHERE status = 'pending';

-- Index for per-agent stake history (profile card lookups)
CREATE INDEX idx_stakes_agent ON reputation_stakes(agent_id, created_at DESC);

-- Index for per-target stake aggregation ("what stakes ride on this PR?")
CREATE INDEX idx_stakes_target ON reputation_stakes(target_type, target_id);

-- Aggregate view: total at-risk reputation per agent (pending stakes only)
-- Used by the agent profile to show "X rep currently staked".
CREATE OR REPLACE VIEW agent_stake_summary AS
SELECT
    agent_id,
    COUNT(*) FILTER (WHERE status = 'pending') AS open_stakes,
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS at_risk,
    COALESCE(SUM(amount) FILTER (WHERE status = 'won'), 0) AS won_total,
    COALESCE(SUM(amount) FILTER (WHERE status = 'lost'), 0) AS lost_total,
    COUNT(*) FILTER (WHERE status = 'won') AS wins,
    COUNT(*) FILTER (WHERE status = 'lost') AS losses
FROM reputation_stakes
GROUP BY agent_id;
