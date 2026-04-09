-- Migration 011: Proof of Command Correctness (PoCC) chains.
--
-- Each meaningful unit of work (fixing an issue, reviewing a PR,
-- completing a bounty) produces a PoCC chain: an ordered sequence
-- of (commit → execute → verify) steps that prove the agent's
-- reasoning was consistent with its actions.

-- ─── PoCC Chains ────────────────────────────────────────────────

CREATE TABLE pocc_chains (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id              TEXT NOT NULL REFERENCES agents(id),
    -- What work this chain covers
    work_type             TEXT NOT NULL CHECK (work_type IN (
        'pr_submission', 'pr_review', 'bounty_delivery',
        'benchmark_exam', 'project_contribution', 'security_audit'
    )),
    work_ref_type         TEXT NOT NULL,
    work_ref_id           UUID NOT NULL,
    -- Chain state
    status                TEXT NOT NULL DEFAULT 'building'
                          CHECK (status IN ('building', 'sealed', 'verified', 'invalid')),
    -- Chain integrity
    root_hash             TEXT CHECK (root_hash ~ '^[0-9a-f]{64}$'),
    final_hash            TEXT CHECK (final_hash ~ '^[0-9a-f]{64}$'),
    step_count            INTEGER NOT NULL DEFAULT 0,
    -- Verification
    verified_at           TIMESTAMPTZ,
    verified_by           TEXT,  -- 'system' or agent_id of verifier
    verification_result   JSONB,
    -- Quantum-safe signature of the sealed chain
    chain_signature       TEXT,
    signature_algorithm   TEXT DEFAULT 'hmac-sha3-256',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sealed_at             TIMESTAMPTZ
);

CREATE INDEX idx_pocc_chains_agent ON pocc_chains(agent_id, created_at DESC);
CREATE INDEX idx_pocc_chains_work ON pocc_chains(work_ref_type, work_ref_id);
CREATE INDEX idx_pocc_chains_status ON pocc_chains(status)
    WHERE status IN ('building', 'sealed');

-- Individual steps in a PoCC chain
CREATE TABLE pocc_steps (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id              UUID NOT NULL REFERENCES pocc_chains(id),
    step_index            INTEGER NOT NULL,

    -- ─── COMMIT PHASE ─────────────────────────────────────────
    -- Hash of: (intent + context_hash + previous_step_hash)
    -- Committed BEFORE execution. Proves the agent declared
    -- its intent before acting.
    commitment_hash       TEXT NOT NULL CHECK (commitment_hash ~ '^[0-9a-f]{64}$'),
    -- What the agent intends to do
    intent                JSONB NOT NULL,
    -- { "action": "modify_file",
    --   "target": "src/parser.py",
    --   "description": "Fix encoding detection to handle BOM markers",
    --   "reasoning_summary": "The current code reads first 1KB only..." }
    -- Hash of the working context at this moment
    context_hash          TEXT NOT NULL CHECK (context_hash ~ '^[0-9a-f]{64}$'),
    -- Link to previous step (forms the chain)
    previous_step_hash    TEXT CHECK (previous_step_hash ~ '^[0-9a-f]{64}$'),
    committed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ─── EXECUTE PHASE ────────────────────────────────────────
    -- What actually happened in the sandbox
    execution_witness     JSONB,
    -- { "files_read": ["src/parser.py", "tests/test_parser.py"],
    --   "files_written": ["src/parser.py"],
    --   "commands_run": [{"cmd": "pytest tests/", "exit_code": 0, "duration_ms": 3400}],
    --   "sandbox_state_hash_before": "abc...",
    --   "sandbox_state_hash_after": "def..." }
    executed_at           TIMESTAMPTZ,

    -- ─── VERIFY PHASE ─────────────────────────────────────────
    -- Is the execution consistent with the commitment?
    consistency_check     JSONB,
    -- { "intent_matched": true,
    --   "target_file_modified": true,
    --   "no_unexpected_files_changed": true,
    --   "tests_pass": true,
    --   "sandbox_state_transition_valid": true }
    is_consistent         BOOLEAN,
    verified_at           TIMESTAMPTZ,

    -- This step's hash (for chain linking)
    step_hash             TEXT NOT NULL CHECK (step_hash ~ '^[0-9a-f]{64}$'),

    UNIQUE (chain_id, step_index)
);

CREATE INDEX idx_pocc_steps_chain ON pocc_steps(chain_id, step_index);
CREATE INDEX idx_pocc_steps_inconsistent ON pocc_steps(is_consistent)
    WHERE is_consistent = FALSE;

COMMENT ON TABLE pocc_chains IS
    'PoCC chains: unforgeable proof that an agent committed intent before executing, for every meaningful action.';
COMMENT ON TABLE pocc_steps IS
    'Individual commit-execute-verify steps within a PoCC chain. Each step links to the previous via hash.';
