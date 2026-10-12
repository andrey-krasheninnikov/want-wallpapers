-- Run after repairing each reported creator's defaults, as wallpapers-migrator; check the full runtime allowlist before commit.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $repair$
BEGIN
    IF current_database() <> 'wallpapers'
       OR current_setting('server_version_num')::integer NOT BETWEEN 180000 AND 189999 THEN
        RAISE EXCEPTION 'Expected wallpapers database on PostgreSQL 18.';
    END IF;
    IF current_user <> 'wallpapers-migrator'
       OR (SELECT datdba FROM pg_database WHERE datname = current_database()) <> 'wallpapers-admin'::regrole
       OR EXISTS (
           SELECT 1 FROM pg_class
           WHERE oid IN ('public.audit_log'::regclass, 'public._sqlx_migrations'::regclass,
                         'public.audit_log_id_seq'::regclass)
             AND relowner <> current_user::regrole
       ) THEN
        RAISE EXCEPTION 'Expected wallpapers-migrator owning the reviewed audit/history objects.';
    END IF;
    -- Keep required audit SELECT/INSERT while removing mutation and matching column grants.
    REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
        ON TABLE public.audit_log FROM wallpapers RESTRICT;
    REVOKE ALL ON TABLE public._sqlx_migrations FROM wallpapers RESTRICT;
    REVOKE UPDATE ON SEQUENCE public.audit_log_id_seq FROM wallpapers RESTRICT;
    GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO wallpapers;
    IF NOT (
SELECT EXISTS (
    SELECT 1 FROM pg_roles runtime, pg_roles migrator
    WHERE runtime.rolname = 'wallpapers' AND migrator.rolname = 'wallpapers-migrator'
      AND runtime.oid <> migrator.oid
      AND runtime.rolcanlogin
      AND NOT (runtime.rolsuper OR runtime.rolcreatedb OR runtime.rolcreaterole OR runtime.rolreplication OR runtime.rolbypassrls)
      AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = runtime.oid)
      AND has_database_privilege(runtime.oid, current_database(), 'CONNECT')
      AND NOT has_database_privilege(runtime.oid, current_database(), 'CREATE,TEMPORARY')
      AND has_schema_privilege(runtime.oid, 'public', 'USAGE')
      AND NOT EXISTS (
          SELECT 1 FROM pg_namespace namespace
          WHERE has_schema_privilege(runtime.oid, namespace.oid, 'CREATE')
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_shdepend dependency
          WHERE dependency.refclassid = 'pg_authid'::regclass
            AND dependency.refobjid = runtime.oid AND dependency.deptype = 'o'
            AND dependency.dbid IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_default_acl defaults, LATERAL aclexplode(defaults.defaclacl) acl
          WHERE defaults.defaclobjtype IN ('r', 'S', 'f') AND acl.grantee IN (0, runtime.oid)
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          CROSS JOIN LATERAL aclexplode(relation.relacl) acl
          WHERE namespace.nspname = 'public' AND acl.grantee IN (0, runtime.oid) AND acl.is_grantable
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_attribute column_grant
          JOIN pg_class relation ON relation.oid = column_grant.attrelid
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          CROSS JOIN LATERAL aclexplode(column_grant.attacl) acl
          WHERE namespace.nspname = 'public' AND acl.grantee IN (0, runtime.oid) AND acl.is_grantable
      )
      AND NOT EXISTS (
          SELECT 1 FROM (VALUES
              ('collections'), ('wallpapers'), ('visitors'), ('sessions'), ('admin_totp'),
              ('rate_limits'), ('ratings'), ('comments'), ('comment_authors'), ('reports'), ('feedback')
          ) required(name)
          WHERE NOT (has_table_privilege(runtime.oid, 'public.' || required.name, 'SELECT')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'INSERT')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'UPDATE')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'DELETE'))
      )
      AND has_table_privilege(runtime.oid, 'public.audit_log', 'SELECT')
      AND has_table_privilege(runtime.oid, 'public.audit_log', 'INSERT')
      AND NOT has_table_privilege(runtime.oid, 'public.audit_log', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      AND NOT has_any_column_privilege(runtime.oid, 'public.audit_log', 'UPDATE,REFERENCES')
      AND has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'USAGE')
      AND has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'SELECT')
      AND NOT has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'UPDATE')
      AND NOT has_table_privilege(runtime.oid, 'public._sqlx_migrations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      AND NOT has_any_column_privilege(runtime.oid, 'public._sqlx_migrations', 'SELECT,INSERT,UPDATE,REFERENCES')
      AND NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND has_table_privilege(runtime.oid, relation.oid, 'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      )
      AND NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND relation.relname NOT IN ('collections', 'wallpapers', 'visitors', 'sessions', 'admin_totp',
                'rate_limits', 'ratings', 'comments', 'comment_authors', 'reports', 'feedback', 'audit_log')
            AND (has_table_privilege(runtime.oid, relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
                OR has_any_column_privilege(runtime.oid, relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
      )
)
    ) THEN
        RAISE EXCEPTION 'Runtime allowlist still fails; transaction cancelled. Run read-only diagnostics after ROLLBACK.';
    END IF;
END
$repair$;
COMMIT;
