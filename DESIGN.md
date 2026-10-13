# Want Wallpapers visual system

## Atmosphere and references

The site is a dark gallery of wallpapers shown on screens. Large rounded surfaces, clear typography and restrained contours connect the public catalog and administration. The supplied Walletify references guide shape, depth and control hierarchy. Their finance content and blue/green accents are not part of this identity.

The structural concept is a device stage: a left-aligned heading and one primary collection action beside a monitor and phone. Collections follow with a prominent first collection and smaller peers. Wallpaper results use a regular image grid because visitors compare items. Supporting copy, FAQ and legal content retain their existing roles.

Reference pull: Unsplash informs image priority and clear search; Pexels informs legible image browsing; Cosmos informs collection grouping; Are.na informs quiet content metadata; Backdrops informs previews in the context of a device. The four supplied references take precedence over these patterns. Use the existing catalog artwork and licensed local fonts.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| background | #090911 | Page ground |
| foreground | #F6F6FA | Main text |
| card, popover, muted | #151520 | Grouped surfaces |
| secondary | #20202D | Controls and nested surfaces |
| muted-foreground | #AEB0C2 | Supporting text |
| primary | #5B4FFF | Primary actions |
| accent | #242337 | Hover and selected surfaces |
| destructive | #FF929B | Errors and destructive actions |
| border | #333342 | Structural contours |
| input | #444454 | Input boundaries |
| ring, link | #938CFF | Focus and links |

Keep these values in frontend/src/styles/global.css. Wallpaper imagery may use its own colours. Do not introduce another interface accent or change these values to match a reference.

## Typography and spacing

Onest Variable is the heading family; Manrope Variable is the body and interface family. Both are served locally. Chinese text uses the existing PingFang SC and Microsoft YaHei fallback. Headings use tight tracking; body text uses relaxed leading and a maximum line length around 65 characters.

- Hero: clamp(2.5rem, 5vw, 5rem), weight 600, leading 1.02, tracking -0.055em.
- Page heading: clamp(2rem, 4vw, 3.5rem), weight 650, leading 1.12.
- Section heading: clamp(1.75rem, 3vw, 2.75rem), weight 650, leading 1.2.
- Body: 1rem; secondary labels: 0.875rem. All inputs use at least 1rem.
- Use the existing 4 px spacing scale. Common gaps are 16, 24 and 32 px. The page shell stays at a maximum 1280 px; administration uses 1440 px.

## Components

Use the installed Radix-based shadcn components and their existing imports. Keep their interfaces and keyboard behavior. Buttons are capsules; fields use a 16 px radius, images 24 px, panels 32 px. Main buttons use a flat violet fill, secondary actions use a charcoal surface or contour. Active feedback translates a button downward by 1 px.

Labels sit above inputs. Validation uses Field and FieldError, with aria-invalid and a linked explanation. Disabled and loading states retain labels and dimensions. Show errors inline and give empty states a useful next action. Use layout-matched Skeleton components while data loads. Cards group actual content or a task; do not nest decorative cards.

The development-only /ui-kit/ page demonstrates the 19 installed primitive families, tokens, variants and example compositions. Run `bun run dev`, then open http://127.0.0.1:4321/ui-kit/. Imports remain under @/components/ui; no separate package or Storybook is required. The route must never appear in production output or the sitemap.

## Responsive composition

Multi-column content collapses below 768 px. The hero becomes text followed by the device stage. At 1024 px it places text and devices beside each other. Keep images inside their frames and text outside the device viewport. The collection lead spans the grid on larger screens. Legal prose stays narrow; navigation keeps the existing mobile Sheet and locale selector.

Reserve at least 44 px for interactive targets. Do not allow page-level horizontal overflow at 320 px. Long translated headings must wrap without clipping. Sticky surfaces must not cover keyboard focus. Respect safe-area insets in the cookie panel and use dynamic viewport units.

## Device scene and motion

The original local devices.glb contains a chamfered monitor, a phone, their glass surrounds and controls. The screens reference same-origin desktop and mobile previews of contours-of-silence-11. Rebuild it with `bun frontend/scripts/device-scene.ts` after syncing previews. Geometry assertions validate dimensions, vertex indices and the 1.5 MB asset ceiling.

The @google/model-viewer runtime is dynamically imported only by the hero. Desktop activation waits for visibility; mobile and reduced-motion activation require a button press. A code-native poster remains usable without JavaScript and during loading or failure. Devices support bounded rotation, touch and localized keyboard buttons. Pan, zoom, automatic rotation, external scenes and remote decoders are unused. The build excludes the optional Meshopt WebAssembly decoder because local geometry is uncompressed. Textures use existing local preview paths, so the scene works under the existing CSP.

Motion uses short state transitions. Avoid scroll interception, custom cursors, looping decorative effects and repeated entrance animations. Reduced motion removes nonessential transitions. Keep all navigation, forms and downloads independent of scene readiness.

## Review and verification

Compare framing, typography, surface contrast, control shape and image priority with docs/design/direction.png and the supplied references. The concept is a direction board; real catalog images, existing localized copy and the counts derived from catalog data are authoritative in the application.

Run `make check`, `make test`, `make test-ui` and `bun run --cwd frontend test:ui-kit`. Browser coverage includes all four locales, widths 320, 375, 768, 1024 and 1440 px, keyboard behavior, native PNG downloads, search history, privacy choices and administration. Test 3D activation, rotation and failed asset loading separately. Build validation rejects the UI-kit route in production.
