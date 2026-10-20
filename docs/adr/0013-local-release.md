# 0013: Signed local releases from a MacBook

Status: accepted. Extends [0006](0006-protected-tag-deployments.md), [0007](0007-off-vps-restore-verification.md) and [0008](0008-manual-release-profiles.md). Implements #129.

## Problem

Release verification and publication must work from the owner's MacBook without running GitHub Actions. The existing server accepts only Actions-backed evidence, so an SSH launcher alone cannot provide this capability.

## Decision

Keep the existing Gitflow, protected annotated tags in main history, GitHub Releases and GHCR. Add an independent local execution path alongside Actions. The project release-local skill takes an explicit version, defaults to full and permits an explicit fast profile that skips only Full UI/E2E.

The Mac signs a version 3 release statement with a separate Ed25519 identity through ssh-agent. The statement binds the tag, repository, source/tree, verification profile and completed checks, tooling digest, execution architecture and tested platform/config digests. It contains no invented Actions run. The root-owned server independently verifies the pinned signing key, statement, immutable tag protection, main ancestry, tagged tree and registry identities. Versions 1 and 2 retain their existing Actions validation.

Build and test linux/arm64 and linux/amd64 locally, then publish the tested images without rebuilding. On an arm64 Mac, amd64 verification is emulated. Preserve that distinction in evidence. OpenSSH provides detached signatures and namespace separation without another signing dependency; see [ssh-keygen](https://man.openbsd.org/ssh-keygen). Docker documents the [performance limits of emulation](https://docs.docker.com/build/building/multi-platform/).

Pre-merge checks can be reused after merge only when source tree, tooling, build configuration and tool versions match. Image identity still binds the final tagged commit. Private release state records publication intent before each remote write and reconciles existing digests on retry.

## Trust and operations

The trusted Mac and its signing key attest that local checks ran; a signature does not independently prove execution. Production application secrets remain on the VPS. Backup credentials and encryption identity stay in their existing private Mac configuration. A compromised signing key must be removed from the root-owned signer file before further local deployments.

Deployment continues through the restricted account and server lock, with encrypted backup, isolated PostgreSQL 18 restore, least-privilege migrations/runtime, readiness and compatible-only rollback. The local process manages only its own worker and test resources. Owner SSH is used for reviewed validator installation, not normal deployment.

An update-only installer preserves SSH settings, operational files and the running application, refuses active deployment/recovery and retains a private rollback snapshot. Initial production application deployment is separate from installing this contract.

## Alternatives and limits

Starting Actions from the Mac retains the dependency being removed. A Linux wrapper on the Mac needs loopback and bind-mount adapters for current tests. A remote builder adds another machine; direct image transfer adds a distribution path while GHCR already exists. Native macOS orchestration reuses the current checks and Docker runtime harness with fewer changes.

This change does not remove Actions, add multiple operators, change tag protection, move secrets to GitHub, build on the VPS or promise a fixed release duration. Backup/restore and emulated compilation can remain expensive. A separate ideas document would duplicate this decision.
