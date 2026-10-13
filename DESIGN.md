# Want Wallpapers visual system

## Direction

Want Wallpapers is a gallery on deep navy planes with electric violet accents and a pixel grid. Artwork carries the visual weight; compact headings and distinct fills organize navigation, reading and actions. The supplied pixel portfolio reference supplies the saturated blue-violet atmosphere. Want Keep supplies the filled surface language. Want Brief informs depth and responsive motion. Flutter Grades informs the controlled type scale. The existing logo, catalog imagery, public routes and four locales remain authoritative.

The device stage stays beside the home introduction. A prominent collection leads the collection grid. Wallpaper results retain a regular comparison grid. Long supporting content becomes readable sections for stories, works, file formats, licensing and topics. Legal pages place their explanatory continuation inside the same reading surface.

The five gallery references remain useful: Unsplash for image priority, Pexels for legible browsing, Cosmos for collection grouping, Are.na for quiet metadata and Backdrops for device context. They supplement the supplied Walletify images and the three project references.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| background | #070918 | Page ground |
| foreground | #F5F6FF | Main text and keyboard focus fill |
| card, muted | #11152F | Grouped content |
| secondary, popover | #191F43 | Nested controls and raised surfaces |
| accent | #232B59 | Interactive surface |
| media-ground | #040611 | Wallpaper and device stage |
| muted-foreground | #B8C0E8 | Supporting text |
| primary | #6050FF | Primary action and selected mark |
| primary-foreground | #FFFFFF | Action labels, including hover |
| primary-hover / primary-active | #6658FF / #4836E5 | Action feedback |
| link, ring | #A5AFFF | Readable accent text |
| destructive | #FF8EB5 | Error text and destructive actions |
| pixel-grid | #252E63 | Decorative grid |
| border, input | #313E73 / #8493D5 | Compatibility aliases and filled switch/radio indicators |

The single source is frontend/src/styles/global.css. Border aliases do not prescribe outlines. Use solid fills, whitespace and type to group content. Do not add decorative borders, divider rules, inset hairlines or button gradients. Soft violet glow belongs to primary actions, the device stage and interactive states; reading surfaces stay opaque and body text has no glow. The physical bezel in the device poster depicts the object and remains part of the image.

## Type and geometry

Onest Variable carries headings; Manrope Variable carries body text and controls. Fonts are served locally. Small indices and metadata use system monospace. Chinese text retains PingFang SC and Microsoft YaHei fallbacks.

- Hero: clamp(2rem, 3.5vw, 3.125rem), 32–50 px, weight 600, leading 1.15.
- Page heading: clamp(1.75rem, 3.2vw, 2.5rem), 28–40 px, weight 650, leading 1.12.
- Section heading: clamp(1.375rem, 2.4vw, 1.875rem), 22–30 px, weight 650, leading 1.2.
- Subheading: 18–20 px. Body and inputs: at least 16 px. Secondary labels: at least 14 px.
- Reading width: at most 65ch; body leading 1.6–1.8. Headings balance their wrapping.
- Fields: 12 px radius. Media and panels: 24 px. Prominent surfaces: 32 px. CTA and badge shapes: capsules.
- Keep the 4 px spacing scale and 16/24/32 px working gaps. Public shell: 1280 px maximum; administration: 1440 px.

## Components and composition

Use the existing Radix-based shadcn sources and semantic Tailwind v4 tokens. The outline variant remains import-compatible and uses a filled secondary surface. Separator exports remain compatible but display no rule. Do not create a second component library.

Keyboard focus inverts the control fill and label to #F5F6FF and #070918. Descendant labels and icons retain readable contrast. Forced colors use the system focus outline. Selected states also have a selection mark or label. Errors have linked text and a filled state, not color alone. Disabled and loading controls retain their dimensions.

Feedback is one writing surface: compact title, topic, optional email, message and a composed action/result area. Validation stays associated with the relevant field. Failed requests preserve input. The direct email action sits beside the form on wide screens; supporting topics continue beneath both columns in the same page composition.

Owner contact has an initial avatar, identity and three linked action rows. Each row includes a useful icon, destination and outgoing arrow. Keep the existing contact URLs.

Comments use a compact feed: avatar, guest/self label, date, text and action. The composer sits above the feed. Only existing publication, deletion and reporting actions are available. Sample comments in the development kit are explicitly demonstrations.

Cookie actions appear in both DOM and visual order: settings, necessary only, allow all. The footer channel label is exactly Telegram Channel in every locale. Preserve independent privacy choices and dialog focus behavior.

## Wallpaper navigation

The viewer provides previous/next links across the complete catalog in its existing search order. It wraps at both ends and hides links for a single item. Horizontal swipes and ArrowLeft/ArrowRight while the viewer has focus use the same destinations. Vertical gestures remain page scrolling; tab and text-field keys remain local to their controls.

Links open the neighboring wallpaper route with variant=desktop or variant=mobile and the viewer fragment. Invalid variants default to desktop. Both previews exist in the document; an early page script selects the image before hydration. Canonical URLs, metadata, description, download action and comments belong to the neighboring page. Browser history retains normal navigation behavior.

There is no original-preview section. Native PNG download forms and the no-script mobile download remain. Reading and downloads do not depend on the optional device scene.

## Motion and responsive behavior

Control feedback takes 160 ms. State changes take about 260 ms. The first-screen sequence settles within 450 ms. Gallery media uses a one-time 420 ms cover reveal, enabled only when the observer is available. Dynamic results without an observer remain visible. Motion responds to actions and never intercepts scrolling.

Same-origin wallpaper navigation uses native cross-document View Transitions when supported, with a 280 ms directional image transition. The opt-in rule is in the document head. Wallpaper pages wait for the viewer element before the first transition snapshot. Ordinary links remain the fallback. Reduced motion displays final states immediately and disables view transitions. Keep animation properties explicit and avoid custom cursors. The background glow is the only decorative loop.

Public pages and /ui-kit/ have a fixed decorative background behind the content. The grid uses a 40 px step, or 32 px below 768 px, with sparse filled squares and a fade towards the center. Two CSS layers provide the grid and radial light; no Canvas or external resources are needed. The light changes opacity from .12 to .24 over a 12-second cycle. Grid geometry stays still. Administration uses the shared palette without the background layers.

A localized footer button pauses or resumes the glow. Only an explicit choice writes running or paused to localStorage under want-background-motion. An unknown stored value defaults to running; unavailable storage keeps the choice in the current page. The setting stays in the browser and is described on the cookie page. Hidden tabs pause the glow. Reduced motion displays a static background and hides the control; forced colors hide decoration. Without JavaScript the background is static and the control stays hidden.

Content columns collapse below 768 px. Prevent page overflow at 320 px and preserve image proportions, translated wrapping, 44 px targets and safe areas. Legal sections align headings and reading columns on desktop and become a single sequence on mobile. Sticky surfaces must not cover focus.

The local devices.glb and its WebP textures remain self-origin. Activation, failure retry, bounded rotation, poster fallback and touch scrolling retain their existing behavior. The scene uses no external decoder or WebAssembly permission.

## Development kit and visual materials

/ui-kit/ is available only through the development server. It shows primitive states plus real gallery, contact and comment-feed compositions. It stays absent from production output and the sitemap.

[Feedback study](docs/design/feedback.png) records the revised writing-surface composition. [Philosophy](docs/design/philosophy.md) describes the electric gallery direction. The earlier direction.png remains a shape reference. Exact tokens, existing localized copy and live catalog data take precedence over text or color approximations in a visual study.

## Verification

Run make check, make test, make test-ui and bun run --cwd frontend test:ui-kit. Compare fresh desktop and mobile screenshots at maximum background glow with the supplied references and feedback study. Cover four locales at 320/375/768/1024/1440 px, keyboard focus, zoom, reduced motion, feedback retry, comment actions, privacy choices, native downloads, catalog wrapping, variants, history and touch scrolling. Report local, CI, browser and physical-device evidence separately.
