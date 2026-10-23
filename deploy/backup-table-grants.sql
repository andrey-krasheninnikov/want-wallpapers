-- Run as wallpapers-migrator; grant read access only to the dedicated application's data.
\set ON_ERROR_STOP on
BEGIN;
GRANT SELECT ON TABLE public.collections, public.wallpapers, public.visitors, public.sessions,
 public.admin_totp, public.rate_limits, public.ratings, public.comments, public.comment_authors,
 public.reports, public.feedback, public.audit_log, public._sqlx_migrations TO "wallpapers-backup";
GRANT SELECT ON SEQUENCE public.audit_log_id_seq TO "wallpapers-backup";
DO $$ BEGIN
    IF to_regclass('public.distribution_batches') IS NOT NULL THEN
        GRANT SELECT ON public.distribution_state, public.distribution_batches, public.distribution_publications,
            public.distribution_deliveries, public.distribution_attempts TO "wallpapers-backup";
    END IF;
END $$;
COMMIT;
