# Collection distribution on the VPS

Part of #123 and #126. The Rust `distribute` command provides the durable queue shared by #127 and #31–#34. Telegram, Pinterest and Tumblr delivery are implemented below; the remaining adapters and real platform acceptance belong to their separate issues. An unavailable adapter leaves its items `blocked` with `destination-adapter-unavailable`.

## Publication and delivery contracts

The private root exporter reads the running healthy app, its immutable image, architecture and OCI revision. These must match a retained server request with `succeeded`, `complete` and `backupVerified=true`. A catalogue row, tag or PR alone is insufficient. `/var/lib/want-wallpapers/publications/<requestId>.json` keeps schema version 1, verification time, nine allowlisted release fields and the catalogue's collection IDs with optional public package metadata. It contains no signing material, Google credentials or private preparation paths. Existing files are immutable; repeated export verifies their content without changing verification time. The exporter always reads the actual runtime catalogue and requires exact catalogue IDs and manifest contents, including wallpaper membership. A stale, private or mismatched package becomes unverified for that collection; it cannot suppress independent valid packages or block the next deployment. Existing pending/retryable intents for conflicting metadata are blocked, while successful and unknown receipts remain intact. Owner selection cannot bypass a recorded metadata conflict.

`runtime-publications.json` belongs to the image, outside the HTTP static directory. It carries the catalogue IDs and public packages. Older images without that file supply a baseline from `runtime-catalog.json`. The first batch registers existing collections without enqueueing historical announcements. Later batches discover collections absent from that baseline, including manual releases. Export runs before each timer tick. Once provisioning exists, deployment also waits for the worker and exports the previous live image before replacing it. An interrupted handoff is retried from the retained server journal and current image, without deploying or posting again.

PostgreSQL records batches, publications, delivery intents and attempts. A collection payload and its hash remain immutable. Conflicting later metadata is recorded in the new batch without replacing that collection or blocking independent new collections. Status includes these publication conflicts; they require owner review. Each `(collection_id, destination, item)` is unique. Telegram has an emoji-set and album intent; Pinterest, DeviantArt and Flickr have five items each; Tumblr has one photoset. Missing configuration blocks that destination. Missing public package fields block the affected adapter. Adding credentials does not automatically select old blocked work. The owner selects a collection and destination explicitly; future collections use the configuration present at ingestion.

Claims use a short transaction with `FOR UPDATE SKIP LOCKED`. The transaction commits before HTTP. Completion requires the matching claim UUID and generation. A successful item stays delivered when another fails. `retryable` respects the next-attempt time and provider Retry-After. Confirmed rejection becomes blocked; an ambiguous write or malformed success becomes unknown. An interrupted claim older than five minutes becomes unknown. Telegram emoji-set claims can read back an unknown write after five minutes. Only confirmed missing operations can resume; albums and other uncertain writes require explicit reconciliation. A recorded publication conflict also blocks automatic emoji reconciliation. No process turns unknown into a blind retry.

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

## Telegram configuration and acceptance

Use the existing `@want_wallpapers_bot`. The owner must first start a private conversation with the bot, provide its numeric owner user ID and grant the bot administrator access with `can_post_messages` in `@want_wallpapers`. Keep `telegram.json` inside the private distribution credentials directory, owned by 10002:10002 with mode 0600. It contains exactly these fields, with real values supplied privately:

```json
{"enabled":true,"token":"<private bot token>","ownerUserId":123456789,"channelId":-1001234567890}
```

Stop the timer, wait for any running service and worker container to exit, and hold `credentials.lock` while installing or replacing this file. Never place the token in a command argument, GitHub, build input or log. Each attempt checks the bot username and token identity, channel username/numeric ID and posting permission. Token-bearing HTTP URLs and provider error descriptions never leave the HTTP boundary. Telegram's JSON `parameters.retry_after` and HTTP Retry-After are honored; reads can retry, while uncertain public writes remain unknown.

The first approved collection creates `want_wallpapers_collections_by_want_wallpapers_bot`, titled `Want Wallpapers Collections`, as a `custom_emoji` set. Later collections append to that same set. The existing `https://t.me/addemoji/want_wallpapers` is never queried or modified by this adapter. A pre-existing new set without a native receipt or persisted creation intent requires owner review. `getStickerSet` has no owner field: the configured owner ID binds the creation request, and an unchanged-title write confirms this bot's management permission before delivery is recorded. A name suffix alone is insufficient proof.

The approved pipeline supplies PNG motifs. The worker decodes each file with bounded memory and requires a static 100×100 image with visible and transparent pixels, five distinct source hashes and distinct upload identities. Native upload receipts record each design, SHA-256, `file_id` and `file_unique_id`. Readback records the corresponding `custom_emoji_id` and the complete set membership. It preserves all earlier identities, blocks unexpected content or owner changes and stops additions for owner review when five new motifs would exceed 200 items. It never deletes or replaces emoji. Uncertain private uploads may repeat because they cannot publish a set or channel message; confirmed upload IDs survive restart.

Only one collection can update the shared set at a time. A collection with persisted progress retains the shared set until completion, including across retries and owner selection of an older collection. A partially progressed blocked collection holds all other set updates for review. Every create/add operation has a persisted intent before the request. An unknown attempt first performs readback without a public write. Present items advance; confirmed missing items can resume on a later claim. Identical adds and unique set names provide Telegram's documented idempotency boundary. Interrupted runs preserve their generation and previous attempt history.

The album waits for the same collection's native emoji receipt and verifies that all confirmed emoji remain present. It checks the English collection and five wallpaper canonical pages, downloads five hash-bound 1080×1920 JPEG social previews, and validates framing, dimensions and a 5 MiB per-image limit. Captions use plain text, so HTML and Markdown characters remain literal. The first caption includes the approved English copy, canonical collection and wallpaper URLs, and new addemoji URL; later captions link the remaining wallpapers. Captions are limited to 1024 UTF-16 units. Five distinct message IDs, the expected channel, photo receipts and one shared media-group ID are required for success. A lost or malformed album response stays unknown and cannot be sent again automatically. Telegram calls use no paid broadcast option.

A whole adapter attempt has a 60-second deadline within the existing worker budget. Deadline interruption is conservatively unknown; an album may then need owner reconciliation even if no post became visible. The shared status and recovery commands apply. Manual receipts can close an uncertain album after provider inspection, but cannot replace the native emoji receipt required by the album and future set updates.

For the first live acceptance, keep the timer disabled until #126 provisioning and resource checks pass. Release the exact approved package, verify its deployed pages, install the private configuration, and select only that collection for Telegram. Observe one controlled run, inspect the new set's five additions and channel album, then confirm their native receipts before enabling the timer. Subsequent ticks and restarts must leave confirmed messages unchanged. Unconfigured platforms remain blocked independently.

Primary API contracts: [Bot API methods and responses](https://core.telegram.org/bots/api), [static emoji requirements](https://core.telegram.org/stickers#static-stickers-and-emoji). Local fixtures cover recovery and validation; only real provider readback completes #127 acceptance.

## Pinterest configuration and acceptance

The owner registers the site account and app, creates a public board, completes domain/access verification required by Pinterest and obtains Standard API access. Trial Pins and boards are visible only to their creator and do not complete #31 acceptance. `accessTier: "standard"` is an operator declaration, not a live API proof of the tier. Actual public visibility is checked separately during acceptance.

Complete the [Authorization Code flow](https://developer.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/) with the registered redirect URI and a private random state, verifying the returned state before exchanging the code. Use the official connection flow; never collect passwords or session cookies. Request exactly `boards:read boards:write pins:read pins:write user_accounts:read`. Record the returned scope and the absolute Unix access-token expiry. New apps use continuous refresh tokens; retain both returned tokens privately. Authorization codes, client secrets and tokens must not appear in command arguments, history, GitHub or logs.

Install `pinterest.json` as 10002:10002/0600 inside the same locked credentials directory, with the timer stopped and worker absent. Its required fields are:

```json
{"enabled":true,"accessTier":"standard","username":"<public account username>","boardId":"<numeric board ID>","clientId":"<app ID>","clientSecret":"<private client secret>","accessToken":"<private pina token>","refreshToken":"<private pinr token>","accessTokenExpiresAt":1800000000,"scope":"boards:read boards:write pins:read pins:write user_accounts:read"}
```

`refreshPending` defaults to false. Before refresh, the worker atomically saves it as true. A successful refresh validates and saves the rotated access/refresh tokens before any Pin request, then clears the marker. A confirmed rate-limit rejection clears the marker and schedules retry. A lost, malformed or interrupted refresh retains the marker and blocks Pinterest for owner reauthorization, preserving the other destinations. Never clear this marker based only on a timeout. Normal rotation uses the shared file lock and previous-file hash check. A revoked token or missing permission also requires reauthorization.

The worker checks the authenticated username and configured board's owner, public privacy and advertising-only state. Each of the five delivery intents selects its matching approved English copy, social preview and live English canonical wallpaper page. Only the hash-bound 1080×1920 JPEG preview is sent, as `image_base64`; full originals are excluded. Titles, descriptions and alternative text respect the native 100/800/500 character limits. Invalid copy is blocked without truncating the approved text. The JPEG framing/dimension check is shared with Telegram and relies on the existing approved source hash boundary.

The optional private `aiDisclosures` array accepts only the API's `AI_MODIFIED` and `SYNTHETIC_PERFORMER` declarations. When supplied, the worker sends the native `ai_disclosures.values` field and verifies it during Pin readback. It does not insert a declaration by default. The owner checks the platform's current content and disclosure requirements before enabling publication. Unknown declarations are rejected.

A confirmed create response saves the numeric Pin ID and exact request/source hashes as progress. The next claim reads that same Pin and confirms its account, board, image type, English copy and canonical link before recording delivery. A retry or restart with a saved ID never issues another create request. A lost create response remains unknown for explicit provider inspection; a known Pin disappearing or changing blocks the intent instead of silently posting a replacement. Manual delivered receipts use the shared recovery format after actual account inspection. Only confirmed absence permits explicit retry of an unknown creation. Successful Pins remain delivered across another Pin's failure.

Before first acceptance, release the approved collection and worker, complete the resource checks, install this private connection and select only that collection for Pinterest. Verify five actual public Pins and their canonical links outside the owner's Sandbox view. Retain their native receipts, repeat a tick/restart and confirm no extra Pins. Keep #31 open until this public readback succeeds. Unavailable Standard access leaves Pinterest blocked independently.

Primary contracts: [Pinterest OpenAPI](https://github.com/pinterest/api-description/blob/main/v5/openapi.json), [access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/), [image Pin creation](https://developer.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/).

## Tumblr configuration and acceptance

The owner creates the public blog and registers the site application in [Tumblr OAuth apps](https://www.tumblr.com/oauth/apps). Complete the Authorization Code flow with the registered redirect URI and `basic write offline_access`, verifying the private random state before exchanging the returned code. Record the authorized account name, blog name and stable `t:` blog UUID from the API. The UUID identifies the target across domain changes; a changed configured blog name requires owner review of saved progress. No public blog identity has been confirmed yet. Do not enable this destination until that identity and the owner's posting rights are verified.

Install `tumblr.json` as 10002:10002/0600 in the locked private credentials directory with the timer stopped and worker absent:

```json
{"enabled":true,"username":"<authorized account name>","blogName":"<public blog name>","blogUuid":"t:<blog UUID>","clientId":"<private consumer key>","clientSecret":"<private consumer secret>","accessToken":"<private access token>","refreshToken":"<private refresh token>","accessTokenExpiresAt":1800000000,"scope":"basic write offline_access"}
```

Use the official OAuth connection flow. Keep codes, client secrets and tokens outside arguments, history, GitHub and logs. Save the absolute Unix expiry from the returned lifetime. Refresh uses Tumblr's form-encoded `/v2/oauth2/token` exchange and atomically preserves both rotated tokens. The persisted `refreshPending` marker follows the same recovery rules as Pinterest: confirmed rate limits permit retry; an interrupted or malformed refresh requires owner reauthorization. Replacing one connection does not unblock old work automatically or affect another platform.

Each attempt checks `/user/info` for the expected account and the exact blog UUID/name in the user's writable blogs, with `type: public`. One Neue Post Format post contains the five approved 1080×1920 JPEG social previews, English collection title/copy and six live canonical links. Images form two rows of two and three; text and links follow without truncation. Alternative text uses each approved English wallpaper title. Multipart starts with an `application/json` part named `json`, followed by the five matching file identifiers. The full wallpaper PNGs are never uploaded. Text blocks respect the native 4096-code-point limit, and each preview has the shared 5 MiB limit. A stable User-Agent accompanies every Tumblr request.

A `201` response with matching JSON status and a valid string post ID saves that ID, blog identity, five source hashes and the exact request hash as progress. A later claim fetches that same post in NPF, checks its published state, blog, ordered image descriptions, media dimensions/URLs, text, link formatting and complete row layout, then records delivery. Tumblr can resize uploaded media; source hashes bind the bytes sent, while API readback checks the returned media references and composition. It does not prove byte equality after Tumblr's processing. A saved post ID never triggers another create, even if the post disappears or changes.

Lost or malformed creation responses remain unknown for explicit provider inspection. Known-ID read failures can retry readback; authorization failures block the connection. Rate limits honor Retry-After. A 60-second adapter deadline fits the shared worker budget and conservatively leaves an interrupted attempt unknown. Use the common status and reconciliation commands; only confirmed absence permits an explicit retry after an unknown creation.

For live acceptance, release the approved collection and worker, pass #126 resource checks, install the authorized private connection and select only that collection for Tumblr. Verify one public post with five faithful previews and working canonical links, retain its native receipt and confirm a later tick/restart creates no duplicate. Check the current [Community Guidelines](https://www.tumblr.com/policy/en/community) and [API agreement](https://www.tumblr.com/docs/api_agreement) before enabling publication; those policy pages were unavailable during implementation. Account access, live public visibility and content-policy acceptance remain outstanding, so #32 stays open.

Primary contracts: [Tumblr API and OAuth2](https://github.com/tumblr/docs/blob/master/api.md), [NPF content, multipart references and limits](https://github.com/tumblr/docs/blob/master/npf-spec.md). Local tests exercise protocol and recovery without calling a real blog.
