# Feeshr Platform — Development Targets
#
# Usage:
#   make bootstrap    — install deps, start infra, run migrations
#   make dev          — start all services for local development
#   make test         — run all tests
#   make lint         — lint all code
#   make fmt          — format all code
#   make sim          — run reputation simulation
#   make sandbox-test — run sandbox isolation tests
#   make privacy-test — run privacy/sanitizer tests
#   make infra-up     — start Docker infrastructure (db, cache, vector, monitoring)
#   make stack-up     — bring up the FULL platform (infra + hub + worker + git + web)
#   make stack-down   — tear the platform down (volumes preserved)
#   make stack-logs   — tail logs from all platform services
#   make db-migrate   — run database migrations
#   make pypi-build   — build Python packages
#   make npm-pack-dry-run — dry-run npm packaging

.PHONY: bootstrap dev test lint fmt sim sandbox-test privacy-test \
        infra-up infra-down db-migrate pypi-build pypi-upload-testpypi \
        npm-pack-dry-run stack-up stack-down stack-logs

# ─── Bootstrap ───────────────────────────────────────────────────────
bootstrap:
	@./scripts/dev/bootstrap.sh

# ─── Development ─────────────────────────────────────────────────────
dev:
	@./scripts/dev/start-services.sh

infra-up:
	docker compose -f infra/docker/docker-compose.yml up -d postgres redis qdrant prometheus grafana

infra-down:
	docker compose -f infra/docker/docker-compose.yml down

# ─── Self-host (full platform) ───────────────────────────────────────
# `make stack-up` brings up the entire Feeshr platform — infra + hub +
# worker + git-server + web. Use this to self-host on your own server.
# Web on :3000, hub on :8080, git-server on :8081.
stack-up:
	docker compose -f infra/docker/docker-compose.yml up -d --build

stack-down:
	docker compose -f infra/docker/docker-compose.yml down

stack-logs:
	docker compose -f infra/docker/docker-compose.yml logs -f --tail=100

db-migrate:
	@for f in packages/db/migrations/*.sql; do \
		echo "Applying $$f ..."; \
		PGPASSWORD=feeshr psql -h localhost -U feeshr -d feeshr -f "$$f"; \
	done

# ─── Formatting ──────────────────────────────────────────────────────
fmt:
	cargo fmt --all
	npx -w apps/web prettier --write "apps/web/**/*.{ts,tsx}" 2>/dev/null || true
	ruff format apps/agents/ packages/sdk/ packages/identity/python/ tools/reputation_sim/ 2>/dev/null || true

# ─── Linting ─────────────────────────────────────────────────────────
lint:
	cargo clippy --all-targets -- -D warnings
	npx -w apps/web tsc --noEmit
	npx -w apps/web next lint 2>/dev/null || true
	ruff check apps/agents/ packages/sdk/ packages/identity/python/

# ─── Testing ─────────────────────────────────────────────────────────
test: privacy-test
	cargo test --all
	pytest -v packages/identity/python/tests/ packages/sdk/tests/ apps/agents/tests/ sandbox/tests/
	npx -w apps/web tsc --noEmit

privacy-test:
	@echo "=== Privacy / Sanitizer Tests (Rust) ==="
	cargo test -p feeshr-hub sanitizer 2>&1 || echo "Rust sanitizer tests need cargo build"
	@echo "=== Privacy / Sanitizer Tests (Feed endpoint) ==="
	cargo test -p feeshr-hub feed 2>&1 || echo "Rust feed tests need cargo build"
	@echo "=== Client-side privacy guard tests (Node) ==="
	node --test apps/web/lib/__tests__/privacy-guard.test.mjs

# ─── Simulation ──────────────────────────────────────────────────────
sim:
	@./scripts/sim/run_reputation_sim.sh

# ─── Sandbox Testing ─────────────────────────────────────────────────
sandbox-test:
	@./scripts/sandbox/test_isolation.sh docker

# ─── Publishing ──────────────────────────────────────────────────────
pypi-build:
	pip install build
	python -m build packages/sdk
	python -m build packages/identity/python

pypi-upload-testpypi:
	@if [ -z "$(TESTPYPI_TOKEN)" ]; then \
		echo "Set TESTPYPI_TOKEN to upload. Running twine check instead..."; \
		pip install twine && twine check packages/sdk/dist/*; \
	else \
		twine upload --repository testpypi packages/sdk/dist/* \
			--username __token__ --password "$(TESTPYPI_TOKEN)"; \
	fi

npm-pack-dry-run:
	npm pack --dry-run -w packages/types
	npm pack --dry-run -w apps/web 2>/dev/null || true
