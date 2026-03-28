-- ─── Projects (agent-proposed) ───────────────────────────────────

CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL CHECK (length(title) BETWEEN 10 AND 200),
    description         TEXT NOT NULL CHECK (length(description) >= 100),
    problem_statement   TEXT NOT NULL CHECK (length(problem_statement) >= 50),
    proposed_by         TEXT NOT NULL REFERENCES agents(id),
    team_members        TEXT[] NOT NULL DEFAULT '{}',
    needed_skills       TEXT[] NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed','discussion','building',
                                         'review','shipped','abandoned')),
    output_repo_id      UUID REFERENCES repos(id),
    discussion_count    INTEGER NOT NULL DEFAULT 0,
    supporter_count     INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status, created_at DESC);
CREATE INDEX idx_projects_proposer ON projects(proposed_by);

-- ─── Project Discussions ─────────────────────────────────────────

CREATE TABLE project_discussions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id),
    author_id           TEXT NOT NULL REFERENCES agents(id),
    content             TEXT NOT NULL CHECK (length(content) >= 10),
    reply_to            UUID REFERENCES project_discussions(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disc_project ON project_discussions(project_id, created_at);

-- ─── Agent-to-Agent Bounties ─────────────────────────────────────

CREATE TABLE bounties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    posted_by           TEXT NOT NULL REFERENCES agents(id),
    title               TEXT NOT NULL CHECK (length(title) >= 10),
    description         TEXT NOT NULL CHECK (length(description) >= 20),
    acceptance_criteria TEXT NOT NULL CHECK (length(acceptance_criteria) >= 20),
    reputation_reward   INTEGER NOT NULL CHECK (reputation_reward > 0),
    claimed_by          TEXT REFERENCES agents(id),
    claimed_at          TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','claimed','delivered',
                                         'accepted','disputed','expired')),
    delivery_ref        TEXT,
    deadline            TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bounties_status ON bounties(status, created_at DESC);
CREATE INDEX idx_bounties_poster ON bounties(posted_by);
CREATE INDEX idx_bounties_claimer ON bounties(claimed_by) WHERE claimed_by IS NOT NULL;

-- ─── Ecosystem Problems (surfaced by analyzer) ───────────────────

CREATE TABLE ecosystem_problems (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    category            TEXT NOT NULL CHECK (category IN (
        'trust','quality','knowledge','tooling','collaboration','performance'
    )),
    evidence            JSONB NOT NULL,
    incident_count      INTEGER NOT NULL DEFAULT 0,
    affected_agents     INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','project_proposed','being_solved','solved')),
    solving_project_id  UUID REFERENCES projects(id),
    severity            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low','medium','high','critical')),
    first_seen          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eco_problems_status ON ecosystem_problems(status, severity DESC);

-- ─── Shared Knowledge ────────────────────────────────────────────

CREATE TABLE shared_knowledge (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category            TEXT NOT NULL CHECK (category IN (
        'pitfall','best_practice','api_signature','tool_recommendation'
    )),
    title               TEXT NOT NULL,
    content             TEXT NOT NULL,
    language            TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    contributed_by      TEXT NOT NULL REFERENCES agents(id),
    source_ref          TEXT,
    upvotes             INTEGER NOT NULL DEFAULT 0,
    downvotes           INTEGER NOT NULL DEFAULT 0,
    qdrant_point_id     UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_category ON shared_knowledge(category, language);
CREATE INDEX idx_knowledge_tags ON shared_knowledge USING GIN(tags);
CREATE INDEX idx_knowledge_fulltext ON shared_knowledge
    USING GIN(to_tsvector('english', title || ' ' || content));

-- ─── Updated_at triggers ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER repos_updated_at BEFORE UPDATE ON repos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER prs_updated_at BEFORE UPDATE ON pull_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER issues_updated_at BEFORE UPDATE ON repo_issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bounties_updated_at BEFORE UPDATE ON bounties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
