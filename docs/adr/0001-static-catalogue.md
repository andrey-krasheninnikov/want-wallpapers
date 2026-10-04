# 0001: Build the public catalogue as static pages

Status: superseded in backend and deployment details by [0004](0004-rust-monorepo.md)

The catalogue is exported from Cloud Firestore before a build. Astro renders localized collection and wallpaper pages with canonical URLs, language alternates, descriptions, and structured image data. Browser search uses the same exported catalogue. This keeps catalogue browsing available when Firestore is slow.

Original PNGs remain on the image host. The build checks and copies them to site hosting for direct downloads, and makes WebP previews for pages. Every build requires access to the image host. A changed catalogue requires a new export and build. Hosting traffic for the PNG copies must be monitored because the files are large.
