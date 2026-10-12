-- Run the whole file as wallpapers-admin in the wallpapers database.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $isolation$
DECLARE
    excluded_roles CONSTANT text[] := ARRAY['axentra_admin', 'axentra_migrator', 'axentra_runtime',
        'axentra_stage_migrator', 'axentra_stage_runtime', 'axents_stage_admin'];
    excluded_grantees text;
    object_kind text;
    default_scope text;
BEGIN
    IF current_database() <> 'wallpapers'
       OR current_setting('server_version_num')::integer NOT BETWEEN 180000 AND 189999 THEN
        RAISE EXCEPTION 'Expected wallpapers database on PostgreSQL 18.';
    END IF;
    IF (SELECT count(*) FROM pg_roles WHERE rolname = ANY(excluded_roles)) <> 6
       OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname LIKE 'axentra%' AND NOT rolname = ANY(excluded_roles))
       OR EXISTS (
           SELECT 1 FROM pg_roles r WHERE r.rolname = ANY(excluded_roles)
             AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
                  OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid))
       ) THEN
        RAISE EXCEPTION 'Axentra role inventory changed; review privileges and memberships.';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_stat_activity
               WHERE datname = current_database() AND usename = ANY(excluded_roles)) THEN
        RAISE EXCEPTION 'Close Axentra connections to wallpapers before isolation.';
    END IF;
    SELECT string_agg(format('%I', name), ', ') INTO excluded_grantees
    FROM unnest(excluded_roles) AS name;
    IF current_user <> 'wallpapers-admin'
       OR (SELECT datdba FROM pg_database WHERE datname = current_database()) <> current_user::regrole
       OR (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') <> 'pg_database_owner'::regrole THEN
        RAISE EXCEPTION 'Expected wallpapers-admin as database owner with pg_database_owner public schema.';
    END IF;
    IF NOT has_database_privilege('wallpapers', current_database(), 'CONNECT')
       OR has_database_privilege('wallpapers', current_database(), 'CREATE,TEMPORARY')
       OR NOT has_database_privilege('wallpapers-migrator', current_database(), 'CONNECT') THEN
        RAISE EXCEPTION 'Runtime or migrator database privileges differ from the reviewed inventory.';
    END IF;
    EXECUTE format('REVOKE ALL ON DATABASE wallpapers FROM PUBLIC, %s RESTRICT', excluded_grantees);
    EXECUTE format('REVOKE ALL ON SCHEMA public FROM PUBLIC, %s RESTRICT', excluded_grantees);
    GRANT USAGE ON SCHEMA public TO wallpapers;
    GRANT USAGE, CREATE ON SCHEMA public TO "wallpapers-migrator";
    -- Global and public defaults are independent; change only this connection's role.
    FOREACH object_kind IN ARRAY ARRAY['TABLES', 'SEQUENCES', 'FUNCTIONS'] LOOP
        FOREACH default_scope IN ARRAY ARRAY['', ' IN SCHEMA public'] LOOP
            EXECUTE format('ALTER DEFAULT PRIVILEGES%s REVOKE ALL ON %s FROM PUBLIC, %s RESTRICT',
                           default_scope, object_kind, excluded_grantees);
        END LOOP;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
        WHERE d.defaclrole = current_user::regrole AND d.defaclobjtype IN ('r', 'S', 'f')
          AND (acl.grantee = 0 OR acl.grantee IN (SELECT oid FROM pg_roles WHERE rolname = ANY(excluded_roles)))
    ) THEN
        RAISE EXCEPTION 'Unexpected defaults outside public; review before continuing.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = ANY(excluded_roles)
          AND (has_database_privilege(oid, current_database(), 'CONNECT,CREATE,TEMPORARY')
               OR has_schema_privilege(oid, 'public', 'USAGE,CREATE'))
    ) THEN
        RAISE EXCEPTION 'Axentra still has effective database or schema privileges.';
    END IF;
END
$isolation$;
COMMIT;
