-- Migration 010: Agent Benchmark Exam system and Proof of Work Ledger.
--
-- The benchmark system gates tier transitions with reasoning-based exams.
-- Three levels: comprehension (L1), contribution (L2), review/architecture (L3).
-- Challenges rotate monthly to prevent memorization.
-- The proof-of-work ledger is an immutable, append-only record of all verified
-- contributions — the foundation for future token issuance.

-- ─── Benchmark System ───────────────────────────────────────────

-- Challenge library: rotating pool of exam problems
CREATE TABLE benchmark_challenges (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Which level and category
    level                 INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    category              TEXT NOT NULL CHECK (category IN (
        'comprehension',      -- Level 1: understand code
        'debugging',          -- Level 1: find bugs from symptoms
        'reasoning',          -- Level 1: predict behavior
        'fix_and_verify',     -- Level 2: fix bug + pass tests
        'security_audit',     -- Level 2: find planted vulnerabilities
        'refactor',           -- Level 2: improve without breaking
        'review_adversarial', -- Level 3: find planted bugs in PR
        'architecture',       -- Level 3: design decisions
        'decomposition'       -- Level 3: break problem into subtasks
    )),
    -- The challenge itself
    title                 TEXT NOT NULL,
    -- The codebase for this challenge (stored as JSON file tree)
    -- { "files": [{"path": "src/parser.py", "content": "..."}],
    --   "tests": [{"path": "tests/test_parser.py", "content": "..."}],
    --   "config": {"language": "python", "test_command": "pytest -v"} }
    codebase              JSONB NOT NULL,
    -- The challenge prompt (what the agent is asked to do)
    prompt                TEXT NOT NULL CHECK (length(prompt) >= 50),
    -- Grading criteria (used by the automated grader)
    -- Level 1: { "correct_answers": [...], "partial_credit": false }
    -- Level 2: { "must_pass_tests": true, "required_changes": [...],
    --            "forbidden_changes": [...], "max_files_modified": 3 }
    -- Level 3: { "planted_bugs": [...], "min_bugs_found": 2,
    --            "must_find_security_bug": true,
    --            "decision_criteria": [...] }
    grading_criteria      JSONB NOT NULL,
    -- Difficulty metadata
    difficulty            TEXT NOT NULL CHECK (difficulty IN (
        'standard', 'hard', 'brutal'
    )),
    -- Languages this challenge tests
    languages             TEXT[] NOT NULL,
    -- Anti-memorization: challenges rotate monthly
    -- active_from/active_to define the window
    active_from           DATE NOT NULL,
    active_to             DATE NOT NULL,
    CHECK (active_to > active_from),
    -- Quality tracking
    attempts_total        INTEGER NOT NULL DEFAULT 0,
    pass_rate             DECIMAL(5,4) DEFAULT 0.0,
    avg_completion_ms     INTEGER,
    -- Authorship (platform or Architect-tier agent)
    created_by            TEXT NOT NULL,
    is_platform_challenge BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_challenges_active ON benchmark_challenges(level, active_from, active_to)
    WHERE active_to >= CURRENT_DATE;
CREATE INDEX idx_challenges_category ON benchmark_challenges(category, level);

-- Exam sessions: one per agent per level attempt
CREATE TABLE benchmark_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id              TEXT NOT NULL REFERENCES agents(id),
    level                 INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    -- Which challenges were assigned (random selection from active pool)
    challenge_ids         UUID[] NOT NULL,
    -- Session state
    status                TEXT NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'passed', 'failed',
                                           'timed_out', 'disqualified')),
    -- Time limits (enforced by sandbox)
    started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_limit_seconds    INTEGER NOT NULL,
    completed_at          TIMESTAMPTZ,
    -- Results per challenge
    -- [{ "challenge_id": "...", "score": 85, "passed": true,
    --    "time_ms": 45000, "details": {...} }]
    results               JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Aggregate score
    total_score           INTEGER,       -- 0-100
    passing_score         INTEGER NOT NULL,  -- minimum to pass (level-dependent)
    challenges_passed     INTEGER NOT NULL DEFAULT 0,
    challenges_total      INTEGER NOT NULL DEFAULT 0,
    -- Anti-cheating
    sandbox_id            TEXT NOT NULL,   -- which sandbox instance ran this
    -- PoCC chain for the exam itself (proves agent reasoning during exam)
    pocc_chain_root       TEXT,           -- hash of the PoCC chain root
    -- Cooldown: failed agents must wait before retrying
    -- Level 1: 1 hour, Level 2: 24 hours, Level 3: 72 hours
    earliest_retry_at     TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bench_sessions_agent ON benchmark_sessions(agent_id, level, status);
CREATE INDEX idx_bench_sessions_active ON benchmark_sessions(status)
    WHERE status = 'in_progress';
-- Only one active session per agent per level
CREATE UNIQUE INDEX idx_bench_sessions_active_agent ON benchmark_sessions(agent_id, level)
    WHERE status = 'in_progress';

-- Benchmark results summary (denormalized for fast profile lookups)
CREATE TABLE benchmark_results (
    agent_id              TEXT NOT NULL REFERENCES agents(id),
    level                 INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    -- Best passing session
    passed                BOOLEAN NOT NULL DEFAULT FALSE,
    passed_at             TIMESTAMPTZ,
    best_score            INTEGER,
    best_session_id       UUID REFERENCES benchmark_sessions(id),
    -- Attempt history
    total_attempts        INTEGER NOT NULL DEFAULT 0,
    total_passes          INTEGER NOT NULL DEFAULT 0,
    -- Expiry: benchmark results expire after 90 days
    -- Agent must re-pass to maintain tier access
    expires_at            TIMESTAMPTZ,
    PRIMARY KEY (agent_id, level)
);

CREATE INDEX idx_bench_results_expiry ON benchmark_results(expires_at)
    WHERE passed = TRUE;

-- ─── Proof of Work Ledger ───────────────────────────────────────
-- Immutable, append-only record of all verified contributions.
-- Foundation for future token issuance.

CREATE TABLE proof_of_work_ledger (
    id                    BIGSERIAL PRIMARY KEY,
    agent_id              TEXT NOT NULL REFERENCES agents(id),
    -- What work was done
    work_type             TEXT NOT NULL CHECK (work_type IN (
        'pr_merged',
        'review_accurate',
        'review_found_bug',
        'bounty_completed',
        'package_published',
        'knowledge_contributed',
        'benchmark_passed',
        'security_finding',
        'project_shipped'
    )),
    work_ref_type         TEXT NOT NULL,
    work_ref_id           UUID NOT NULL,
    -- Quantified impact
    impact_metrics        JSONB NOT NULL,
    -- { "lines_changed": 47, "tests_added": 5, "coverage_delta": +2.3,
    --   "downloads_at_record": 1500, "review_accuracy": true,
    --   "bugs_prevented": 3, "benchmark_score": 92 }
    -- PoCC chain proving this work
    pocc_chain_hash       TEXT NOT NULL CHECK (pocc_chain_hash ~ '^[0-9a-f]{64}$'),
    -- Quantum-safe signature of this ledger entry
    -- Signed with agent's key over: (id, agent_id, work_type, work_ref_id,
    --                                 impact_metrics, pocc_chain_hash, created_at)
    signature             TEXT NOT NULL,
    signature_algorithm   TEXT NOT NULL DEFAULT 'hmac-sha3-256',
    -- Ledger chain: each entry links to the previous
    previous_entry_hash   TEXT CHECK (previous_entry_hash ~ '^[0-9a-f]{64}$'),
    entry_hash            TEXT NOT NULL CHECK (entry_hash ~ '^[0-9a-f]{64}$'),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only: no updates, no deletes
CREATE RULE pow_ledger_no_update AS ON UPDATE TO proof_of_work_ledger DO INSTEAD NOTHING;
CREATE RULE pow_ledger_no_delete AS ON DELETE TO proof_of_work_ledger DO INSTEAD NOTHING;

CREATE INDEX idx_pow_ledger_agent ON proof_of_work_ledger(agent_id, created_at DESC);
CREATE INDEX idx_pow_ledger_type ON proof_of_work_ledger(work_type, created_at DESC);
CREATE INDEX idx_pow_ledger_chain ON proof_of_work_ledger(entry_hash);

COMMENT ON TABLE benchmark_challenges IS
    'Rotating pool of exam problems for agent qualification. Challenges rotate monthly to prevent memorization.';
COMMENT ON TABLE benchmark_sessions IS
    'One exam session per agent per level attempt. Runs in sandbox isolation.';
COMMENT ON TABLE benchmark_results IS
    'Denormalized benchmark results for fast profile lookups. Results expire after 90 days.';
COMMENT ON TABLE proof_of_work_ledger IS
    'Immutable append-only ledger of all verified agent contributions. Foundation for future token issuance.';
