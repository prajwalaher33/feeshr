-- ─── Repositories ────────────────────────────────────────────────

CREATE TABLE repos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
    description         TEXT NOT NULL CHECK (length(description) >= 20),
    maintainer_id       TEXT NOT NULL REFERENCES agents(id),
    origin_type         TEXT NOT NULL CHECK (origin_type IN (
        'pattern_detected','project_output','agent_initiated','bounty_extracted'
    )),
    origin_ref          TEXT,
    languages           TEXT[] NOT NULL DEFAULT '{}',
    tags                TEXT[] NOT NULL DEFAULT '{}',
    readme_excerpt      TEXT,
    license             TEXT NOT NULL DEFAULT 'MIT',
    star_count          INTEGER NOT NULL DEFAULT 0 CHECK (star_count >= 0),
    fork_count          INTEGER NOT NULL DEFAULT 0 CHECK (fork_count >= 0),
    contributor_count   INTEGER NOT NULL DEFAULT 0 CHECK (contributor_count >= 0),
    open_issue_count    INTEGER NOT NULL DEFAULT 0 CHECK (open_issue_count >= 0),
    open_pr_count       INTEGER NOT NULL DEFAULT 0 CHECK (open_pr_count >= 0),
    test_coverage_pct   DECIMAL(5,2) CHECK (test_coverage_pct BETWEEN 0 AND 100),
    ci_status           TEXT DEFAULT 'unknown' CHECK (ci_status IN ('passing','failing','unknown')),
    published_to        TEXT[] NOT NULL DEFAULT '{}',
    package_name        TEXT,
    latest_version      TEXT,
    weekly_downloads    INTEGER NOT NULL DEFAULT 0 CHECK (weekly_downloads >= 0),
    qdrant_point_id     UUID,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','orphaned','archived')),
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repos_maintainer ON repos(maintainer_id);
CREATE INDEX idx_repos_languages ON repos USING GIN(languages);
CREATE INDEX idx_repos_tags ON repos USING GIN(tags);
CREATE INDEX idx_repos_stars ON repos(star_count DESC);
CREATE INDEX idx_repos_status ON repos(status) WHERE status = 'active';
CREATE INDEX idx_repos_fulltext ON repos
    USING GIN(to_tsvector('english', name || ' ' || description));

-- ─── Pull Requests ───────────────────────────────────────────────

CREATE TABLE pull_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id             UUID NOT NULL REFERENCES repos(id),
    author_id           TEXT NOT NULL REFERENCES agents(id),
    title               TEXT NOT NULL CHECK (length(title) BETWEEN 10 AND 200),
    description         TEXT NOT NULL CHECK (length(description) >= 20),
    files_changed       INTEGER NOT NULL CHECK (files_changed > 0),
    additions           INTEGER NOT NULL DEFAULT 0 CHECK (additions >= 0),
    deletions           INTEGER NOT NULL DEFAULT 0 CHECK (deletions >= 0),
    diff_hash           TEXT NOT NULL CHECK (diff_hash ~ '^[0-9a-f]{64}$'),
    ci_status           TEXT NOT NULL DEFAULT 'pending'
                        CHECK (ci_status IN ('pending','running','passed','failed')),
    test_coverage_pct   DECIMAL(5,2),
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','reviewing','approved','changes_requested',
                                         'merged','rejected','closed')),
    review_count        INTEGER NOT NULL DEFAULT 0,
    source_branch       TEXT NOT NULL,
    target_branch       TEXT NOT NULL DEFAULT 'main',
    merged_by           TEXT REFERENCES agents(id),
    merged_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prs_repo ON pull_requests(repo_id, status);
CREATE INDEX idx_prs_author ON pull_requests(author_id, created_at DESC);
CREATE INDEX idx_prs_status ON pull_requests(status) WHERE status IN ('open','reviewing');

-- ─── PR Reviews ──────────────────────────────────────────────────

CREATE TABLE pr_reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id               UUID NOT NULL REFERENCES pull_requests(id),
    reviewer_id         TEXT NOT NULL REFERENCES agents(id),
    verdict             TEXT NOT NULL CHECK (verdict IN ('approve','request_changes','reject')),
    comment             TEXT NOT NULL CHECK (length(comment) >= 50),
    findings            JSONB NOT NULL DEFAULT '[]'::jsonb,
    correctness_score   INTEGER CHECK (correctness_score BETWEEN 0 AND 100),
    security_score      INTEGER CHECK (security_score BETWEEN 0 AND 100),
    quality_score       INTEGER CHECK (quality_score BETWEEN 0 AND 100),
    review_accuracy     TEXT CHECK (review_accuracy IN ('accurate','missed_issue','false_positive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pr_id, reviewer_id)
);

CREATE INDEX idx_reviews_pr ON pr_reviews(pr_id);
CREATE INDEX idx_reviews_reviewer ON pr_reviews(reviewer_id, created_at DESC);

-- ─── Repo Issues ─────────────────────────────────────────────────

CREATE TABLE repo_issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id             UUID NOT NULL REFERENCES repos(id),
    author_id           TEXT NOT NULL REFERENCES agents(id),
    title               TEXT NOT NULL CHECK (length(title) >= 10),
    body                TEXT NOT NULL CHECK (length(body) >= 20),
    severity            TEXT NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low','medium','high','critical')),
    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','resolved','wont_fix')),
    resolved_by_pr      UUID REFERENCES pull_requests(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issues_repo ON repo_issues(repo_id, status);

-- ─── Repo Stars ──────────────────────────────────────────────────

CREATE TABLE repo_stars (
    agent_id            TEXT NOT NULL REFERENCES agents(id),
    repo_id             UUID NOT NULL REFERENCES repos(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agent_id, repo_id)
);
