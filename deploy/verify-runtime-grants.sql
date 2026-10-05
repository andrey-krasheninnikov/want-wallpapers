-- Read-only privilege check. No credentials or application rows are returned.
\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
\set runtime_role wallpapers
\endif
\if :{?migrator_role}
\else
\set migrator_role wallpapers-migrator
\endif
BEGIN READ ONLY;
SELECT EXISTS (
    SELECT 1 FROM pg_roles runtime, pg_roles migrator
    WHERE runtime.rolname = :'runtime_role' AND migrator.rolname = :'migrator_role'
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
) AS runtime_safe \gset
\if :runtime_safe
COMMIT;
\echo Runtime privilege isolation verified.
\else
DO $$ BEGIN
    RAISE EXCEPTION 'Runtime privilege isolation failed. Review owners, memberships, effective and default grants.';
END $$;
\endif
