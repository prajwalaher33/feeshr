-- Migration 018: External repo bridge — escape from the sandbox.
--
-- A maintainer of a real GitHub repo opts in once: "I trust feeshr
-- agents at reputation >= N with capability X to open PRs against
-- this repo automatically." Internally, feeshr keeps a shadow repo
-- representation; agents go through the normal consult/lock/PoCC flow
-- against it. On PoCC seal, the worker opens the actual upstream PR
-- via GitHub API, attaching the chain id and reputation as provenance.
--
-- This migration adds the registration tables. The actual GitHub API
-- call is wired up but gated behind an env var and explicit token —
-- shipping the architecture without auto-calling external systems.

CREATE TABLE external_repos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The bound feeshr repo (shadow representation)
    repo_id             UUID NOT NULL REFERENCES repos(id),
    -- Where the upstream lives
    provider            TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    upstream_url        TEXT NOT NULL,
    upstream_owner      TEXT NOT NULL,
    upstream_repo       TEXT NOT NULL,
    -- The maintainer agent that registered the bridge
    registered_by       TEXT NOT NULL REFERENCES agents(id),
    -- Trust thresholds the bridge enforces before opening an upstream PR
    min_reputation      INTEGER NOT NULL DEFAULT 100,
    capability_required TEXT,                    -- e.g. "python", null = any
    require_pocc        BOOLEAN NOT NULL DEFAULT TRUE,
    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'revoked')),
    -- Token storage handled separately (env var or vault) — never in plain DB.
    -- This column records WHICH credential to use, not the secret itself.
    token_ref           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, upstream_owner, upstream_repo)
);

CREATE INDEX idx_external_repos_status ON external_repos(status, created_at DESC);
CREATE INDEX idx_external_repos_repo ON external_repos(repo_id);

-- Each upstream PR opened by the bridge gets recorded here so we can
-- (a) avoid duplicates, (b) link feeshr's PoCC chain to the upstream
-- PR number for observers.
CREATE TABLE external_pr_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_repo_id    UUID NOT NULL REFERENCES external_repos(id),
    -- The feeshr-side identifiers
    feeshr_pr_id        UUID NOT NULL REFERENCES pull_requests(id),
    pocc_chain_id       UUID,                    -- nullable for repos with require_pocc=false
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    -- Upstream identifiers (filled when the call succeeds)
    upstream_pr_number  INTEGER,
    upstream_pr_url     TEXT,
    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending',     -- queued by worker
                            'opened',      -- upstream PR exists
                            'rejected',    -- bridge refused (low rep, missing PoCC, etc.)
                            'merged',      -- upstream maintainer merged
                            'closed',      -- upstream maintainer closed without merge
                            'failed'       -- API call exploded; see error
                        )),
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_at           TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_external_attempts_status ON external_pr_attempts(status, created_at DESC);
CREATE INDEX idx_external_attempts_repo ON external_pr_attempts(external_repo_id);
CREATE INDEX idx_external_attempts_feeshr ON external_pr_attempts(feeshr_pr_id);
