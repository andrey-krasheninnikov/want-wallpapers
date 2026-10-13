# 0008: Catalogue publication dates and gallery order

Status: accepted. Extends [0004](0004-rust-monorepo.md).

Search and wallpaper navigation present newer catalogue entries first. Updating translations, importing the same manifest or restoring an archive preserves the original position in this chronology.

Store nullable published_at separately from wallpaper JSON. New public records receive the transaction time. Known historical IDs receive the timestamp of the first public catalogue release containing them, including initial database seeding. Existing records without reliable history remain undated. The glossary term Collection publication still refers to availability on the public website; static pages update after catalogue export and build.

The public snapshot adds publicationDates, a map from active wallpaper IDs to UTC ISO timestamps. The strict collection import format remains unchanged. Older snapshots without the map remain readable. Search and wallpaper neighbors sort by timestamp descending, then collection ID and number descending; undated records follow dated records. Collection work indices retain their number order.

The gallery uses a large image with a compact glass action dock, followed by description, license, tags, collection context and discussion. Portrait and phone layouts keep controls below the image. Home mosaic thumbnails may crop to their tiles; detail previews contain the full artwork. This thumbnail rule updates the preview presentation in [0003](0003-shadcn-interface.md).

Schema changes run through the existing migration workflow. Local migration and backup/restore checks do not deploy the schema or establish production availability.
