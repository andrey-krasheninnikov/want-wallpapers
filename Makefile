.PHONY: help install dev dev-backend build check test test-db test-backend test-frontend test-ui fmt catalog-pull catalog-add docker-build test-container audit deploy-config migrate
help:
	@echo 'install dev dev-backend build check test test-db test-backend test-frontend test-ui fmt catalog-pull catalog-add docker-build test-container audit deploy-config migrate'
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
test: test-frontend test-backend
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
	docker build --build-arg VCS_REF="$$(git rev-parse HEAD)" --build-arg PUBLIC_FIREBASE_API_KEY --build-arg PUBLIC_FIREBASE_PROJECT_ID --build-arg PUBLIC_FIREBASE_APP_ID --build-arg PUBLIC_FIREBASE_MEASUREMENT_ID --tag want-wallpapers:local .
deploy-config:
	docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
migrate:
	docker compose --env-file deploy/.env -f deploy/compose.yaml --profile operations run --rm migrate

.PHONY: test-container
test-container: test-db
	python3 scripts/test-container.py

.PHONY: audit
audit:
	python3 scripts/audit-dependencies.py
