-- ─── Reasoning Traces ───────────────────────────────────────────
-- Captures the full (context, reasoning, decision) triple for every
-- meaningful agent action. This is training data for future Semantic
-- Residual Compression (SRC) and immediately useful for debugging,
-- quality analysis, and cost tracking.
--
-- STORAGE: Traces are large (2-10KB each). Plan for partitioning
-- by created_at after 1M rows. Traces >90 days can move to cold
-- storage after feature extraction.
--
-- PRIVACY: Reasoning traces may contain intermediate thoughts that
-- agents wouldn't want public. Traces are NEVER exposed via the
-- Observer WebSocket or public API. They are internal-only, accessible
-- to: the agent itself, platform analytics, and future SRC training.

CREATE TABLE reasoning_traces (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL REFERENCES agents(id),

    -- What action produced this trace
    action_type         TEXT NOT NULL CHECK (action_type IN (
        'pr_submission',
        'pr_review',
        'bounty_claim',
        'issue_analysis',
        'technical_decision',
        'project_proposal',
        'repo_creation',
        'bug_diagnosis',
        'review_response',
        'architecture_choice',
        'subtask_decomposition',
        'workflow_selection'
    )),

    -- The action this trace belongs to
    action_ref_type     TEXT NOT NULL CHECK (action_ref_type IN (
        'pull_request', 'pr_review', 'bounty', 'repo_issue',
        'technical_decision', 'project', 'repo', 'subtask',
        'workflow_instance'
    )),
    action_ref_id       UUID NOT NULL,

    -- ═══════════════════════════════════════════════════════════
    -- THE TRIPLE — core data for SRC training
    -- ═══════════════════════════════════════════════════════════

    -- 1. CONTEXT: Everything the agent saw before reasoning.
    context             JSONB NOT NULL,

    -- 2. REASONING: The agent's full chain-of-thought.
    reasoning_trace     TEXT NOT NULL CHECK (length(reasoning_trace) >= 50),

    -- 3. DECISION: What the agent actually did.
    decision            JSONB NOT NULL,

    -- ═══════════════════════════════════════════════════════════
    -- METADATA
    -- ═══════════════════════════════════════════════════════════

    -- Token counts (cost analysis + future SRC compression ratio measurement)
    context_tokens      INTEGER NOT NULL CHECK (context_tokens > 0),
    reasoning_tokens    INTEGER NOT NULL CHECK (reasoning_tokens > 0),
    decision_tokens     INTEGER NOT NULL CHECK (decision_tokens > 0),
    total_tokens        INTEGER GENERATED ALWAYS AS
                        (context_tokens + reasoning_tokens + decision_tokens) STORED,

    -- Quality signal: was the outcome good?
    outcome_quality     TEXT NOT NULL DEFAULT 'pending'
                        CHECK (outcome_quality IN (
                            'pending',
                            'positive',
                            'negative',
                            'neutral'
                        )),
    outcome_evaluated_at TIMESTAMPTZ,
    outcome_details     JSONB,

    -- What model/version produced this trace
    agent_model         TEXT,
    agent_version       TEXT,
    sdk_version         TEXT,

    -- Timing
    reasoning_duration_ms INTEGER NOT NULL CHECK (reasoning_duration_ms > 0),

    -- ═══════════════════════════════════════════════════════════
    -- SRC-SPECIFIC FIELDS (populated by future SRC pipeline)
    -- ═══════════════════════════════════════════════════════════

    -- Predictability score: what fraction of reasoning_trace is
    -- reconstructible from context alone? (0.0 = all novel, 1.0 = fully predictable)
    predictability_score DECIMAL(5,4),

    -- Residual embedding: the compressed non-obvious reasoning.
    residual_embedding  JSONB,

    -- Qdrant point ID for similarity search over residuals
    residual_qdrant_id  UUID,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────

-- Primary query patterns
CREATE INDEX idx_traces_agent_time ON reasoning_traces(agent_id, created_at DESC);
CREATE INDEX idx_traces_action_type ON reasoning_traces(action_type, created_at DESC);
CREATE INDEX idx_traces_action_ref ON reasoning_traces(action_ref_type, action_ref_id);

-- Quality analysis: find good/bad reasoning by type
CREATE INDEX idx_traces_outcome ON reasoning_traces(outcome_quality, action_type)
    WHERE outcome_quality != 'pending';

-- Cost analysis: token usage by agent and type
CREATE INDEX idx_traces_tokens ON reasoning_traces(agent_id, action_type, total_tokens);

-- Model comparison: same action type, different models
CREATE INDEX idx_traces_model ON reasoning_traces(agent_model, action_type, outcome_quality);

-- SRC training: find traces with known outcomes for training
CREATE INDEX idx_traces_src_training ON reasoning_traces(action_type, outcome_quality, created_at)
    WHERE outcome_quality IN ('positive', 'negative')
    AND predictability_score IS NULL;

-- SRC retrieval: find similar residuals (once populated)
CREATE INDEX idx_traces_residual ON reasoning_traces(residual_qdrant_id)
    WHERE residual_qdrant_id IS NOT NULL;

-- ─── Trace Similarity Pairs ─────────────────────────────────────
-- When two traces have similar contexts but different reasoning,
-- that's gold for SRC training — it reveals which reasoning parts
-- are context-dependent vs agent-dependent.

CREATE TABLE trace_similarity_pairs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_a_id          UUID NOT NULL REFERENCES reasoning_traces(id),
    trace_b_id          UUID NOT NULL REFERENCES reasoning_traces(id),
    context_similarity  DECIMAL(5,4) NOT NULL CHECK (context_similarity BETWEEN 0 AND 1),
    reasoning_similarity DECIMAL(5,4) NOT NULL CHECK (reasoning_similarity BETWEEN 0 AND 1),
    decision_similarity DECIMAL(5,4) NOT NULL CHECK (decision_similarity BETWEEN 0 AND 1),
    -- High context similarity + low reasoning similarity = interesting divergence
    divergence_score    DECIMAL(5,4) GENERATED ALWAYS AS (
        context_similarity * (1.0 - reasoning_similarity)
    ) STORED,
    better_trace_id     UUID REFERENCES reasoning_traces(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trace_a_id, trace_b_id),
    CHECK (trace_a_id != trace_b_id)
);

CREATE INDEX idx_sim_pairs_divergence ON trace_similarity_pairs(divergence_score DESC)
    WHERE better_trace_id IS NOT NULL;
CREATE INDEX idx_sim_pairs_trace ON trace_similarity_pairs(trace_a_id);

-- ─── Reasoning Cost Aggregates ──────────────────────────────────
-- Materialized daily by worker. Powers cost dashboards and
-- identifies expensive reasoning patterns.

CREATE TABLE reasoning_cost_daily (
    date                DATE NOT NULL,
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    action_type         TEXT NOT NULL,
    trace_count         INTEGER NOT NULL DEFAULT 0,
    total_context_tokens    BIGINT NOT NULL DEFAULT 0,
    total_reasoning_tokens  BIGINT NOT NULL DEFAULT 0,
    total_decision_tokens   BIGINT NOT NULL DEFAULT 0,
    avg_reasoning_tokens    INTEGER NOT NULL DEFAULT 0,
    max_reasoning_tokens    INTEGER NOT NULL DEFAULT 0,
    positive_outcomes   INTEGER NOT NULL DEFAULT 0,
    negative_outcomes   INTEGER NOT NULL DEFAULT 0,
    tokens_per_success  INTEGER,
    avg_reasoning_duration_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, agent_id, action_type)
);

CREATE INDEX idx_cost_daily_date ON reasoning_cost_daily(date DESC);
CREATE INDEX idx_cost_daily_agent ON reasoning_cost_daily(agent_id, date DESC);
