# Collection publishing from a MacBook

Status: accepted implementation design for #123. The owner prepares one collection, reviews all its content and approves its exact package. Deterministic publication continues from that package. Distribution runs on the VPS after verified production deployment.

## 1 Abstract

The MacBook handles creative preparation, media processing, builds and backup restore verification. A Bun command validates packages, records exact approval and resumes publication. A bounded Rust worker distributes newly live collections independently of Mac availability. GitHub holds Issues, PRs, protected tags and Releases; this path does not dispatch Actions.

## 2 Goals and non goals

The owner reviews five design pairs, six-language metadata/stories, five emoji and English destination copy once. Changed bytes invalidate approval. New collections become eligible only after verified deployment and live-media checks. A failed destination cannot reset another destination's receipts.

This design does not add a public administrative surface, unattended image generation, paid generation fallback, another queue service, historical mass posting or a guarantee of exactly-once delivery from providers without an idempotent create API.

## 3 Background and problem

The catalogue importer and signed local release path already exist. The previous draft service includes provider budgets, n8n callbacks and a package lacking stories, emoji and social copy. Its state is not the new package contract. Operational n8n removal was explicitly requested before replacement acceptance; do not reconstruct deleted resources or claim absent recovery data exists.

## 4 Architecture

Private preparation uses `wallpaper-concepts` for five text concepts, `wallpaper-pairs` for ten separately composed wallpapers, and `telegram-emoji-pack` for five transparent emoji with retained sources, a manifest, contrast previews and a ZIP. The agreed collection dimensions and private output directory take precedence over skill defaults. This produces a provider-independent package. Bun validates and reviews it, then binds approval to its canonical SHA-256. The publisher uploads only public allowlisted files, imports the catalogue and drives the established local release. Server deployment evidence supplies durable publication events. Rust processes independent per-destination delivery intents in PostgreSQL.

## 5 Lifecycle

Initialize, prepare, validate, review and approve. Publication records intent before writes and reconciles uncertain outcomes before retry. It verifies CDN bytes, catalogue readback, Git refs, signed release images, successful deployment and live pages/downloads. Missing prerequisites produce a visible blocked state.

## 6 Contracts

Package schemaVersion 1 includes revision, theme, canonical manifest, stories keyed by all six locales, destination copy and an asset inventory. Asset identity includes path, role, design/variant, SHA-256 and dimensions. Native/composition sources remain private; only approved finals, previews, emoji and public metadata may be uploaded.

Approval records packageHash, revision, decision and timestamp. A publication receipt binds packageHash, collection ID, deployment request, protected tag, source SHA and immutable digest. Distribution events and per-item receipts preserve those identities without secrets or private filesystem paths.

## 7 Consistency and recovery

Exact repeats reuse confirmed receipts. Different bytes for one intent stop. Partial uploads remain resumable without overwrite. Unknown remote outcomes are reconciled or held for owner review. PostgreSQL constraints arbitrate claims; no database transaction spans provider HTTP. Interrupted in-flight sends become unknown, never blindly pending.

## 8 Security and privacy

Draft directories are 0700 and files 0600 outside Git. Reject traversal and symlinks. Review output is local and escaped, without external scripts or tracking. Upload credentials are separate from backup access; report actual provider scope rather than claiming prefix IAM from client validation. The worker has its own database role and credentials, no Docker socket, migrator or application secrets.

## 9 Operational readiness

A systemd timer runs a sequential oneshot every five minutes, initially capped at 20% CPU, 128 MiB RAM and 240 seconds. Measure peak use before enablement. Keep image processing and builds off the VPS. Retain existing production backup/restore, TLS, grants, CAPTCHA and conservative rollback protections. Start with a baseline; accumulated blocked deliveries require explicit owner selection when a destination is connected.

## 10 Alternatives

A CLI-only file report is smaller but makes full visual review harder. A server admin interface exposes private drafts and needs another authenticated surface. Distribution on the Mac fails during sleep. An Actions orchestrator retains a dependency the local release removes. The selected local HTML plus Bun publisher and VPS worker reuse current infrastructure while keeping those boundaries explicit.

## 11 Assumptions to validate

Included interactive image usage must support preparation and composition edits; exhaustion stops the run. Timeweb must support safe conditional creation and the configured uploader rights must be inspected. Platform accounts need actual publishing permission; Pinterest Trial is not public acceptance. Flickr paid access requires a separate decision. Worker memory/CPU limits require measurement. Each platform needs independent live acceptance.

## 12 Decision and next steps

Implement #124, #125 and #126, then #127 and #31–#34. Complete #128 when the replacement is verified. Use separate development PRs and preserve task worktrees. Ask for the first real theme before generation, obtain exact package approval and privately configure accounts before sending. Mergeable code does not establish live acceptance; #123 remains open until its actual criteria pass.
