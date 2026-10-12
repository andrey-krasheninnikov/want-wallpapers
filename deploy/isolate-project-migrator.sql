-- Run after isolate-project-admin.sql, as wallpapers-migrator in wallpapers.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $isolation$
DECLARE
    reviewed_tables CONSTANT text[] := ARRAY['collections', 'wallpapers', 'visitors', 'sessions', 'admin_totp', 'rate_limits',
        'ratings', 'comments', 'comment_authors', 'reports', 'feedback', 'audit_log', '_sqlx_migrations'];
    table_name text;
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
    IF current_user <> 'wallpapers-migrator'
       OR (SELECT datdba FROM pg_database WHERE datname = current_database()) <> 'wallpapers-admin'::regrole
       OR NOT has_schema_privilege(current_user, 'public', 'USAGE')
       OR NOT has_schema_privilege(current_user, 'public', 'CREATE') THEN
        RAISE EXCEPTION 'Expected wallpapers-migrator after the database-owner isolation step.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = ANY(excluded_roles)
          AND (has_database_privilege(oid, current_database(), 'CONNECT,CREATE,TEMPORARY')
               OR has_schema_privilege(oid, 'public', 'USAGE,CREATE'))
    ) THEN
        RAISE EXCEPTION 'Apply database-owner isolation before object grants.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND (c.relowner <> current_user::regrole
               OR NOT (c.relname = ANY(reviewed_tables) OR c.relname = 'audit_log_id_seq'))
    ) THEN
        RAISE EXCEPTION 'Public relation inventory changed; review owners and objects.';
    END IF;
    FOREACH table_name IN ARRAY reviewed_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
            RAISE EXCEPTION 'A reviewed Wallpapers table is missing.';
        END IF;
        -- PostgreSQL also revokes corresponding column grants from the same grantor.
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, %s RESTRICT', table_name, excluded_grantees);
    END LOOP;
    REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC,
        axentra_admin, axentra_migrator, axentra_runtime,
        axentra_stage_migrator, axentra_stage_runtime, axents_stage_admin RESTRICT;
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
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(c.relacl) acl
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND (acl.grantee = 0 OR acl.grantee IN (SELECT oid FROM pg_roles WHERE rolname = ANY(excluded_roles)))
    ) OR EXISTS (
        SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(a.attacl) acl
        WHERE n.nspname = 'public'
          AND (acl.grantee = 0 OR acl.grantee IN (SELECT oid FROM pg_roles WHERE rolname = ANY(excluded_roles)))
    ) THEN
        RAISE EXCEPTION 'Unexpected remaining relation or column grants; transaction cancelled.';
    END IF;
END
$isolation$;
COMMIT;
