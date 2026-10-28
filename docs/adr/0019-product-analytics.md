# ADR 0019: Product analytics

## Status

Accepted for issue #171.

## Context

The public gallery needs comparable content, discovery and download measurements. Firebase Analytics already follows regional consent and separate advertising preferences. Native PNG downloads, public routes, six locales and private administration must remain available. Reporting uses free GA4 features; the owner configures the existing property.

## Decision

Use the existing Firebase SDK with a typed event contract and explicit public-page instrumentation. Keep `wallpaper_download` as the native download start, add distinct click and Telegram events, and send manual canonical `page_view` events for document and Astro navigation. Disable Enhanced Measurement in the owner configuration to avoid duplicate or uncontrolled collection.

Consent remains governed by ADR 0005. Bound the post-permission startup queue to 50 events and 30 seconds in memory, wait for SDK readiness, and clear it on withdrawal. Do not replay actions before permission. Strip free input and URL query/fragment; report fixed failure categories and public catalogue terms only. Do not add User-ID or Google Signals.

Measure visibility with IntersectionObserver and real document Web Vitals with the official library. Report the iframe container lifecycle separately from provider impressions and revenue. VAST remains disabled for this release unless explicitly enabled separately.

## Alternatives and trade-offs

A second Google tag or GTM would create a second owner for consent and page views. A server event store or Measurement Protocol integration would add identifier handling, infrastructure and delivery semantics that are unnecessary for client download starts. BigQuery and a custom dashboard exceed the agreed reporting scope.

Browser analytics cannot prove a file was saved, a Telegram subscription happened or an ad generated revenue. It does not cover visitors refusing collection or blocking scripts. GA4 funnel and content explorations are sufficient for the first reports, with the documented limits on formulas across events. Core Web Vitals describe a document; Astro swaps are not mislabelled as new LCP measurements.
