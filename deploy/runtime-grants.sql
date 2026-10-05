-- Run after migrations as the database owner. psql quotes runtime_role as an identifier.
\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
\set runtime_role wallpapers
\endif
BEGIN;
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.collections, public.wallpapers, public.visitors, public.sessions, public.admin_totp, public.rate_limits,
    public.ratings, public.comments, public.comment_authors, public.reports, public.feedback TO :"runtime_role";
GRANT SELECT, INSERT ON public.audit_log TO :"runtime_role";
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO :"runtime_role";
COMMIT;
