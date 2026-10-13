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

Read [DESIGN.md](DESIGN.md) before changing a visual surface. The site is a gallery on cool dark planes with saturated violet accents and a faint pixel grid. The supplied pixel portfolio reference guides color and atmosphere. Want Keep guides filled surfaces, Want Brief guides depth and transitions, and Flutter Grades guides compact type. Preserve the existing logo, catalog imagery, public routes and four locales.

- Use exact tokens: background #0D1019, text #F2F4FA, card #161B28, secondary #202738, accent #2D354A, media ground #090C14, muted text #AFB7C7, primary #6642F5, primary hover #7355F8, primary active #5634DC, readable accent #B09AFA, input #7C88A0 and error #FF738D.
- Group content with fills, spacing and type. Do not add decorative borders, divider lines or inset hairlines. Outline variants use fills. Keyboard focus uses inverted fill/text; forced colors keep system focus.
- Use locally served Onest Variable for headings and Manrope Variable for body and controls. Use system monospace for small indices and metadata. Keep Chinese fallbacks. Hero is 32–50 px, page title 28–40 px, section title 22–30 px. Body and inputs are at least 16 px; secondary labels at least 14 px.
- Reuse Tailwind v4 tokens and installed Radix-based shadcn sources. Fields have 12 px corners, media and panels 24 px, prominent surfaces 32 px and CTA buttons capsule corners. Keep accessible labels and 44 px targets.
- Compose long text as readable sections up to 65ch. Keep legal/supporting text in the same page composition and preserve legal wording. Contact rows retain their current destinations. Comments remain a compact guest/self feed with existing actions.
- Collapse content columns below 768 px. Prevent overflow at 320 px. Preserve image proportions, translated wrapping, safe areas and mobile scrolling.
- Public pages and /ui-kit/ use a fixed pixel grid with grid opacity .12 and a 24-second edge glow at opacity .02–.04. Provide a localized pause/resume control, save only an explicit choice under want-background-motion, and pause in hidden tabs. Reduced motion keeps a static background; forced colors remove decoration. Administration inherits the palette without the animated background.
- Use opaque reading surfaces and clear filled states. Avoid large colored halos on controls, cards and the device stage. Main text is soft white; supporting text is neutral.
- Motion is limited to 120 ms control feedback, a 180 ms wallpaper transition and the faint background glow. Text, media frames and panels appear immediately. Honor reduced motion. Video covers and the optional 3D hero activate only on a press at every screen size. Videos return to their poster when offscreen or the tab is hidden and require another press. Keep 3D retry and manual rotation. Navigation and downloads never depend on rich media.
- Wallpaper arrows, viewer keyboard controls and horizontal swipes traverse the complete catalog by its existing order and wrap at both ends. Preserve locale and variant. Native links and PNG forms remain usable without JavaScript.
- Cookie buttons follow settings, necessary only, allow all in DOM and visual order. Footer uses the exact label Telegram Channel in every locale.
- /ui-kit/ is development-only. Keep it out of production output. Reuse its primitives and compositions across public pages and administration.
- Before delivery, run root checks and browser tests. Compare current screenshots with supplied references and docs/design/feedback.png. Report local, CI, browser and physical-device evidence separately. Leave PR #63 unmerged and issue #59 open for visual review.
