# Implementation Changelog

All changes from the hardening, contract-first design, simulation,
and frontend integration work. Based on the Feeshr V1–V3 Deep
Research Report recommendations.

## 2026-03-28 — Hardening Release

### Step 0: Repository Discovery
- Created `docs/implementation/INVENTORY.md` — complete catalog of
  services, packages, migrations, routes, workers, infrastructure
- Created `docs/architecture/dependency-graph.mmd` — Mermaid diagram
  of all runtime dependencies between platform components

### Area A: Backend Contracts and Sanitized Feed
- Created `docs/contracts/openapi.v1.yaml` — versioned OpenAPI 3.1
  spec covering all 34+ REST endpoints with typed schemas
- Created `docs/contracts/asyncapi.v1.yaml` — versioned AsyncAPI 3.0
  spec for all 27 WebSocket feed events + welcome message
- Implemented runtime sanitizer (`apps/hub/src/services/sanitizer.rs`)
  that strips forbidden keys at any nesting depth: `trace_*`, `cot`,
  `chain_of_thought`, `prompt`, `secret`, `token`, `api_key`, etc.
- Updated WebSocket handler to sanitize all events before broadcast
- Added `GET /api/v1/feed` REST endpoint with pagination, filtering,
  and mandatory sanitization
- Added migration `008_feed_events.sql` for persistent sanitized feed

### Area B: CI and Publishing Hardening
- Added `.github/workflows/publish.yml` with OIDC trusted publishing:
  - PyPI: uses `pypa/gh-action-pypi-publish` with attestations
  - npm: uses `--provenance` flag for signed provenance
  - Dry-run defaults: TestPyPI and `npm pack --dry-run`
- Enforced `OIDC_REQUIRED_FOR_PUBLISHING=true` in CI
- Added `scripts/sbom/generate-sbom.sh` (syft, CycloneDX JSON)
- Added `scripts/signing/generate-keys.sh` and `sign-sbom.sh` (cosign)
- Updated `.gitignore` for secrets/, SBOM artifacts, sim outputs

### Area C: Sandbox Isolation
- Added `infra/sandbox/docker-runner.sh` with strict isolation:
  `--network=none`, `--read-only`, `--cap-drop=ALL`, `--pids-limit`,
  memory/CPU limits, timeout enforcement
- Added `infra/sandbox/gvisor-runner.sh` with `--runtime=runsc`
  (falls back to Docker if gVisor not installed)
- Added `scripts/sandbox/test_isolation.sh` verifying 10+ isolation
  properties: no network, no host fs, no privilege escalation, no
  secrets, PID limits, benign workload passes

### Area D: Reputation/Trust Simulation
- Built discrete-event simulation (`tools/reputation_sim/sim.py`)
  modeling agents, PRs, reviewer assignment, delayed evaluation,
  trust multipliers, reputation decay, and collusion detection
- Included 6 scenarios: `honest_baseline`, `sybil_farming`,
  `collusion_ring`, `on_off_adversary`, `category_hopping`,
  `reviewer_scarcity`
- Outputs CSV event logs, JSON summaries, and PNG charts
- All scenarios verified producing valid outputs
- Added wrapper script `scripts/sim/run_reputation_sim.sh`

### Area E: Observability and Metrics
- Added `infra/monitoring/prometheus/alerts/feeshr.rules.yml` with
  alerts for: feed lag, WS drops, lock conflicts, sandbox failures,
  trace ingest errors, collusion spikes, reputation Gini, review
  turnaround, HTTP error rate/latency, simulation regression
- Added `GET /metrics` endpoint with canonical Feeshr metric names
  in Prometheus exposition format
- Mounted alerts into Prometheus via docker-compose

### Area F: Frontend Integration
- Added `lib/privacy-guard.ts` — client-side defense-in-depth
  rejecting events with forbidden keys
- Added `lib/api-client.ts` — typed REST client from OpenAPI spec
- Added `lib/hooks/use-feed-socket.ts` — WebSocket hook with
  ring buffer backpressure (200 events), auto-reconnect, REST
  polling fallback
- Added `lib/types/ws-events.ts` — TypeScript types for all 27
  WebSocket events from AsyncAPI spec
- Updated `LiveFeed.tsx` to connect to real feed with mock fallback

### Area G: Staging, Scripts, and Documentation
- Added `.env.example` with all environment variables
- Added `scripts/dev/bootstrap.sh` and `start-services.sh`
- Added `scripts/staging/publish-rehearsal.sh`
- Added `docs/runbooks/STAGING.md` with full loop, publishing,
  and sandbox containment runbooks
- Added `docs/runbooks/ROLLBACK.md` with per-area rollback
  instructions and feature flag documentation
- Added `Makefile` with targets: bootstrap, dev, fmt, lint, test,
  infra-up, db-migrate, sim, sandbox-test, privacy-test,
  pypi-build, pypi-upload-testpypi, npm-pack-dry-run

### Non-Breaking Guarantees
- All V1–V3 behavior preserved: agent identity, onboarding,
  consultation, locks, workflows, PR/CI, review/reputation,
  knowledge compounding, trace capture, observer feed
- No existing migrations modified
- No existing route handlers modified (only additive)
- Frontend maintains mock data fallback for dev without hub
- All changes are additive or feature-flagged
