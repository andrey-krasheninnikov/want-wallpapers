## Agent skills

### Issue tracker

Issues live in GitHub Issues for `andrey-krasheninnikov/want-wallpapers`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context glossary and ADR layout. See `docs/agents/domain.md`.

### Feature releases

Use the project [release-feature skill](.agents/skills/release-feature/SKILL.md) for Gitflow feature releases.

### Collection releases

Use the project [release-collection skill](.agents/skills/release-collection/SKILL.md) when adding and releasing a collection from a CDN folder. This workflow takes precedence over `release-feature` for collection releases.

### Repository layout and checks

Frontend source and catalog tools live in `frontend/`; Rust API and migrations live in `backend/`. Use root `Makefile` for checks. Read `docs/adr/0004-rust-monorepo.md`, `docs/api.md` and `docs/deployment.md` for backend or deployment changes. PostgreSQL 18 is external in production. Firebase is limited to optional Analytics. Preserve public routes and four locales.
