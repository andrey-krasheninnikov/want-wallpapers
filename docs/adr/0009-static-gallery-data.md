# 0009: Static gallery data and collection stories

Status: accepted.

## Context

Home and collection-list stories appear as short cards with complete stories in dialogs. Removing full story disclosures reduces readable text. The home page also serialized the same complete wallpaper pool twice for its device scene and mosaic, leaving too much HTML to meet the existing text/HTML requirement.

## Decision

Build one public JSON file per locale at /gallery-data/<locale>/<sha256>.json. It contains the published wallpaper pool and complete localized collection stories, including static cover metadata. The hash identifies the exact bytes produced by the same build as the pages.

Keep meaningful cards, native collection-story links, the initial device wallpaper and initial mosaic in HTML. Render story cards through a static slot to avoid serializing their content again. All three consumers reuse a single bounded request. Preserve the existing complete stories on collection and wallpaper pages.

## Consequences

Initial content and navigation work without JavaScript. The full interactive pool and dialog text require one same-origin request. Failed or invalid data keeps the initial previews and offers the collection route for reading. No runtime API, database access, new dependency or cache-policy change is required. Keep the global 200-word and greater-than-10% text/HTML checks unchanged.
