# 0008: Catalogue publication dates and gallery order

Status: accepted. Extends [0004](0004-rust-monorepo.md).

Search and wallpaper navigation present newer catalogue entries first. Updating translations, importing the same manifest or restoring an archive preserves the original position in this chronology.

Store nullable published_at separately from wallpaper JSON. New public records receive the transaction time. Known historical IDs receive the timestamp of the first public catalogue release containing them, including initial database seeding. Existing records without reliable history remain undated. The glossary term Collection publication still refers to availability on the public website; static pages update after catalogue export and build.

The public snapshot adds publicationDates, a map from active wallpaper IDs to UTC ISO timestamps. The strict collection import format remains unchanged. Older snapshots without the map remain readable. Search and wallpaper neighbors sort by timestamp descending, then collection ID and number descending; undated records follow dated records. Collection work indices retain their number order.

Collections store their own nullable published_at outside the editable JSON. A nonempty import sets it once; an empty collection remains undated until its first wallpaper is saved. Later additions, edits and archive/restore preserve it, including when all wallpapers are hidden. Existing populated collections without reliable history remain undated when another wallpaper is added. Deriving the date from the current visible wallpaper set would change chronology after archival, so readers use the persisted collection date.

The migration fixes the first five dates from the established wallpaper publication history and Neon Tide from its v1.8.0 snapshot metadata, 2026-10-19T20:13:10.668531Z. These timestamps describe catalogue publication evidence, not production deployment time. The snapshot adds collectionPublicationDates keyed by active collection ID. Public lists, stories and administration use descending timestamp then descending collection ID, with undated entries last. Comparison preserves PostgreSQL microseconds. Wallpaper ordering and collection work indices keep their existing rules.

Old snapshots remain readable without collectionPublicationDates. The pull command requires this map before replacing a snapshot, so the backend migration and runtime function grants precede the next export. The expanded schema keeps existing JSON writes compatible; do not drop publication metadata during application rollback.

The gallery uses a large image with a compact glass action dock, followed by description, license, tags, collection context and discussion. Portrait and phone layouts keep controls below the image. Home mosaic thumbnails may crop to their tiles; detail previews contain the full artwork. This thumbnail rule updates the preview presentation in [0003](0003-shadcn-interface.md).

Schema changes run through the existing migration workflow. Local migration and backup/restore checks do not deploy the schema or establish production availability.
