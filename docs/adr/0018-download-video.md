# 0018: Optional video before PNG downloads

Status: accepted for preparation in #28; production activation is pending provider confirmation.

## Context

HilltopAds has replaced the regional providers in #22 and #136. The owner supplied zone `wf-wallpapers-vast-on-download` and a public VAST URL, and chose to prepare the integration while awaiting permission for standalone video before PNG downloads with immediate dismissal.

## Decision

Keep `PUBLIC_HILLTOP_VAST_ENABLED` false by default. Reuse the existing consent decision, native download links and Radix dialog. Capture a download action before asynchronous work and release it once after closing, completion or failure. A short-lived, validated session-storage entry carries only an interrupted download across the existing MultiTag withdrawal reload.

Use the pinned Dailymotion library for VAST parsing, wrappers and tracking, loaded only when an eligible download requests video. Use native HTML video for progressive MP4/WebM; never execute VPAID or add another advertising network. Requests are cancellable and bounded; tracking stops on withdrawal. Keep request counters in memory.

Do not add a server proxy or PostgreSQL state. Server fetching would add an unnecessary URL trust boundary; the browser can use an approved CORS-enabled feed. Do not broaden production CSP before the provider confirms its delivery origins.

## Trade-offs

The disabled integration can merge without changing current production downloads or creating unapproved impressions. Activation remains separate: provider conditions, feed/CORS validation, origin review and deployed acceptance are required. This intentionally leaves #28 open. The existing banner and popup remain active.

The video adapter limits delivery origins and playable formats. Unreviewed origins and unsupported creatives produce a normal PNG download rather than a partial or permissive advertising setup. A browser may still ask for permission for automatic downloads; the native PNG link remains available while the dialog is open.
