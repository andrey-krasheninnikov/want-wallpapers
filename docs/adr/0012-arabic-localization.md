# 0012: Arabic catalog and document direction

Status: accepted. Extends ADR 0010 to six required locales.

Arabic uses `ar` and Modern Standard Arabic throughout public pages, catalog metadata and full collection stories. Existing typed dictionaries, static pages, gallery data and Lunr remain the implementation. Noto Sans Arabic is self-hosted and loaded on Arabic pages and the translation editor. No translation service or replacement UI framework is introduced.

Catalog writes and imports require exactly en, ru, zh-cn, pt-br, ja and ar. Rejecting five-locale input prevents incomplete publication and older writers losing Arabic content. Legacy drafts remain readable with their assets and budget history; approval and packaging require the complete contract.

A transactional migration fills missing Arabic translations for known records whose English source matches. It preserves existing nonempty Arabic and every unrelated field, increasing optimistic versions only for changed records. Unknown untranslated or changed-source records abort the transaction, including archived records. Apply through the controlled release procedure with app stopped; preserve applied migration history and translations on recovery.

Document direction belongs to HTML: Arabic is RTL and other locales are LTR. Radix controls receive reading direction; logical spacing and isolated technical values keep mixed text legible. Artwork, device geometry and physical rotation controls keep their orientation. Collections, stories and comments use a shared logical scroll offset. Semantic next moves left in Arabic, including wallpaper keys and swipes; LTR navigation keeps its behavior.

The installed Arabic Lunr plugin handles stemming. Index, query and fallback normalize vowels and tatweel consistently. SEO retains reciprocal alternates, matching language and direction, and existing segmented-word and text/HTML thresholds. Original PNG paths, identities, publication dates, listing state and social data are preserved.
