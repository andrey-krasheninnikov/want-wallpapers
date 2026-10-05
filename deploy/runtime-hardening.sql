-- Operator-only remediation for the dedicated wallpapers database; see docs/deployment.md.
-- Stop app first, review owners/column grants, then reapply runtime-grants.sql and verify.
\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
\set runtime_role wallpapers
\endif
\if :{?migrator_role}
\else
\set migrator_role wallpapers-migrator
\endif
BEGIN;
SELECT format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC, %I', current_database(), :'runtime_role') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC, :"runtime_role";
REVOKE ALL ON TABLE
    public.collections, public.wallpapers, public.visitors, public.sessions, public.admin_totp, public.rate_limits,
    public.ratings, public.comments, public.comment_authors, public.reports, public.feedback,
    public.audit_log, public._sqlx_migrations FROM PUBLIC, :"runtime_role";
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC, :"runtime_role";
-- Global and schema defaults are independent; neither REVOKE replaces the other.
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" REVOKE ALL ON TABLES FROM PUBLIC, :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" REVOKE ALL ON SEQUENCES FROM PUBLIC, :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" REVOKE ALL ON FUNCTIONS FROM PUBLIC, :"runtime_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator_role" IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, :"runtime_role";
-- Remove only the reported reciprocal table defaults for the other known role.
ALTER DEFAULT PRIVILEGES FOR ROLE :"runtime_role" REVOKE ALL ON TABLES FROM :"migrator_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"runtime_role" IN SCHEMA public REVOKE ALL ON TABLES FROM :"migrator_role";
COMMIT;
