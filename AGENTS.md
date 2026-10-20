## Agent skills

### Issue tracker

Issues live in GitHub Issues for `andrey-krasheninnikov/want-wallpapers`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context glossary and ADR layout. See `docs/agents/domain.md`.

### Feature releases

Use [release-patch](.agents/skills/release-patch/SKILL.md) for a patch increment with the fast pipeline and [release-minor](.agents/skills/release-minor/SKILL.md) for a minor increment with the full pipeline. Both use the shared [release-feature procedure](.agents/skills/release-feature/SKILL.md), which also supports feature branches and releases with an explicit version.

### Collection releases

Use the project [release-collection skill](.agents/skills/release-collection/SKILL.md) when adding and releasing a collection from a CDN folder. This workflow takes precedence over `release-patch`, `release-minor` and `release-feature` for collection releases.

### Repository layout and checks

Frontend source and catalog tools live in `frontend/`; Rust API and migrations live in `backend/`. Use root `Makefile` for checks. Read `docs/adr/0004-rust-monorepo.md`, `docs/api.md` and `docs/deployment.md` for backend or deployment changes. PostgreSQL 18 is external in production. Firebase is limited to optional Analytics. Preserve public routes and four locales.

### Visual contract

Read [DESIGN.md](DESIGN.md) before changing a visual surface. The site is a gallery on neutral graphite planes with a saturated violet accent and one softly blurred violet gradient sphere. The supplied pixel portfolio reference guides color and atmosphere. Want Keep guides filled surfaces, Want Brief guides depth and transitions, and Flutter Grades guides compact type. Preserve the existing logo, catalog imagery, public routes and four locales.

- Use exact tokens: background #141414, text #E8E8E8, card #1C1C1C, secondary #252525, accent #303030, media ground #101010, muted text #ADADAD, primary #5B4FFF, primary hover #6357FF, primary active #5549EB, readable links #E8E8E8, input #858585 and error #FF738D.
- Group content with fills, spacing and type. Do not add decorative borders, divider lines or inset hairlines. Outline variants use fills. Controls keep their fills during focus and use a 2 px logo-color outline with a dark backing. Inputs, textareas and the wallpaper viewer retain dark fills with a 2 px #5B4FFF focus outline, offset by 3 px. Forced colors keep system focus.
- Use locally served Onest Variable for headings and Manrope Variable for body and controls. Use system monospace for small indices and metadata. Keep Chinese fallbacks. Hero is 32–50 px, page title 28–40 px, section title 22–30 px. Body and inputs are at least 16 px; secondary labels at least 14 px.
- Reuse Tailwind v4 tokens and installed Radix-based shadcn sources. Fields have 12 px corners, media and panels 24 px, prominent surfaces 32 px and CTA buttons capsule corners. Keep accessible labels and 44 px targets.
- Compose long text as readable sections up to 65ch. Keep legal/supporting text in the same page composition and preserve legal wording. Contact rows retain their current destinations. Comments remain a compact guest/self feed with existing actions.
- Wallpaper pages use two columns from 1024 px (60% image, 40% controls, 32 px gap). A constant viewer frame contains landscape and portrait images without cropping, with a blurred artwork backdrop filling unused space; height is clamp(420px, 60svh, 640px). Below 1024 px, viewer/navigation/controls stack with clamp(320px, 58svh, 520px) frame height. Arrows stay beneath the frame. Format, download, compact ratings, description/license/tags occupy the control panel. Comments precede long stories. Long stories, legal and support copy use up to three columns, minimum 18rem and 32 px gaps. Preserve 16 px body text and 44 px targets.
- Public pages and /ui-kit/ use one softly blurred violet gradient sphere on the graphite background. Keep it behind content in a fixed, clipped, non-interactive container, centered at 78% 22%, with a 36-second transform-only drift and constant .18 opacity. Provide a localized pause/resume control, save only an explicit choice under want-background-motion, and pause in hidden tabs. Reduced motion keeps a static background; forced colors remove decoration. Administration inherits the palette without the animated background.
- Use opaque reading surfaces and clear filled states. Avoid large colored halos on controls, cards and the device stage. Main text is soft white; supporting text is neutral.
- Motion includes 120 ms control feedback, 180 ms wallpaper transitions and the slow background sphere. Gallery hover and focus use a visible 2 px logo-color wave (2.6 seconds per circuit), without tilt, movement or scaling; reduced motion keeps it static. The restrained wand effect follows active links and buttons, including nested labels and SVG icons, and excludes ordinary text, editable fields and media. It preserves the native cursor and selection, uses at most three 12 px sparks with .45 maximum opacity, a 160 ms spawn interval and 450 ms duration, and has no halo or scaling; download confetti lasts 800 ms and never delays the PNG download. Disable decorative interaction effects for reduced motion, unsuitable pointers and forced colors. The local 3D hero loads automatically and rotates at 5 degrees/second, with pause/resume, hidden-tab/offscreen suspension, static reduced-motion rendering, retry and manual control. Completed manual rotation selects a random different work and switches both textures after loading. Automatic rotation and Reset preserve the wallpaper; texture failures retain the previous pair. Video covers still require a press.
- Liquid glass uses 68% neutral translucent fills, 20 px blur, 120% saturation and shared glass tokens and soft light/shadow on navigation, controls, dialogs and card captions. Reading surfaces stay opaque; unsupported backdrop-filter, reduced transparency and forced colors use opaque fills. No decorative borders.
- Feedback links open one lazy dialog on the current page, preserve the draft in memory, trap focus and restore it on close. Direct localized /feedback/ routes remain compatible. Home collections use a finite scroll-snap carousel with pagination; home highlights use an image-only mosaic of up to six distinct works, with three responsive compositions and a 180 ms crossfade every 15 active seconds. Pause on hover, focus, hidden tabs, offscreen visibility or the localized mosaic button; reduced motion stays static. Load replacement previews before changing links, retain a working frame on failure and clean up on navigation. Home collection stories use native details, initially closed.
- Language choices display decorative country flags: en 🇬🇧, ru 🇷🇺, zh-cn 🇨🇳, pt-br 🇧🇷; retain locale identifiers and accessible labels.
- Wallpaper arrows, page keyboard controls outside text editing, widgets, selection and open dialogs and horizontal swipes traverse the complete catalog newest first by immutable publication date and wrap at both ends. Preserve locale and variant. Astro ClientRouter switches wallpaper routes without reloading and preserves the viewer position, variant, metadata and history. Once Yandex advertising starts, navigation reloads the document while preserving locale, variant and the viewer fragment. Advertising is excluded from localized homes, admin, errors and ui-kit. Consent withdrawal after advertising requests start reloads the document with advertising disabled. Header, cookie state and feedback drafts persist; page-specific listeners clean up on swaps. Native links and download anchors remain usable without JavaScript. Public social responses contain the latest ten visible comments in a paginated horizontal card carousel, above long reading.
- Cookie buttons follow settings, necessary only, allow all in DOM and visual order. Footer uses the exact label Telegram Channel in every locale.
- /ui-kit/ is development-only. Keep it out of production output. Reuse its primitives and compositions across public pages and administration.
- For these revisions, use one static pass, one cached-media build and focused browser/backend tests. Do not repeat full suites, backup or CDN synchronization. Compare current screenshots with supplied references and docs/design/feedback.png. Report local, CI, browser and physical-device evidence separately. Visual review is approved. Complete PR #63, issue #59 and the production release through the project release-feature workflow.
