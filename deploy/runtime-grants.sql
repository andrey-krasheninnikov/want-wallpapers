-- Run after migrations as the database owner. Change the role only if configured differently.
BEGIN;
GRANT USAGE ON SCHEMA public TO wallpapers_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    collections, wallpapers, visitors, sessions, admin_totp, rate_limits,
    ratings, comments, comment_authors, reports, feedback TO wallpapers_app;
GRANT SELECT, INSERT ON audit_log TO wallpapers_app;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO wallpapers_app;
COMMIT;
