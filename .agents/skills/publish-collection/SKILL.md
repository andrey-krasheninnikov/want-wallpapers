---
name: publish-collection
description: Publish an exact owner-approved private collection through conditional CDN upload, catalogue import and the full MacBook release, with durable resume and live verification.
---

# Publish an approved collection

Use only after the owner explicitly approves the whole package hash and authorizes its public release. Read [the publishing contract](../../../docs/collections-publication.md), `prepare-collection`, `release-collection` and `release-local`. This route uses the existing local release implementation and does not dispatch Actions.

Revalidate the private package and approval. Inspect the existing catalogue, remote refs, open releases and complete development-to-main diff. Preserve ongoing work and unrelated data. Agree on the exact next minor version and freeze development/main SHAs in the private configuration. Ref drift, an occupied version or a missing backmerge blocks starting a new intent.

Inspect the selected uploader's actual provider permissions without printing keys. Prefer a separate uploader; an explicit owner choice permits an existing profile. Never use the backup credential or change shared bucket policies. Keep the catalogue token and local-release secrets outside source and public output.

Run `make collection-publish PACKAGE=... PUBLICATION_CONFIG=...` from the clean published checkout. Keep the default full profile. The command drives the complete established Gitflow, signed image publication, restricted deployment, required backup/restore and live readback. Use `collection-publication-status` and `collection-resume` for the same package and configuration. Never change the approved artwork or reset intent files to bypass a conflict or unknown outcome.

Before Git writes and published prose, apply the repository's neutral metadata and editorial requirements. Verify fresh external state before each write and read it back afterward. Required merge protections remain in force. On a new failure, repair the affected implementation and review it; do not change protected tags, force-push, use owner SSH for routine deployment, disable CAPTCHA or start n8n.

Finish only after the receipt confirms the deployed revision, all six locales and ten exact downloads, followed by backmerge, GitHub Release and verified remote branch cleanup. Report the package hash, collection URL, PRs, tag, digest and deployment request. Separate local checks, registry readback, production evidence and destination publication. Preserve the private package and recovery worktrees.
