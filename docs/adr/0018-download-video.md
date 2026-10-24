# 0018: Optional video before PNG downloads

Status: accepted for #28; enabled by owner request. Provider approval and deployed video playback remain unverified.

## Context

HilltopAds has replaced the regional providers in #22 and #136. The owner supplied zone `wf-wallpapers-vast-on-download` and a public VAST URL, and requested video before PNG downloads with immediate dismissal.

## Decision

Enable video by default; an explicit `PUBLIC_HILLTOP_VAST_ENABLED=false` disables it. Reuse the existing consent decision, native download links and Radix dialog. Capture a download action before asynchronous work and release it once after closing, completion or failure. A short-lived, validated session-storage entry carries only an interrupted download across the existing MultiTag withdrawal reload.

Use the pinned Dailymotion library for VAST parsing, wrappers and tracking, loaded only when an eligible download requests video. Use native HTML video for progressive MP4/WebM; never execute VPAID or add another advertising network. Requests are cancellable and bounded; tracking stops on withdrawal. Keep request counters in memory.

Do not add a server proxy or PostgreSQL state. The browser fetches the CORS-enabled feed. Read-only inspection on 24 October 2026 confirmed feed/tracking origin `https://loyal-product.com` and progressive MP4/WebM origin `https://www.silent-basis.pro`. Limit their CSP permissions to known successful wallpaper documents. Uninspected origins remain blocked.

## Trade-offs

Video requests begin only after an eligible download click with advertising consent. The owner requested activation, but confirmation of provider conditions for standalone PNG placement and immediate dismissal has not been recorded. Actual deployed playback remains a separate acceptance step, so #28 remains open. The existing banner and popup remain active.

The video adapter limits delivery origins and playable formats. Unreviewed origins and unsupported creatives produce a normal PNG download rather than a partial or permissive advertising setup. A browser may still ask for permission for automatic downloads; the native PNG link remains available while the dialog is open.
