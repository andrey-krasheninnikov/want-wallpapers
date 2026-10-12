-- Run as wallpapers-admin or wallpapers-backup; remove only that role's automatic runtime grants.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $repair$
DECLARE
    object_kind text;
    default_scope text;
BEGIN
    IF current_database() <> 'wallpapers'
       OR current_setting('server_version_num')::integer NOT BETWEEN 180000 AND 189999 THEN
        RAISE EXCEPTION 'Expected wallpapers database on PostgreSQL 18.';
    END IF;
    IF current_user NOT IN ('wallpapers-admin', 'wallpapers-backup')
       OR (SELECT datdba FROM pg_database WHERE datname = current_database()) <> 'wallpapers-admin'::regrole THEN
        RAISE EXCEPTION 'Expected reviewed defaults role and wallpapers-admin as database owner.';
    END IF;
    FOREACH object_kind IN ARRAY ARRAY['TABLES', 'SEQUENCES', 'FUNCTIONS'] LOOP
        FOREACH default_scope IN ARRAY ARRAY['', ' IN SCHEMA public'] LOOP
            EXECUTE format('ALTER DEFAULT PRIVILEGES%s REVOKE ALL ON %s FROM wallpapers RESTRICT',
                           default_scope, object_kind);
        END LOOP;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
        WHERE d.defaclrole = current_user::regrole AND d.defaclobjtype IN ('r', 'S', 'f')
          AND acl.grantee = 'wallpapers'::regrole
    ) THEN
        RAISE EXCEPTION 'Runtime defaults remain outside the reviewed scope; transaction cancelled.';
    END IF;
END
$repair$;
COMMIT;
