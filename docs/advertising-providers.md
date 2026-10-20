# HilltopAds

HilltopAds is the only advertising provider. The owner supplied the public MultiTag and approved its 300×250 desktop/mobile banner and standard popup behavior in [#136](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/136). [ADR 0014](adr/0014-hilltopads.md) records the document boundary and trade-offs.

## Placement and consent

One labelled banner appears after the main content before the footer. It retains its original dimensions and has 10 px side gutters at a 320 px viewport. The tag does not start when the available width is below 300 px. No side towers, video or download interstitial are enabled. Popup frequency belongs to the provider configuration; the site does not add popup timers or use advertising as a download requirement.

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

Automated advertising tests block external traffic and substitute the tag, banner and popup pages. They cover consent, six locales, responsive layout, withdrawal, pending loads, timeout, navigation, CSP and native downloads. They produce no live advertising impressions or clicks.

Before closing #136, record the deployed version, date and public URL. Using the provider-approved verification procedure, confirm actual banner content, expected popup behavior, withdrawal and both PNG variants. Do not click advertisements or manufacture traffic. Script loading and an empty iframe do not prove delivery or revenue.

[HilltopAds MultiTag documentation](https://hilltopads.com/publishers-help/en/articles/9065075-what-is-a-multitag-banner) describes the combined banner/popup format and manager-controlled settings. [#28](https://github.com/andrey-krasheninnikov/want-wallpapers/issues/28) remains separate video work.
