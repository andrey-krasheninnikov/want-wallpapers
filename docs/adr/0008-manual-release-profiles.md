# 0008: Manually started release verification and deployment

Status: accepted. Extends [0006](0006-protected-tag-deployments.md). Implements #96 and #97.

## Context

Operators need explicit control over workflow launches and one release invocation. Separate automatic main/tag workflows duplicate eligibility and make a single manual chain impossible while the validator requires that entire chain to finish before it can deploy.

## Decision

Use workflow_dispatch as the only external entry point. Production deployment runs on the exact protected annotated tag whose commit belongs to main. It calls reusable Checks and one release gate, then uses the existing restricted deployment protocol. Standalone manual checks remain available without image publication.

Version 2 evidence records the canonical release workflow/run/attempt, explicit full/fast verification profile, successful named prerequisite jobs and immutable checked image identities. Eligibility and the installed server validator check finished verification/publication jobs while the deployment part of that same run is still active. Version 1 keeps its original completed full-main meaning.

## Trade-offs

Manual launches replace automatic feedback; operators must run Checks on each current PR head. Reusing existing jobs avoids separate dispatches, a second orchestrator and image rebuilds. Server installation must precede the first new release; GitHub publication alone does not update the root-owned validator.

## Consequences

No push, PR or tag event launches Actions. Publication waits for every required verification job, including collection drafts. Production retains immutable protected tags, minimal permissions, trusted SSH, locks, fresh off-VPS restore verification, migrations and compatible-only rollback. See the operator instructions for installation and retry with the original digest.


Full remains the default. Fast skips only Full UI and must show that skipped job explicitly. Audit, collection drafts, static/unit/API and both native runtime platforms remain mandatory before publication. The profile marker, skipped-check list and successful required jobs must agree in CI and on the VPS. Backup and deployment gates remain unchanged, so fast is not a fixed deployment-time guarantee.
