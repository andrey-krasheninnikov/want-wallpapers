# Collection distribution on the VPS

Part of #123 and #126. The Rust `distribute` command provides the durable queue shared by #127 and #31–#34. Destination adapters and real platform acceptance belong to those separate issues. Until an adapter is installed, its items become `blocked` with `destination-adapter-unavailable`; this version sends no posts.

## Publication and delivery contracts

The private root exporter reads the running healthy app, its immutable image, architecture and OCI revision. These must match a retained server request with `succeeded`, `complete` and `backupVerified=true`. A catalogue row, tag or PR alone is insufficient. `/var/lib/want-wallpapers/publications/<requestId>.json` keeps schema version 1, verification time, nine allowlisted release fields and the catalogue's collection IDs with optional public package metadata. It contains no signing material, Google credentials or private preparation paths. Existing files are immutable; repeated export verifies their content without changing verification time. The exporter always reads the actual runtime catalogue and requires exact catalogue IDs and manifest contents, including wallpaper membership.

`runtime-publications.json` belongs to the image, outside the HTTP static directory. It carries the catalogue IDs and public packages. Older images without that file supply a baseline from `runtime-catalog.json`. The first batch registers existing collections without enqueueing historical announcements. Later batches discover collections absent from that baseline, including manual releases. Export runs before each timer tick. Once provisioning exists, deployment also waits for the worker and exports the previous live image before replacing it. An interrupted handoff is retried from the retained server journal and current image, without deploying or posting again.

PostgreSQL records batches, publications, delivery intents and attempts. A collection payload and its hash remain immutable. Conflicting later metadata is recorded in the new batch without replacing that collection or blocking independent new collections. Status includes these publication conflicts; they require owner review. Each `(collection_id, destination, item)` is unique. Telegram has an emoji-set and album intent; Pinterest, DeviantArt and Flickr have five items each; Tumblr has one photoset. Missing configuration blocks that destination. Missing public package fields block the affected adapter. Adding credentials does not automatically select old blocked work. The owner selects a collection and destination explicitly; future collections use the configuration present at ingestion.

Claims use a short transaction with `FOR UPDATE SKIP LOCKED`. The transaction commits before HTTP. Completion requires the matching claim UUID and generation. A successful item stays delivered when another fails. `retryable` respects the next-attempt time and provider Retry-After. Confirmed rejection becomes blocked; an ambiguous write or malformed success becomes unknown. An interrupted claim older than five minutes becomes unknown. No process turns unknown into a blind retry.

OAuth files stay in a private writable directory. Rotation takes a file lock, checks the previous file hash, writes a private temporary file and fsyncs the file and directory around atomic rename. Every reauthorization writer must take the same `credentials.lock`. Before manual editing, stop the timer, wait for the service to finish and verify that the fixed worker container is absent. Stopping only the timer does not stop an existing run. A file-hash mismatch stops rotation; the lock prevents a cooperating owner update between that check and rename. Owner reauthorization replaces only that destination's private configuration.

## Initial provisioning

Install only reviewed, published source. Use the existing `install-deployment.py --update-only` procedure and pinned release public key first. It installs the fixed exporter, launcher and grant files with the validator; the timer remains disabled. Preserve the application, Traefik, other services and production secrets.

Reserve host UID/GID 10002 for distribution after checking they are unused. Create `/etc/want-wallpapers/distribution` as root 0700. Store the external PostgreSQL 18 URL for `wallpapers-distributor` in `distribution_database_url`, with `sslmode=verify-full`, and the database CA in `postgres_ca.pem`. Both files must be 10002:10002, mode 0400. Never reuse the app or migrator URL. Create `/var/lib/want-wallpapers/distribution-credentials` as 10002:10002, mode 0700; destination JSON files use mode 0600. Missing files mean unconfigured destinations. Keep all values outside Git, GitHub and command arguments.

The database owner creates a LOGIN role `wallpapers-distributor` with no memberships, ownership, CREATE, TEMPORARY, elevated attributes or broad default grants. Give it CONNECT to `wallpapers` and USAGE on `public`. Set its password privately. The normal release migration creates distribution tables; the deployer applies `deploy/distribution-grants.sql` using the migrator connection afterward. The worker checks `deploy/verify-distribution-grants.sql` at every start. It receives no app data, migration-history or sequence rights. The migration extends the existing backup role's explicit SELECT list when that role exists. No default grants are added.

Create the non-internal Docker network `wallpapers-distribution-egress` with label `foundation.want.wallpapers.distribution=true`. It has no published ports, proxy alias or Docker socket mount. Create the root-owned outbox with group 10002 and mode 0750. Run the exporter before the first new collection deployment to preserve the existing catalogue as baseline:

```sh
sudo python3 -I /usr/local/lib/wallpapers-deploy/scripts/distribution-export.py
```

Install the reviewed `deploy/want-wallpapers-distribution.service` and `.timer` under `/etc/systemd/system/` and run `systemctl daemon-reload`. Keep the timer disabled until the deployed image includes `distribute`, grants pass and resource use is measured. The launcher takes only that verified image, never builds or pulls. The container has one Tokio thread, 20% CPU, 128 MiB RAM/swap, 64 PIDs, a read-only root, no capabilities and a 1 MiB temporary filesystem. Root helpers have a separate systemd 128 MiB bound. A run processes at most 20 attempts within its 210-second budget; systemd limits startup to 240 seconds.

Run one controlled `--once`, record `memoryPeakBytes` and Docker CPU/memory limits, then confirm readiness and other services. Local tests do not establish VPS resource acceptance. Enable the five-minute timer only after that check:

```sh
sudo python3 -I /usr/local/lib/wallpapers-deploy/scripts/distribution-run.py --once
sudo systemctl enable --now want-wallpapers-distribution.timer
```

## Status and recovery

Use owner SSH for these private operations. This does not widen the restricted deployment account.

```sh
sudo python3 -I /usr/local/lib/wallpapers-deploy/scripts/distribution-run.py status
sudo python3 -I /usr/local/lib/wallpapers-deploy/scripts/distribution-run.py select 0007-organic-resonance telegram
```

Status returns deliveries and publication-conflict summaries with only IDs, hashes, state, attempts, retry time and safe error codes. No public API is added. Before authorizing accounts, stop the timer and wait for `want-wallpapers-distribution.service` to become inactive. Verify the fixed worker container is absent. Hold the shared exclusive credentials lock during any reauthorization write. Do not edit credentials during an active worker; an uncoordinated writer can overwrite a concurrent rotation. Keep the timer disabled during manual reconciliation.

For an unknown item, inspect the provider's actual state first. Save an allowlisted remote receipt as a private JSON file directly inside the credentials directory. The file must contain exactly `schemaVersion: 1`, the matching `collectionId`, `destination` and `item`, and a nonempty `remoteIds` array of at most 200 short IDs. Credentials and unknown fields are rejected before any database update. Then resolve the exact item and payload hash:

```sh
sudo python3 -I /usr/local/lib/wallpapers-deploy/scripts/distribution-run.py resolve <collection> <destination> <item> <payload-hash> delivered /run/distribution/verified-receipt.json
```

Only after confirming absence at the provider may the owner use `absent --confirmed-absent` instead. The previous unknown attempt remains in history; another attempt gets a new generation. A payload conflict requires investigation. Never edit queue payloads, reset successful deliveries, clear the database or infer absence from a timeout. Baseline metadata is immutable too; incomplete historical packages are not silently replaced with different bytes.

The launcher removes its verified container and disposable data on completion, error and SIGTERM. Systemd's cleanup handles an interrupted launcher only after its labelled host PID has exited. It refuses unknown ownership and preserves a live manual launcher. After abrupt termination, inspect that fixed container and run the reviewed cleanup operation if needed. Retain database receipts and root outbox files.
