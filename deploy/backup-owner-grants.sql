-- Run as the actual database/schema owner after creating the backup login privately.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database() <> 'wallpapers' THEN RAISE EXCEPTION 'Wrong database'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wallpapers-backup' AND rolcanlogin
   AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
   RAISE EXCEPTION 'Provision the restricted wallpapers-backup login first';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='wallpapers-backup')) THEN
   RAISE EXCEPTION 'Backup role memberships require review';
 END IF;
END $$;
GRANT CONNECT ON DATABASE wallpapers TO "wallpapers-backup";
GRANT USAGE ON SCHEMA public TO "wallpapers-backup";
GRANT CREATE ON SCHEMA public TO "wallpapers-migrator";
COMMIT;
