DEPLOY_ENV_FILE ?= deploy/.env

.PHONY: help install dev dev-backend build check test test-db test-backend test-frontend test-ci test-ui fmt catalog-pull catalog-add docker-build test-container audit deploy-config migrate
help:
	@echo 'install dev dev-backend build check test test-db test-backend test-frontend test-ci test-ui fmt catalog-pull catalog-add docker-build test-container audit deploy-config migrate n8n-config n8n-up n8n-stop n8n-status n8n-backup n8n-restore test-n8n'
install:
	bun install --frozen-lockfile --ignore-scripts
	cargo fetch --locked
dev:
	bun run dev
dev-backend:
	cargo run --locked -p want-wallpapers-server
build:
	bun run build
	cargo build --locked --release -p want-wallpapers-server
check:
	python3 scripts/test-deploy-profile.py
	bun run check
	cargo fmt --all -- --check
	cargo clippy --locked --workspace --all-targets -- -D warnings
	git diff --check
test-db:
	python3 scripts/test-db.py
test-backend: test-db
	python3 scripts/test-run.py cargo test --locked --workspace
test-frontend:
	bun run test
test-ci:
	python3 -B -m unittest discover -s scripts/tests -v
test: test-frontend test-backend test-ci
test-ui: test-db
	bun run build
	bun run test:ui
fmt:
	cargo fmt --all
catalog-pull:
	bun run catalog:pull
catalog-add:
	bun run catalog:add "$(MANIFEST)" $(ARGS)
docker-build:
	docker build --build-arg VCS_REF="$$(git rev-parse HEAD)" --build-arg PUBLIC_FIREBASE_API_KEY --build-arg PUBLIC_FIREBASE_PROJECT_ID --build-arg PUBLIC_FIREBASE_APP_ID --build-arg PUBLIC_FIREBASE_MEASUREMENT_ID --tag "$${TEST_APP_IMAGE:-want-wallpapers:local}" .
deploy-config:
	docker compose --env-file "$(DEPLOY_ENV_FILE)" -f deploy/compose.yaml config --quiet
migrate:
	@active_app="$$(docker compose --env-file "$(DEPLOY_ENV_FILE)" -f deploy/compose.yaml ps --all --status running --status restarting --status paused --status created --status removing -q app)"; \
	 test $$? -eq 0 || exit 1; \
	 test -z "$$active_app" || { echo 'Stop app in an approved maintenance window before migrations.'; exit 1; }
	docker compose --env-file "$(DEPLOY_ENV_FILE)" -f deploy/compose.yaml --profile operations run --rm migrate

.PHONY: test-container
test-container: test-db
	python3 scripts/test-container.py

.PHONY: audit
audit:
	python3 scripts/audit-dependencies.py

.PHONY: n8n-config n8n-up n8n-stop n8n-status n8n-backup n8n-restore test-n8n
n8n-config:
	docker compose -f automation/n8n/compose.yaml config --quiet
n8n-up:
	docker compose -f automation/n8n/compose.yaml up --detach --wait --wait-timeout 180
n8n-stop:
	docker compose -f automation/n8n/compose.yaml stop --timeout 90 n8n
n8n-status:
	docker compose -f automation/n8n/compose.yaml ps --all
n8n-backup:
	python3 -B scripts/n8n-state.py backup
n8n-restore:
	python3 -B scripts/n8n-state.py restore "$(ARCHIVE)" --volume "$(VOLUME)"
test-n8n:
	python3 -u -B scripts/test-local-n8n.py
