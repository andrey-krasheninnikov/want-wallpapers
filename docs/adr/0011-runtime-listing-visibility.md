# 0011: Runtime listing visibility with static direct pages

Status: accepted. Revises the publication model in ADR 0004 and the caching of gallery data in ADR 0009.

Collections and wallpapers have independent `listed` flags, initially true. Archive remains separate. General discovery requires a nonarchived listed collection and a nonarchived listed wallpaper. A direct collection page ignores its own listing flag when selecting its contents. A shown collection with no listed wallpapers remains discoverable with a count of zero.

The build exports every nonarchived record through `/api/v1/catalog/snapshot`, including listing flags. Astro retains all direct pages, original downloads and sitemap entries. New records and content changes still need a build. Visibility changes do not alter identity, chronology or social data.

The existing Rust process reads one consistent PostgreSQL listing snapshot for each public request. It projects the built HTML and hydration props together, and filters gallery JSON and llms.txt. Build-generated fragments reuse the same React components for scene, mosaic and navigation markup. The runtime manifest stays beside the static directory, outside the public document root. No additional rendering service runs in production.

Projected responses use no-store. Runtime requests bypass static conditional and range handling; failures return 503 instead of stale discovery. Gallery URLs in hydration props include a listing fingerprint so a later navigation cannot reuse an earlier browser payload. CSP hashes cover the final inline script bytes, including filtered collection JSON-LD. Security policy exceptions do not expand.

This adds a database dependency to public discovery and couples projection to the pinned Astro serialization format. Tests cover native HTML, hydration and final CSP hashes. Astro upgrades must verify that contract. A client-only filter would leave stale HTML and native links; another server runtime would change the deployment model without solving a separate requirement.

Rollout requires the additive SQLx migration before the matching application and static build. Existing rows retain their archived state and receive listed=true. Production migration and deployment remain explicit operator actions. Rolling back the application after using listing controls can expose previously hidden discovery until a compatible version is restored; it does not make the public originals private.
