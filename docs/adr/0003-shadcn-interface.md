# 0003: Use shadcn/ui with React islands

Status: superseded in backend and deployment details by [0004](0004-rust-monorepo.md)

Astro continues to render the public catalogue, localized text and SEO metadata as static HTML. React islands handle navigation, search, variant selection, ratings, comments, feedback and cookie settings. Static cards, breadcrumbs and links also use the same source-owned shadcn/ui components during server rendering.

The interface uses Radix primitives, the new-york component style and Tailwind CSS 4. Want colours remain semantic CSS variables. Manrope is served locally. Preview dimensions come from the generated image manifest; previews display the complete artwork without cropping.

The migration preserves public URLs, four locales, Firebase Spark, data fields, regional restrictions and the stored cookie choice. Browsing and both PNG downloads remain available without JavaScript. Interactive forms explain their JavaScript requirement; FAQ answers remain in the initial HTML.

Browser checks use a separate production build and local Firebase Auth and Firestore emulators. They do not deploy the site or change the live Firebase project.
