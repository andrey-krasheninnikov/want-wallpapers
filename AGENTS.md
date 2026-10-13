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

Read [DESIGN.md](DESIGN.md) before changing a visual surface. The site uses a dark device gallery: large rounded panels, quiet contours, image-led collections and clear controls. Preserve the existing logo, catalog imagery, public routes and four locales.

- Keep the palette exact: background #090911, foreground #F6F6FA, card #151520, secondary #20202D, muted text #AEB0C2, primary #5B4FFF, accent #242337, destructive #FF929B, border #333342, input #444454, focus and links #938CFF.
- Use locally served Onest Variable for headings and Manrope Variable for body and controls. Keep Chinese fallbacks. Body and input text are at least 16 px; secondary labels are at least 14 px.
- Use the shared Tailwind v4 tokens and installed Radix-based shadcn components. Fields have 16 px corners, images 24 px, panels 32 px and buttons capsule corners. Keep accessible labels, focus rings and 44 px targets.
- Collapse content columns below 768 px. Prevent horizontal overflow at 320 px. Preserve image proportions, translated heading wrapping, safe areas and mobile scrolling.
- Keep interaction motion short and respect reduced motion. The local 3D hero is optional: a poster remains usable, mobile activation requires a press, and navigation and downloads never depend on it.
- The UI kit is available at /ui-kit/ only through the development server. Keep it out of production output. Reuse its primitives in public pages and administration; do not introduce a parallel component system.
- Before delivery, run the root checks and browser tests. Compare the rendered result with the supplied references and docs/design/direction.png. Report local, CI, browser and physical-device evidence separately.
