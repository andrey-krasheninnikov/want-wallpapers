# HilltopAds

HilltopAds is the only advertising provider. The owner supplied the public MultiTag and approved its 300×250 desktop/mobile banner and standard popup behavior in [#136](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/136). [ADR 0014](adr/0014-hilltopads.md) records the document boundary and trade-offs.

## Placement and consent

One labelled banner appears after the main content before the footer. It retains its original dimensions and has 10 px side gutters at a 320 px viewport. The tag does not start when the available width is below 300 px. No side towers or video download interstitial are enabled. The prepared video integration remains disabled pending provider confirmation. Popup frequency belongs to the provider configuration; the site does not add popup timers or use advertising as a download requirement.

The same provider serves all six locales and countries where the account permits delivery. Country lookup determines consent defaults only. EEA and unknown-country visitors wait for an explicit choice; saved refusals take precedence. Advertising and analytics preferences remain independent. No advertising requests start on localized homes, administration, error pages, unknown routes or ui-kit.

After the tag starts, navigation loads a new document. Wallpaper links preserve locale, desktop/mobile selection and the viewer fragment. Withdrawal in this or another tab reloads the document with advertising disabled. A document restored from the back-forward cache also reloads before resuming. Already opened advertising windows must be closed separately.

## Public configuration

The exact HTTPS tag URL and 300×250 size are defined in `frontend/src/lib/advertising-providers.ts`. The script receives empty settings, async loading and the supplied no-referrer-when-downgrade policy for that request only. The global Referrer-Policy header remains strict-origin-when-cross-origin. No global referrer meta tag is added.

The tag starts at most once per document, without retries. Loader failure or no iframe within ten seconds hides the placement. An existing iframe can remain empty if delivery is blocked or unfilled; the site does not treat iframe creation as proof of fill. Browsing, search, social actions and original PNG downloads remain independent. The legacy document.write interception and global placement options are removed.

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

On 24 October 2026 the owner confirmed actual advertising delivery, no overlap, withdrawal in the same and another tab, and both original PNG downloads on the current production version, v1.10.2, at https://wallpapers.want.foundation/wallpapers/neon-tide-7/. The local release receipt records deployment `0cac6177c9634634ab909539b6b989bf` as succeeded for source `987cff5ebd258aedd5e95e5ebc2da3822f1efb44`. This owner confirmation is separate from intercepted browser tests; it does not establish revenue or approval of a new video format. The regional selection and two-network acceptance in #22 are superseded by #136.

[HilltopAds MultiTag documentation](https://hilltopads.com/publishers-help/en/articles/9065075-what-is-a-multitag-banner) describes the combined banner/popup format and manager-controlled settings. [#28](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/28) tracks the prepared video integration and its outstanding activation requirements.

## Video before a PNG download

The public zone `wf-wallpapers-vast-on-download` and its exact URL are recorded in `frontend/src/lib/advertising-providers.ts`. `PUBLIC_HILLTOP_VAST_ENABLED` defaults to false; normal builds keep native downloads and make no VAST requests. The existing banner and popup are independent of this flag.

The owner has created the zone but has not received confirmation that standalone video before a PNG download, without main video content and with immediate dismissal, is permitted. Do not enable it until those conditions and coexistence with the existing MultiTag are confirmed. HilltopAds documents VAST as preroll before main video and a default 15-second skip delay; creating a zone does not change those documented conditions.

The prepared player uses one Radix dialog, lazy VAST parsing and HTML video. It retains the selected wallpaper, desktop/mobile variant, native URL and filename for the action. Closing, completion, no-fill, unsupported media, failed playback or a ten-second load/stall timeout continue the same download once. The direct PNG link remains available during loading and playback. Modified clicks and JavaScript-disabled downloads retain their native behavior. Each new deliberate download can request one video; overlapping clicks cannot open another dialog.

Playback is muted and inline. The player accepts progressive MP4/WebM, rejects executable creatives, limits XML to 1 MiB and wrapper traversal to five levels. Tracking represents actual playback events; seeking or dismissal never reports completion. Cancellation removes media listeners and aborts pending VAST requests. Withdrawal suppresses further tracking. If MultiTag requires a document reload, a validated same-origin download action survives in session storage for at most one minute and is consumed once. Failure to access storage falls back to the native download.

VAST request statistics stay in memory. Upstream MIT notices ship at `/licenses/vast-client.txt` and `/licenses/xmldom.txt`. No database, download endpoint or CAPTCHA requirement is added. The global referrer policy and production CSP remain unchanged. The adapter currently accepts only same-origin resources and the supplied HTTPS VAST origin; additional delivery/tracking origins require provider verification, an explicit adapter allowlist and matching document-scoped CSP. Setting the flag alone is not a completed activation.

`bun run test:download-video-ui` runs the development-only preview on port 4386 with substituted VAST, media and tracking. The preview is excluded from production. The suite is also included in `make test-ui` and the local/full release flow. No live impressions or clicks are generated by these tests.

Before closing #28: obtain the provider's written conditions, validate the approved feed and CORS using its test procedure, review required origins, enable the build flag in an approved release, and confirm real video dismissal/completion, consent withdrawal and both PNG variants on the deployed version. #28 remains open until this acceptance is complete.
