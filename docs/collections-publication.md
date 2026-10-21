# Publish an approved collection from a MacBook

The publisher accepts the exact private package approved through `prepare-collection`. It uploads public files, imports the catalogue and completes the existing local Gitflow release. GitHub Actions are not dispatched. A catalogue import, a tag or an uploaded image alone does not complete publication.

Keep the package, approval, uploader credentials, catalogue token and release configuration outside Git. The package directory has mode 0700 and files have mode 0600. The existing local-release prerequisites, signer, restricted SSH account and Mac backup worker remain required; see [local releases](ci-releases.md#локальный-выпуск-с-macbook) and [production deployment](production-deployments.md#локальный-validator).

Use a separate S3 user with access to the collection bucket when available. Inspect provider permissions separately: the local prefix guard does not prove prefix-restricted IAM. The owner may explicitly select an existing uploader profile. Never use or change the backup profile or bucket policy. The Timeweb adapter uses the SDK bundled with the installed Homebrew AWS CLI and does not print SDK errors or credential values.

## Start

Run from a clean, published checkout containing this publisher. Freeze the current remote `development` and `main` SHAs. `main` must already be an ancestor of the selected development; finish an existing release's backmerge before starting another collection. Read the complete selected development diff against main before authorizing its release.

Create a private JSON file with these exact keys:

```json
{
  "version": "1.10.0",
  "awsProfile": "timeweb-wallpapers-upload",
  "catalogTokenFile": "/absolute/private/catalog-api-token",
  "expectedDevelopment": "<40-character remote development SHA>",
  "expectedMain": "<40-character remote main SHA>"
}
```

The version must be the next minor after the stable release in main. The example version is illustrative. Root package, Cargo workspace, lockfile and latest stable main tag must agree. Occupied release refs, changed protection or ref drift stop the run; the publisher never chooses another version or adopts a new target silently.

```sh
make collection-publish PACKAGE=/absolute/private/collection \
  PUBLICATION_CONFIG=/absolute/private/publication.json
make collection-publication-status PACKAGE=/absolute/private/collection
make collection-resume PACKAGE=/absolute/private/collection \
  PUBLICATION_CONFIG=/absolute/private/publication.json
```

The CLI equivalents are `bun run collection publish`, `publication-status` and `resume`, with the same directory and configuration arguments. The preparation form `resume PRIVATE_DIRECTORY` still reports package status and never publishes.

## What runs

Approval and asset hashes are checked before each phase. The uploader freezes public bytes, uses conditional creation, reads back SHA-256 and checks CDN MIME, size and hash. It retains the package filenames and also creates the ten numeric PNG names used by the existing catalogue. `collection-package.json` contains only public metadata and is written after media verification. Conflicting objects are preserved and stop the upload. The uploader never deletes objects.

The catalogue phase compares existing records, dates and listing flags with the selected snapshot, excluding only the current collection on resume. Build snapshots from before listing controls treat every record as visible when the entire listing field is absent. Remote responses and snapshots with an explicit listing field must contain complete boolean maps; malformed or partial flags stop publication. Baseline comparison ignores zero-only UTC timestamp fractions while retaining nonzero microseconds. It reuses the transactional import and exact readback, then freezes the complete exported snapshot. Before the feature commit, it checks the approved collection and all five designs again, including their listing flags, dates and the unchanged surrounding catalogue. IDs are never renumbered. Ratings and comments are untouched. The feature adds the exported snapshot and approved public metadata; shared editorial code supplies the six stories. The build includes the fixed, non-HTTP `runtime-publications.json` artifact for subsequent distribution.

The publisher creates a collection feature PR, squash-merges it into development, prepares the synchronized minor version and changelog, then runs the full local release checks before merging the release PR into main. It publishes an immutable annotated protected tag, builds and checks both architectures through the existing local release client, publishes those same images, and requests restricted SSH deployment with the original digest. Backup, isolated PostgreSQL 18 restore, grants, migrations and readiness remain mandatory. The current Mac runs arm64 natively and amd64 through emulation.

After deployment, the publisher verifies the compiled revision through uncached readiness, the catalogue, 36 collection/design pages across six locales and all ten exact PNG downloads. It completes the semantic main backmerge and GitHub Release, then removes only the two verified disposable remote branches. Persistent worktrees and private recovery files remain available.

## Resume and recovery

`publication/publish.json` records immutable phase identities and confirmed results. `publication/upload.json` records object intents and hashes. Keep both files. Status prints only allowlisted publication fields, never the private configuration or local release state.

An interrupted creation is read back before another write. A matching PR, tag, branch, release or deployment is reused. An unconfirmed PR/Release creation stays blocked when readback finds nothing; inspect the corresponding GitHub state before creating the exact missing object manually and resuming. Do not reset the journal to bypass an unknown outcome. Branch pushes and immutable tags reject competing values, and merge results are checked against the expected parents and tree. GitHub's merge API cannot compare-and-swap the base SHA: the publisher checks the base immediately before merging and rejects an unexpected result before any release step.

A deployment failure keeps the original tag, SHA, digest and request. Resume queries that intent through the existing client. Terminal failed, rolled-back or recovery-required states need operator recovery; no automatic second migration, down-migration or production database restore occurs. A new release requires a new reviewed version and intent.

`publication/receipt.json` is a versioned non-sensitive receipt bound to package hash, collection, deployment request, protected tag, source SHA and image digest. Its timestamp records the live verification, not a later status read. The receipt confirms the collection release; it does not confirm Telegram or other destination posts, real CAPTCHA assessment, admin login or physical-device appearance.
