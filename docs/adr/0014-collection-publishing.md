# 0014 Collection packages and durable distribution

Status: accepted. Extends 0013 for #123.

Use a private provider-independent collection package, exact hash approval, a Bun publisher using the existing signed local release, and a sequential Rust distribution worker backed by PostgreSQL. Keep generation, media processing and builds on the MacBook. Keep destination receipts on the VPS and reconcile unknown outcomes before retry.

The complete contracts, alternatives, assumptions and rollout are recorded in [the system design](../ideas/collection-publishing.md). No new public API or administration surface is required. The trade-off is that creative preparation, account authorization and ambiguous provider outcomes still require owner input.
