# Rollback Plan

## Overview

All hardening changes are additive — no existing V1–V3 behavior was
removed or modified in a breaking way. Rollback is straightforward.

## Migration Rollback

### Migration 008: feed_events

To roll back:
```sql
DROP TABLE IF EXISTS feed_events;
```

**Impact**: Public feed REST endpoint (`/api/v1/feed`) will return
empty results. WebSocket feed is unaffected (uses broadcast channel).

**Feature flag**: The feed endpoint gracefully handles missing table
(returns empty array on query failure).

## Code Rollback

### Sanitizer

The sanitizer (`apps/hub/src/services/sanitizer.rs`) is additive.
To disable:
- Revert `websocket.rs` to broadcast raw events without sanitization
- Remove the `/api/v1/feed` route from `routes/mod.rs`

### Metrics endpoint

The `/metrics` endpoint is additive. To remove:
- Delete `routes/metrics.rs`
- Remove the route line from `routes/mod.rs`

### Frontend changes

The frontend maintains mock data fallback. To revert:
- Restore `LiveFeed.tsx` to the original mock-only version
- Remove `lib/privacy-guard.ts`, `lib/api-client.ts`, `lib/hooks/`

### CI publishing workflow

The `publish.yml` workflow only runs on manual dispatch (`workflow_dispatch`).
It does not affect existing CI. To remove:
- Delete `.github/workflows/publish.yml`

### Sandbox scripts

Sandbox scripts in `infra/sandbox/` are standalone. They do not
modify the existing `sandbox/` Python code. To remove:
- Delete `infra/sandbox/docker-runner.sh` and `gvisor-runner.sh`

### Simulation harness

The simulation in `tools/reputation_sim/` is completely standalone.
To remove:
- Delete `tools/reputation_sim/`
- Delete `scripts/sim/`

### Prometheus alert rules

To remove alerts:
- Delete `infra/monitoring/prometheus/alerts/feeshr.rules.yml`
- Remove the `rule_files` directive from `prometheus.yml`
- Remove the alerts volume mount from `docker-compose.yml`

## Rollback Order

If you need to roll back everything:

1. Revert to the initial commit (before hardening):
   ```bash
   git log --oneline  # find the initial commit hash
   git revert --no-commit HEAD~7..HEAD  # revert all 7 hardening commits
   git commit -m "Rollback: revert all hardening changes"
   ```

2. Drop the feed_events table:
   ```sql
   DROP TABLE IF EXISTS feed_events;
   ```

3. Restart services:
   ```bash
   make dev
   ```

## Feature Flags

The following changes can be toggled without code changes:

| Feature | Toggle | Default |
|---------|--------|---------|
| Feed sanitization | Always on (no flag) | Enabled |
| Mock data fallback | Automatic (3s timeout) | Enabled in dev |
| OIDC publishing | `OIDC_REQUIRED_FOR_PUBLISHING` env | `true` |
| Sandbox runtime | `SANDBOX_RUNTIME` env | `docker` |
| gVisor | Automatic fallback to Docker | Docker |
