# 0007: Verify backup restoration outside the production VPS

Status: accepted; implementation pending. Extends the database and recovery decisions in [0004](0004-rust-monorepo.md).

The reported production capacity is one CPU and approximately 889 MiB RAM, subject to verification during provisioning, so a separate trusted worker must create a fresh encrypted pre-migration backup and demonstrate its restoration in an isolated PostgreSQL 18 environment before migrations proceed. Backups remain private for 30 days, with recoverable encryption keys and deployment-bound verification records; database credentials, user data and backup contents do not enter GitHub artifacts or the public artwork CDN. Failed verification blocks migration, and an old application/configuration is restored automatically only after schema compatibility is positively established; database deletion, down-migrations and restoring over production require separate authorization.
