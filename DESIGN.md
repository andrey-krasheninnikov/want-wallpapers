# Want Wallpapers visual system

## Direction

Want Wallpapers is a gallery on neutral graphite planes with a saturated violet accent and one softly blurred violet gradient sphere. Artwork carries the visual weight; compact headings and distinct fills organize navigation, reading and actions. The supplied pixel portfolio reference guides the violet identity. Dark surfaces and soft white text temper its contrast. Want Keep supplies the filled surface language. Want Brief informs depth. Flutter Grades informs the controlled type scale. The existing logo, catalog imagery, public routes and six locales remain authoritative.

The device stage stays beside the home introduction. Home collections form a paginated horizontal carousel. Wallpaper results retain a regular comparison grid. Long supporting content becomes readable sections for stories, works, file formats, licensing and topics. Legal pages place their explanatory continuation inside the same reading surface.

The five gallery references remain useful: Unsplash for image priority, Pexels for legible browsing, Cosmos for collection grouping, Are.na for quiet metadata and Backdrops for device context. They supplement the supplied Walletify images and the three project references.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| background | #141414 | Page ground |
| foreground | #E8E8E8 | Main text |
| card, muted | #1C1C1C | Grouped content |
| secondary, popover | #252525 | Nested controls and raised surfaces |
| accent | #303030 | Interactive surface |
| media-ground | #101010 | Wallpaper viewer |
| muted-foreground | #ADADAD | Supporting text |
| primary | #5B4FFF | Primary action and selected mark |
| primary-foreground | #FFFFFF | Action labels, including hover |
| primary-hover / primary-active | #6357FF / #5549EB | Action feedback |
| link | #E8E8E8 | Underlined text links |
| ring | #5B4FFF | Logo-color focus outline with dark backing |
| destructive | #FF738D | Error text and destructive actions |
| border, input | #383838 / #858585 | Compatibility aliases and filled switch/radio indicators |

The single source is frontend/src/styles/global.css. Border aliases do not prescribe outlines. Use solid fills, whitespace and type to group content. Do not add permanent decorative borders, divider rules, inset hairlines or button gradients. Gallery hover uses a thin logo-color glow without moving the card. Reading surfaces stay opaque. Controls, cards and the device stage have no broad colored halos. The gradient sphere stays behind the page. The device stage and model renderer are transparent, so the public page background continues around the devices and behind the caption. Scene buttons retain filled surfaces. The physical bezel and shadows in the device poster depict the objects and remain visible.

## Type and geometry

Onest Variable carries headings; Manrope Variable carries body text and controls. Fonts are served locally. Small indices and metadata use system monospace. Chinese text retains PingFang SC and Microsoft YaHei fallbacks. Japanese uses locally served Noto Sans JP with strict Japanese line breaking. Arabic uses locally served Noto Sans Arabic, normal letter spacing and right-to-left document direction.

- Hero: clamp(2rem, 3.5vw, 3.125rem), 32–50 px, weight 600, leading 1.15.
- Page heading: clamp(1.75rem, 3.2vw, 2.5rem), 28–40 px, weight 650, leading 1.12.
- Section heading: clamp(1.375rem, 2.4vw, 1.875rem), 22–30 px, weight 650, leading 1.2.
- Subheading: 18–20 px. Body and inputs: at least 16 px. Secondary labels: at least 14 px.
- Reading width: at most 65ch; body leading 1.6–1.8. Headings balance their wrapping.
- Fields: 12 px radius. Media and panels: 24 px. Prominent surfaces: 32 px. CTA and badge shapes: capsules.
- Keep the 4 px spacing scale and 16/24/32 px working gaps. Public shell: 1280 px maximum; administration: 1440 px.

## Components and composition

Use the existing Radix-based shadcn sources and semantic Tailwind v4 tokens. The outline variant remains import-compatible and uses a filled secondary surface. Separator exports remain compatible but display no rule. Do not create a second component library.

Keyboard focus retains control fills and uses a 2 px logo-color outline, offset by 3 px, with a dark backing. Inputs and textareas remain dark, including invalid states. Forced colors use the system focus outline. Labels, selection marks and error messages retain meaning without color.

Feedback opens in one lazy modal on the current page. The form keeps topic, optional email, message and action/result areas. The submit button fills the form content width at every viewport size in both the dialog and standalone page. Preserve the surrounding padding and place privacy and CAPTCHA notices below the button with their own spacing. Closing preserves the draft and pending request in memory; failed requests preserve input. The dialog traps focus and returns it to the opening control or mobile menu button. Existing localized /feedback/ routes remain direct-link and no-script fallbacks. Field IDs remain unique across instances.

Owner contact has an initial avatar, identity and five linked action rows. Each row includes a useful icon, destination and outgoing arrow. Keep the existing contact URLs. The public email uses a native mailto link without a new tab. Its complete address wraps on narrow screens, remains selectable and keeps left-to-right direction inside other text directions.

Comments use a compact feed: avatar, guest/self label, date, text and action. On wallpaper pages the composer uses its full column width, with a small avatar in the label row. A single social controller supplies comments and ratings; request failures preserve drafts and show beside the relevant action. The composer sits above the feed. Only existing publication, deletion and reporting actions are available. Sample comments in the development kit are explicitly demonstrations.

Cookie actions appear in both DOM and visual order: settings, necessary only, allow all. The footer channel label is exactly Telegram Channel in every locale. Preserve independent privacy choices and dialog focus behavior.

## Wallpaper composition and navigation

Wallpaper pages use two columns from 1024 px: a 60% preview column and a 40% control column with a 32 px gap. The control column contains format selection, download, compact ratings, description, license and tags. The viewer frame has the same dimensions for landscape and portrait images; both use object-fit: contain. A blurred copy of the artwork fills unused frame space behind the intact image, replacing plain dark bars. Its height is clamp(420px, 60svh, 640px). Previous/next links and the count stay in a fixed row beneath the frame. Below 1024 px the viewer, navigation and controls stack; the frame height is clamp(320px, 58svh, 520px). Controls never overlap the image.

Comments follow the viewer and controls, ahead of collection context and long reading. The public API returns the latest ten visible comments. Their cards form a finite horizontal scroll-snap carousel with one/two/three cards across phone/tablet/desktop, pagination and ordinary comment actions. Long comments expand within their card. The composer remains above the cards.

Long stories, legal sections and support text use up to three balanced columns with an 18rem minimum and 32 px gaps. The available width and text size determine two or one column. Headings remain outside paragraph flow; comments and form fields keep ordinary reading order. Home and collection-list stories use the same finite horizontal carousel with static covers, localized titles and three-line excerpts. Selecting a card opens its complete localized story in a named dialog, with a collection link, focus trapping, Escape/close and focus restoration. Dialog reading stays in one column up to 65ch; its opaque surface scrolls on narrow screens. Native card links target the collection story without JavaScript. Initial cards remain in HTML; full stories and the shared scene/mosaic catalogue load from one versioned static JSON per locale. Failed data loads retain initial previews and native links. Keep the full story on collection and wallpaper pages.

Language choices show decorative flags beside their existing labels: en 🇬🇧, ru 🇷🇺, zh-cn 🇨🇳 pt-br 🇧🇷 and ja 🇯🇵. Flags appear in the selected control, its options and native fallback links; locale identifiers do not change.

The viewer provides previous/next links across the complete catalog in newest-first search order. It wraps at both ends and hides links for a single item. Horizontal swipes and ArrowLeft/ArrowRight on the page outside editing, selection, widgets and open dialogs use the same destinations. Vertical gestures remain page scrolling; tab and text-field keys remain local to their controls.

Wallpaper pages use Astro ClientRouter with a swap fallback. Once HilltopAds advertising starts, navigation reloads the document while preserving the selected variant and viewer fragment, to avoid duplicate automatic placements. Slider actions update the route without reloading the document, retain the selected variant and preserve the viewer's position relative to the viewport. Metadata, collection context, related works and social data belong to the new route. Back/Forward uses browser history. Header, cookie state and the closed feedback draft persist. Page-specific controls dispose listeners before a swap and initialize after navigation. Language selection and feedback fallback links retain native behavior.

Native previous/next links remain available without JavaScript and include the viewer fragment. Invalid variants default to desktop. Both previews exist before hydration. Downloads use same-origin anchors with download and the original PNG filename; the server supplies Content-Disposition: attachment. Downloads do not navigate the page or depend on the device scene. There is no original-preview section.

## Motion and responsive behavior

Control feedback takes at most 120 ms. Text, gallery media, menus, dialogs, accordions, cookie panels and form results appear immediately. Hover and active states change fill or color without shifting controls or icons. Loading placeholders are static. Native scrolling remains direct.

Wallpaper image transitions use a brief 180 ms opacity change. The frame and controls do not move. Reduced motion removes the transition. Native scrolling remains direct; no entrance or scroll-reveal animations are used.

Public pages and /ui-kit/ place one softly blurred gradient sphere behind the content on the solid #141414 graphite ground. A fixed, clipped container keeps it outside layout and pointer input. The sphere is centered at 78% 22%, with a diameter of clamp(24rem, 72vmax, 70rem), a 48 px blur and constant .18 opacity. Its radial gradient uses primary-hover and primary. A 36-second cycle moves it up to 4vw left and 3vh down, then returns it; only transform animates. CSS draws the sphere without Canvas or external resources. Administration uses the shared palette without decoration.

A localized footer button pauses or resumes the sphere. Only an explicit choice writes running or paused to localStorage under want-background-motion. An unknown stored value defaults to running; unavailable storage keeps the choice in the current page. The setting stays in the browser and is described on the cookie page. Hidden tabs pause the sphere. Reduced motion displays a static background and hides the control; forced colors hide decoration. Without JavaScript the background is static and the control stays hidden.

Content columns collapse below 768 px. Prevent page overflow at 320 px and preserve image proportions, translated wrapping, 44 px targets and safe areas. Legal sections align headings and reading columns on desktop and become a single sequence on mobile. Sticky surfaces must not cover focus.

Video covers require explicit playback. The local 3D scene loads automatically and rotates at 5 degrees per second after its interaction delay. Pause/resume, manual rotation, reset, failure retry and poster fallback remain. Completed manual gestures, keyboard camera rotation and rotation buttons select another wallpaper without an immediate repeat. Desktop and Mobile textures switch together after both load; the caption, destination and poster match. Automatic rotation and Reset keep the selected wallpaper. Failed texture loads retain the current pair. Offscreen, hidden tabs and reduced motion stop rotation; the loaded scene stays visible and static. Keep local GLB/WebP assets, touch scrolling and the existing CSP without external decoders or WebAssembly permissions.

Liquid glass is the functional layer: navigation, control panels, dialogs and card captions share --glass-opacity (68%), --glass-blur (20px), --glass-saturation (120%), --glass-highlight (#ffffff08) and --glass-shadow. Reading remains opaque. Unsupported backdrop-filter, reduced transparency and forced colors use opaque surfaces. Gallery hover and keyboard selection reveal a 2 px logo-color wave around the card and a restrained outer glow. The wave completes a circuit in 2.6 seconds and becomes static for reduced motion. Cards do not tilt, translate or scale. Keyboard focus keeps its separate high-contrast outline. The wand effect follows active links and buttons, including nested labels and SVG icons. Ordinary text, editable fields, media and disabled or inert controls do not emit sparks. It preserves the native cursor, selection, clicks and keyboard focus. Each spark is 12 px, has no halo or scaling, reaches at most .45 opacity and fades over 450 ms. Sparks appear at least 160 ms apart, with at most three present. Page navigation cancels animations and removes particles and event listeners before initialization on the next page. One 800 ms pixel confetti burst accompanies a native download. Reduced motion and unsuitable pointers disable decorative interaction effects.

Home collections use a viewport-wide native horizontal scroll-snap track. Its first and last cards align with the page shell; intermediate cards scroll through the side gutters to the viewport edges. The heading and pagination stay aligned with the shell. Preserve one/two/three cards across phone/tablet/wide layouts, 24 px gaps, internal card padding, previous/next controls and page count. Descriptions show at most two lines with truncation while retaining the full text in the document. The track focus outline sits inside its bounds; focused card links also outline their card, with enough track padding to keep the outline visible. Scrolling is finite, without autoplay or cloned cards. Home highlights are an image-only mosaic of up to six distinct works, with 16 px gaps and 24 to 40 px corners. Remove its visible heading, browse link and captions while preserving localized link names and image descriptions. Three filled compositions vary tile proportions on phone, tablet and wide layouts without changing the six-tile frame height at a breakpoint. Portrait accents use mobile previews and link to the mobile variant. Small catalogs use a compact filled grid; a single work stays static and an empty catalog omits the section. Without JavaScript the initial composition remains useful.

Every 15 active seconds, select different works and a different composition. Prefer works outside the current selection; avoid duplicate IDs and immediate ordering repeats. Preload and decode the next previews before a 180 ms crossfade. Outgoing images are decorative and non-interactive. Failed previews use the other supported variant or another work; retain the last working frame if no replacement loads. Pause on hover, keyboard focus, offscreen visibility and hidden tabs. A filled 44 px icon button pauses or resumes the mosaic independently of the background; its choice stays in memory. After any pause, wait a fresh 15 seconds. Reduced motion keeps a static frame and hides the button. Dispose timers, loading callbacks and observers during navigation. Search retains a regular grid.

## Development kit and visual materials

/ui-kit/ is available only through the development server. It shows primitive states plus real gallery, contact and comment-feed compositions. It stays absent from production output and the sitemap.

[Feedback study](docs/design/feedback.png) records the revised writing-surface composition. [Philosophy](docs/design/philosophy.md) describes the electric gallery direction. The earlier direction.png remains a shape reference. Exact tokens, existing localized copy and live catalog data take precedence over text or color approximations in a visual study.

## Verification

Use one static pass and one cached-media source build for these revisions. Run focused browser scenarios at 320 and 1440 px for stable frames, client navigation/history, feedback draft retention, native downloads, comment cards, bubble composition and manual texture changes. Check the ten-comment limit with one backend scenario and immediate random-repeat prevention with a small unit test. Do not repeat full suites, backup checks or CDN synchronization for this change. Report local, CI, browser and physical-device evidence separately.

## Advertising

Public pages except localized homes, administration, errors and the development kit may load HilltopAds under the independent advertising preference. One labelled 300×250 banner sits after main content and before the footer, with 10 px side gutters at a 320 px viewport. Below 300 px of available space the tag does not start. Keep native dimensions without scaling or overlap. The owner-approved MultiTag also provides standard popup windows; their frequency belongs to the provider. Failed or empty placements remain hidden. Advertising never controls downloads. Once advertising requests start, navigation and consent withdrawal load a fresh document; wallpaper links retain locale, variant and the viewer fragment.

### Arabic direction

Arabic uses `ar` and Modern Standard Arabic. Public documents set `lang="ar" dir="rtl"`; existing locales remain LTR. Use logical alignment and spacing for controls, and isolate email, URLs and technical values as LTR. The Arabic language mark is the neutral letter ع. Mirror directional navigation icons, never artwork or the physical 3D scene. Next moves left in RTL: ArrowLeft and a rightward swipe open the next wallpaper. Carousel scrolling remains finite. Administration stays Russian; Arabic translation fields have their own language, direction and font.
