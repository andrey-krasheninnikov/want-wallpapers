## Agent skills

### Issue tracker

Issues live in GitHub Issues for `andrey-krasheninnikov/want-wallpapers`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context glossary and ADR layout. See `docs/agents/domain.md`.

### Feature releases

Use the project [release-feature skill](.agents/skills/release-feature/SKILL.md) for Gitflow feature releases.

### Collection releases

Use the project [release-collection skill](.agents/skills/release-collection/SKILL.md) when adding and releasing a collection from a CDN folder. This workflow takes precedence over `release-feature` for collection releases.

### Repository layout and checks

Frontend source and catalog tools live in `frontend/`; Rust API and migrations live in `backend/`. Use root `Makefile` for checks. Read `docs/adr/0004-rust-monorepo.md`, `docs/api.md` and `docs/deployment.md` for backend or deployment changes. PostgreSQL 18 is external in production. Firebase is limited to optional Analytics. Preserve public routes and four locales.

### Visual contract

Read [DESIGN.md](DESIGN.md) before changing a visual surface. The site is a gallery on graphite planes. Want Keep guides fills and colors, Want Brief guides depth and transitions, and Flutter Grades guides compact type. Preserve the existing logo, catalog imagery, public routes and four locales.

- Use exact tokens: background #1A1A1A, text #F5F5F5, card #202020, secondary #262626, media ground #111114, muted text #B3B3B3, primary #5F4EF5, primary hover #6B5AF6, primary active #5142D5, readable accent #A79BFF and error #E58B91.
- Group content with fills, spacing and type. Do not add decorative borders, divider lines or inset hairlines. Outline variants use fills. Keyboard focus uses inverted fill/text; forced colors keep system focus.
- Use locally served Onest Variable for headings and Manrope Variable for body and controls. Keep Chinese fallbacks. Hero is 32–50 px, page title 28–40 px, section title 22–30 px. Body and inputs are at least 16 px; secondary labels at least 14 px.
- Reuse Tailwind v4 tokens and installed Radix-based shadcn sources. Fields have 12 px corners, media and panels 24 px, prominent surfaces 32 px and CTA buttons capsule corners. Keep accessible labels and 44 px targets.
- Compose long text as readable sections up to 65ch. Keep legal/supporting text in the same page composition and preserve legal wording. Contact rows retain their current destinations. Comments remain a compact guest/self feed with existing actions.
- Collapse content columns below 768 px. Prevent overflow at 320 px. Preserve image proportions, translated wrapping, safe areas and mobile scrolling.
- Motion uses short action feedback, a restrained first-screen sequence and one-time media reveals. Honor reduced motion. The optional 3D hero retains its poster, press activation on mobile and failure retry. Navigation and downloads never depend on it.
- Wallpaper arrows, viewer keyboard controls and horizontal swipes traverse the complete catalog by its existing order and wrap at both ends. Preserve locale and variant. Native links and PNG forms remain usable without JavaScript.
- Cookie buttons follow settings, necessary only, allow all in DOM and visual order. Footer uses the exact label Telegram Channel in every locale.
- /ui-kit/ is development-only. Keep it out of production output. Reuse its primitives and compositions across public pages and administration.
- Before delivery, run root checks and browser tests. Compare current screenshots with supplied references and docs/design/feedback.png. Report local, CI, browser and physical-device evidence separately. Leave PR #63 unmerged and issue #59 open for visual review.
