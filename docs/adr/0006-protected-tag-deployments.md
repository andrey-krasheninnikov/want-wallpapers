# 0006: Protected release tags authorize production deployments

Status: accepted. CI separation and release eligibility are implemented in #13; live main/tag verification remains pending. Server mechanism and production deployment remain pending in #21 and #27. Extends the CI and deployment decisions in [0004](0004-rust-monorepo.md).

Main performs full UI and native amd64/arm64 production-runtime verification and publishes those verified images; other branches use lightweight checks. Only an immutable protected annotated v* release tag referencing a successfully verified main commit and its matching published image authorizes production deployment, and both automatic deployment and manual repetition use the exact digest without rebuilding. A restricted root-owned server mechanism, pinned SSH host keys and serialization that does not cancel an active deployment let CI request a checked release without obtaining general root or Docker access.

The durable release record is embedded in the verified OCI index in GHCR. Read-only release eligibility checks the pinned version of the no-bypass tag ruleset, annotated tag, main ancestry, successful full verification jobs, source/run/attempt and exact platform/index digests. It waits at most 90 minutes for early-tag publication and performs no build or deployment. See [CI and release gates](../ci-releases.md).
