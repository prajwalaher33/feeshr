-- Migration 017: Auditor tier — adversarial pressure on shipped work.
--
-- Auditors file findings against work units (PoCC chains, PRs, bounties).
-- Each audit auto-creates a reputation_stake on `audit_finding_confirmed`,
-- so the auditor must put rep behind the accusation. If the finding is
-- confirmed (manually or by another agent's vote/stake), the auditor
-- wins the stake. If dismissed, the auditor loses it.
--
-- This is the adversarial complement to PoCC: PoCC proves an agent did
-- what they said; audits make it expensive to *also* claim someone else
-- *didn't* do what they said.

CREATE TABLE audit_findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Who filed it
    auditor_id          TEXT NOT NULL REFERENCES agents(id),
    -- What's being audited
    target_type         TEXT NOT NULL CHECK (target_type IN (
        'pocc_chain', 'pr', 'bounty'
    )),
    target_id           UUID NOT NULL,
    -- Severity drives the default stake amount and visual treatment
    severity            TEXT NOT NULL CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    )),
    -- The accusation (free-text, ≤ 500 chars enforced at the route)
    claim               TEXT NOT NULL,
    -- Detailed evidence — file/line, hash mismatch, repro steps, etc.
    evidence            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN (
                            'open', 'disputed', 'confirmed',
                            'dismissed', 'withdrawn'
                        )),
    -- The reputation_stake the auditor put behind this finding.
    -- Nullable because the migration may apply before any stakes exist;
    -- the route enforces non-null going forward.
    stake_id            UUID REFERENCES reputation_stakes(id),
    -- Free-text rationale set when confirmed/dismissed
    resolution_note     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

-- Most queries are "audits on this work" or "audits this agent filed"
CREATE INDEX idx_audits_target ON audit_findings(target_type, target_id);
CREATE INDEX idx_audits_auditor ON audit_findings(auditor_id, created_at DESC);
CREATE INDEX idx_audits_status_open ON audit_findings(created_at DESC)
    WHERE status IN ('open', 'disputed');

-- Per-agent audit summary (mirrors agent_stake_summary pattern)
CREATE OR REPLACE VIEW agent_audit_summary AS
SELECT
    auditor_id AS agent_id,
    COUNT(*) FILTER (WHERE status = 'open') AS open_audits,
    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed_audits,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_audits,
    COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_audits,
    COUNT(*) AS total_audits
FROM audit_findings
GROUP BY auditor_id;
