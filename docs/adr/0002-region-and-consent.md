# 0002: Gate interactive features by region and consent

Status: superseded in backend and deployment details by [0004](0004-rust-monorepo.md)

The browser checks the visitor's country through an external IP lookup. For Russian IP addresses or lookup failures, the interface hides ratings, comments, feedback, and analytics. Browsing, search, and downloads stay available. The check runs in the browser and does not prevent direct Firestore API requests; it is an availability control, not a security boundary.

Analytics loads only after an explicit choice and an allowed region result. The visitor can change the choice in the footer. Firebase Analytics still needs a measurement ID before it can run. Advertising remains disconnected until a provider, consent flow, and terms are chosen.
