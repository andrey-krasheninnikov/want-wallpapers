# 0014: One advertising provider per document

Status: accepted for #136. Replaces the regional provider-selection and advertising integration decisions in ADR 0005; its country lookup and consent rules remain unchanged.

## Decision

HilltopAds is the only advertising provider. The owner approved the supplied desktop/mobile MultiTag with one 300×250 banner and its standard popup behavior, then supplied two separate zone codes for additional banners. All public pages, including localized homes, compose advertising as labelled filled cards. Introductory copy, feedback contact, home benefits/FAQ, wallpaper comments and the footer provide the placement contexts. Responsive grids stack cards when the native creative would not fit alongside content. No video, download interstitial or replacement network is enabled.

Advertising remains independent of analytics. EEA and unknown-country visitors require an explicit choice; saved refusals take precedence. Administration, errors and development pages never start the tag. Downloads remain native links and do not wait for advertising.

The SDK owns document state and exposes no confirmed disposal contract. Once its first request starts, navigation loads a fresh document. Consent withdrawal and restoration from the back-forward cache also reload the document. Each distinct zone starts at most once per document, including after errors or resizing. Below the minimum width no zones start; loaded banners are hidden when the viewport becomes too narrow. A failed zone does not block the others.

## Trade-offs

Full navigation gives up client transitions after advertising starts, while keeping locale, wallpaper variant and viewer links. It prevents provider timers and handlers from surviving onto an excluded document or a document with withdrawn consent. Advertising windows already opened by the provider belong to separate browsing contexts and must be closed separately.

Only the provider tag changes its own request referrer policy. The global policy stays strict-origin-when-cross-origin. Parent-document CSP permits the confirmed script, frame and error-reporting origins without the previous advertising eval or inline-script exceptions. Additional origins require source verification.

The ten-second placement timeout hides the placement when no iframe appears and never delays the site. An existing but unfilled iframe may keep its reserved space. An iframe or successful tag request is not evidence of filled advertising. Actual delivery, popup frequency, account-specific ads.txt and CMP requirements require provider/account verification.
