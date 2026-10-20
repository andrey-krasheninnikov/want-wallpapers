---
name: prepare-collection
description: Prepare a private collection package from a theme, review its exact contents and record approval before publication.
---

# Prepare a collection

Use one interactive session. Ask for the collection theme and a stable unused collection ID before generation. Read DESIGN.md, the catalogue taxonomy, six canonical locales and docs/ideas/collection-publishing.md. Preparation does not authorize upload, catalogue import, a release or external posts.

Create a private directory outside every source checkout with mode 0700. Run `bun run collection init /absolute/private/directory <collection-id> "<theme>"`. Keep files 0600. Never put credentials, private artwork or review pages in Git or public artifacts.

Prepare five distinct designs. Generate separate landscape desktop and portrait mobile compositions of each scene using the available interactive image tool and included usage. Do not invoke unattended generation or switch to a paid image API. Save native PNG bytes unchanged. If the aspect ratio differs, extend the composition through an image edit before resizing; retain the native source and extended composition separately. Stop on exhausted included usage. Allow at most two automatic repair passes for the package; record them privately and stop for owner revision after that limit.

Produce ten final PNGs at 3840x2160 and 2160x3840, ten WebP previews at 960x540 and 540x960, and five portrait JPEG social previews at 1080x1920. Use Sharp proportional resizing only after the source has the exact destination ratio. Never crop, stretch or describe enlarged pixels as native 4K.

Create five distinct transparent static 100x100 PNG emoji motifs and retain their source artwork. Each asset entry records relative path, role, design 1–5, variant when applicable, SHA-256, width and height. Final assets identify their native or composition source; extended compositions identify their native source. Roles are native, composition, final, preview, social, emoji and emoji-source.

Complete package.json schemaVersion 1 with revision, theme, canonical manifest, stories for en/ru/zh-cn/pt-br/ja/ar, assets and English copy for telegram, pinterest, tumblr, deviantart and flickr. Telegram and Tumblr have one post each; other destinations have five. Each post has title and description. Respect the existing licence and required destination classifications.

Run `bun run collection prepare PRIVATE_DIRECTORY` to create derivatives and refresh asset hashes from native/composition and emoji-source entries. This increments revision; then run `bun run collection validate PRIVATE_DIRECTORY`, then `bun run collection review PRIVATE_DIRECTORY`. Open only the returned local HTML file. Inspect both variants of every design, original dimensions, enlarged labels, every translation/story, emoji at actual size and destination copy. Correct files before approval, increment revision and repeat validation. Do not change the package after approval.

Ask the owner to approve the exact displayed package hash. Only an explicit approval permits `bun run collection approve PRIVATE_DIRECTORY SHA256`; rejection uses reject with that same hash. No guessed approval or inherited approval from another package. `status` and `resume` revalidate bytes; preparation resumption never publishes. Publication follows the separately authorized local collection publishing path and must revalidate approval immediately before every phase.
