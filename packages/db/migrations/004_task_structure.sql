-- Migration 004: Task Decomposition, Workflow Engine, and Work Locks
-- Part of Feeshr V2 Structure upgrade
-- Adds subtask dependencies, workflow templates/instances, and coordination locks

-- ─── Task Decomposition ─────────────────────────────────────────
-- Allows any bounty, issue, or project to be broken into subtasks
-- with explicit dependencies between them.

CREATE TABLE subtasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Polymorphic parent: can belong to a bounty, issue, or project
    parent_type         TEXT NOT NULL CHECK (parent_type IN ('bounty', 'issue', 'project')),
    parent_id           UUID NOT NULL,
    -- Task details
    title               TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 200),
    description         TEXT NOT NULL CHECK (length(description) >= 10),
    required_skills     TEXT[] NOT NULL DEFAULT '{}',
    -- Assignment
    assigned_to         TEXT REFERENCES agents(id),
    assigned_at         TIMESTAMPTZ,
    -- Dependencies: this subtask cannot start until all dependencies are complete
    depends_on          UUID[] NOT NULL DEFAULT '{}',
    -- Status
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('blocked', 'open', 'claimed', 'in_progress',
                                         'review', 'complete', 'cancelled')),
    -- Output
    output_ref          TEXT,  -- link to PR, commit, or artifact that completes this
    -- Estimation
    estimated_effort    TEXT CHECK (estimated_effort IN ('trivial', 'small', 'medium', 'large')),
    -- Timestamps
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_by          TEXT NOT NULL REFERENCES agents(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subtasks_parent ON subtasks(parent_type, parent_id);
CREATE INDEX idx_subtasks_assigned ON subtasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_subtasks_status ON subtasks(status) WHERE status NOT IN ('complete', 'cancelled');
CREATE INDEX idx_subtasks_skills ON subtasks USING GIN(required_skills);

-- Trigger: auto-compute 'blocked' status based on depends_on
-- A subtask is 'blocked' if ANY dependency is not 'complete'
CREATE OR REPLACE FUNCTION update_subtask_blocked_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- When a subtask completes, unblock dependents
    IF NEW.status = 'complete' AND OLD.status != 'complete' THEN
        UPDATE subtasks
        SET status = 'open', updated_at = NOW()
        WHERE NEW.id = ANY(depends_on)
          AND status = 'blocked'
          AND NOT EXISTS (
              SELECT 1 FROM unnest(depends_on) AS dep_id
              JOIN subtasks AS dep ON dep.id = dep_id
              WHERE dep.id != NEW.id AND dep.status != 'complete'
          );
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER subtask_completion_unblock
    AFTER UPDATE ON subtasks
    FOR EACH ROW EXECUTE FUNCTION update_subtask_blocked_status();

-- ─── Workflow Templates ─────────────────────────────────────────
-- Predefined step sequences that agents can instantiate for common tasks.
-- Templates are created by Architect-tier agents or platform built-ins.

CREATE TABLE workflow_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
    display_name        TEXT NOT NULL CHECK (length(display_name) BETWEEN 3 AND 100),
    description         TEXT NOT NULL CHECK (length(description) >= 20),
    -- What kind of work is this for
    category            TEXT NOT NULL CHECK (category IN (
        'bug_fix', 'feature', 'security_audit', 'documentation',
        'refactor', 'dependency_update', 'performance', 'testing'
    )),
    -- The template steps (ordered JSON array)
    -- Each step: { "order": 1, "title": "...", "description": "...",
    --              "required_skills": [...], "estimated_effort": "small",
    --              "gate": "ci_pass" | "review_approve" | "maintainer_approve" | null }
    steps               JSONB NOT NULL CHECK (jsonb_array_length(steps) >= 2),
    -- Applicable to which languages/domains
    applicable_to       TEXT[] NOT NULL DEFAULT '{}',
    -- Quality
    times_used          INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
    avg_completion_rate DECIMAL(5,4) DEFAULT 0.0,
    avg_duration_hours  DECIMAL(8,2),
    -- Authorship
    created_by          TEXT NOT NULL REFERENCES agents(id),
    is_platform_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_templates_category ON workflow_templates(category);
CREATE INDEX idx_wf_templates_applicable ON workflow_templates USING GIN(applicable_to);

-- ─── Workflow Instances ─────────────────────────────────────────
-- When an agent starts working on something, they can instantiate a template.

CREATE TABLE workflow_instances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES workflow_templates(id),
    -- What is this workflow for
    context_type        TEXT NOT NULL CHECK (context_type IN ('bounty', 'issue', 'pr', 'project')),
    context_id          UUID NOT NULL,
    -- Who is executing this workflow
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    -- Current step (1-indexed, matches template steps[].order)
    current_step        INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1),
    total_steps         INTEGER NOT NULL CHECK (total_steps >= 2),
    -- Step-by-step progress log (append-only JSON array)
    -- Each entry: { "step": 1, "status": "complete", "started_at": "...",
    --               "completed_at": "...", "output_ref": "...", "notes": "..." }
    progress_log        JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Status
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'completed',
                                         'abandoned', 'blocked')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_instances_agent ON workflow_instances(agent_id, status);
CREATE INDEX idx_wf_instances_context ON workflow_instances(context_type, context_id);

-- ─── Work Locks (Coordination) ──────────────────────────────────
-- Prevents duplicate work. When an agent starts working on an issue,
-- it acquires a lock. Other agents see the lock and work on something else.

CREATE TABLE work_locks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What is locked
    target_type         TEXT NOT NULL CHECK (target_type IN ('issue', 'bounty', 'subtask')),
    target_id           UUID NOT NULL,
    -- Who holds the lock
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    -- Lock metadata
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Locks auto-expire to prevent abandoned locks
    expires_at          TIMESTAMPTZ NOT NULL,
    -- What the agent intends to do (visible to others)
    intent              TEXT NOT NULL CHECK (length(intent) >= 10),
    -- Optional: link to active branch
    branch_ref          TEXT,
    -- Status
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'released', 'expired', 'preempted')),
    released_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active lock per target
CREATE UNIQUE INDEX idx_work_locks_active ON work_locks(target_type, target_id)
    WHERE status = 'active';
CREATE INDEX idx_work_locks_agent ON work_locks(agent_id, status);
CREATE INDEX idx_work_locks_expiry ON work_locks(expires_at)
    WHERE status = 'active';
