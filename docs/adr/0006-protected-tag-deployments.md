# 0006: Protected release tags authorize production deployments

Status: accepted; implementation pending. Extends the CI and deployment decisions in [0004](0004-rust-monorepo.md).

Main performs full UI and native amd64/arm64 production-runtime verification and publishes those verified images; other branches use lightweight checks. Only an immutable protected annotated v* release tag referencing a successfully verified main commit and its matching published image authorizes production deployment, and both automatic deployment and manual repetition use the exact digest without rebuilding. A restricted root-owned server mechanism, pinned SSH host keys and serialization that does not cancel an active deployment let CI request a checked release without obtaining general root or Docker access.
