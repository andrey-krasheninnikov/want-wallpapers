-- Run as wallpapers-migrator; grant read access only to the dedicated application's data.
\set ON_ERROR_STOP on
BEGIN;
GRANT SELECT ON TABLE public.collections, public.wallpapers, public.visitors, public.sessions,
 public.admin_totp, public.rate_limits, public.ratings, public.comments, public.comment_authors,
 public.reports, public.feedback, public.audit_log, public._sqlx_migrations TO "wallpapers-backup";
GRANT SELECT ON SEQUENCE public.audit_log_id_seq TO "wallpapers-backup";
COMMIT;
