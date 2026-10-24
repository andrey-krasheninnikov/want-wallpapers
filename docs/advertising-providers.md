# HilltopAds

HilltopAds is the only advertising provider. The owner supplied the public MultiTag and approved its 300×250 desktop/mobile banner and standard popup behavior in [#136](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/136). [ADR 0014](adr/0014-hilltopads.md) records the document boundary and trade-offs.

## Placement and consent

Each public page includes advertising within its existing composition. Listing, search, collection, wallpaper and legal introductions pair their text with a labelled card. Feedback places a card below direct contact. Wallpaper pages add a card beside comments; homes place cards under the benefits and FAQ headings. Every public footer contains its own card in the brand/navigation grid. Introductory and comment pairs stack below 1024 px; footer advertising stacks below 1280 px. Tablet feedback uses one column while its advertising is visible.

Cards use shared neutral fills and 24 px corners in both themes. Each placement uses a different owner-supplied zone code and retains a native 300 px creative width, with 10 px side gutters at a 320 px viewport. Horizontal card padding contracts on narrow screens without scaling or cropping the creative. Below that viewport width no tags start and loaded placements are hidden. Failed or refused placements collapse without leaving an empty row or column. No side towers, video or download interstitial are enabled. Popup behavior and frequency belong to the provider configuration; the site does not add popup timers or use advertising as a download requirement.

The same provider serves all six locales and countries where the account permits delivery. Country lookup determines consent defaults only. EEA and unknown-country visitors wait for an explicit choice; saved refusals take precedence. Advertising and analytics preferences remain independent. No advertising requests start on administration, error pages, unknown routes or ui-kit. Localized homes use the same consent rules as other public pages.

After the tag starts, navigation loads a new document. Wallpaper links preserve locale, desktop/mobile selection and the viewer fragment. Withdrawal in this or another tab reloads the document with advertising disabled. A document restored from the back-forward cache also reloads before resuming. Already opened advertising windows must be closed separately.

## Public configuration

The exact HTTPS tag URLs for top, content and footer placements are defined in `frontend/src/lib/advertising-providers.ts`. The original footer zone is the approved 300×250 MultiTag. Two additional embed codes use the same 300 px placement width; their live dimensions and delivery remain subject to provider verification. Each script receives empty settings, async loading and the supplied no-referrer-when-downgrade policy for that request only. The global Referrer-Policy header remains strict-origin-when-cross-origin. No global referrer meta tag is added.

Each zone starts independently at most once per document, without retries. Loader failure or no iframe within ten seconds hides only the affected placement. An existing iframe can remain empty if delivery is blocked or unfilled; the site does not treat iframe creation as proof of fill. Browsing, search, social actions and original PNG downloads remain independent. The legacy document.write interception and global placement options are removed.

The public file `/2405ea2a7a861b5bc39f.txt` contains the supplied verification response. The matching DNS TXT record was confirmed publicly before implementation. File publication and DNS presence do not prove account moderation or live ad delivery.

## Content Security Policy

Only known successful advertising HTML documents and their 304 responses receive these additions:

| Directive | Confirmed origins |
| --- | --- |
| script-src | https://massivesalad.com, https://phoroglopsu.com |
| frame-src | https://massivesalad.com |

The supplied script uses massivesalad.com for its loader and banner iframe. Its error reporter uses phoroglopsu.com. The integration adds no advertising eval, inline-script or wildcard exceptions. Existing analytics, CAPTCHA and gallery sources remain independently scoped. Additional sources require inspection of the actual provider response; a blocked unknown host is not sufficient reason to allow an entire scheme or wildcard.

The owner confirmed site approval and no additional ads.txt or CMP/TCF requirements. No ads.txt entries are added. The site's independent preference controls are not represented as a certified CMP. Recheck public account instructions if the provider changes these requirements.

## Verification

All Playwright suites import the shared browser fixture, which substitutes the provider tag in every page, including new tabs. Advertising integration tests additionally block external traffic and substitute the banner and popup pages. They cover consent, six locales, responsive layout, withdrawal, pending loads, timeout, navigation, CSP and native downloads. They produce no live advertising impressions or clicks.

Before closing #136, record the deployed version, date and public URL. Using the provider-approved verification procedure, confirm actual banner content, expected popup behavior, withdrawal and both PNG variants. Do not click advertisements or manufacture traffic. Script loading and an empty iframe do not prove delivery or revenue.

[HilltopAds MultiTag documentation](https://hilltopads.com/publishers-help/en/articles/9065075-what-is-a-multitag-banner) describes the combined banner/popup format and manager-controlled settings. [#28](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/28) remains separate video work.
