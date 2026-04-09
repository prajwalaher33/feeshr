-- ─── Quantum-Safe Signature Upgrade ─────────────────────────────

-- Store agent's public material for HMAC verification (was missing from V1)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    public_material     TEXT NOT NULL DEFAULT '';

-- Store agent's post-quantum public key alongside existing identity
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_public_key       BYTEA;          -- SPHINCS+ public key (32-64 bytes)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_key_algorithm    TEXT DEFAULT NULL
                        CHECK (pq_key_algorithm IN ('sphincs-sha3-256f', 'sphincs-sha3-256s',
                                                     'sphincs-sha3-192f', 'sphincs-sha3-192s',
                                                     NULL));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    pq_key_created_at   TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS
    signature_mode      TEXT NOT NULL DEFAULT 'hmac'
                        CHECK (signature_mode IN ('hmac', 'sphincs', 'hybrid'));
-- 'hmac': legacy HMAC-SHA3-256 only
-- 'sphincs': SPHINCS+ only (post-transition)
-- 'hybrid': accepts both, prefers SPHINCS+ (transition period)

-- Track key rotation history for post-quantum keys
CREATE TABLE IF NOT EXISTS pq_key_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    algorithm           TEXT NOT NULL,
    public_key          BYTEA NOT NULL,
    -- Key lifecycle
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'rotated', 'revoked')),
    activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    revocation_reason   TEXT,
    -- Which key replaced this one
    replaced_by         UUID REFERENCES pq_key_history(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pq_key_agent ON pq_key_history(agent_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pq_key_active ON pq_key_history(agent_id)
    WHERE status = 'active';

-- Update action_log to support both signature types
ALTER TABLE action_log ADD COLUMN IF NOT EXISTS
    signature_algorithm TEXT NOT NULL DEFAULT 'hmac-sha3-256';
-- Values: 'hmac-sha3-256', 'sphincs-sha3-256f', 'sphincs-sha3-256s'

-- Update proof_of_work_ledger — already has signature_algorithm column (V5)
-- Just ensure it accepts the new values
ALTER TABLE proof_of_work_ledger DROP CONSTRAINT IF EXISTS
    proof_of_work_ledger_signature_algorithm_check;
ALTER TABLE proof_of_work_ledger ADD CONSTRAINT
    proof_of_work_ledger_signature_algorithm_check
    CHECK (signature_algorithm IN ('hmac-sha3-256',
                                    'sphincs-sha3-256f', 'sphincs-sha3-256s'));

-- Update PoCC chains — already has signature_algorithm column (V5)
ALTER TABLE pocc_chains DROP CONSTRAINT IF EXISTS
    pocc_chains_signature_algorithm_check;
ALTER TABLE pocc_chains ADD CONSTRAINT
    pocc_chains_signature_algorithm_check
    CHECK (signature_algorithm IN ('hmac-sha3-256',
                                    'sphincs-sha3-256f', 'sphincs-sha3-256s',
                                    NULL));

-- ─── Quantum Readiness Tracking ─────────────────────────────────
-- Track the platform's migration progress toward full quantum safety

CREATE TABLE IF NOT EXISTS quantum_readiness_log (
    id                  BIGSERIAL PRIMARY KEY,
    event_type          TEXT NOT NULL CHECK (event_type IN (
        'agent_upgraded_to_sphincs',
        'agent_created_with_sphincs',
        'hmac_only_agent_warning',
        'hmac_deprecation_enforced',
        'oidc_quantum_vulnerable_detected',
        'oidc_quantum_safe_detected',
        'tls_pq_handshake_success',
        'tls_pq_handshake_failure',
        'daily_readiness_snapshot'
    )),
    agent_id            TEXT,
    details             JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quantum_log_type ON quantum_readiness_log(event_type, created_at DESC);
