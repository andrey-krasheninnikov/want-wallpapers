-- Read-only results; every *_safe / *_isolated column must be true.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
WITH runtime_check AS (
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
) AS runtime_safe
), excluded AS (
    SELECT oid, rolname FROM pg_roles WHERE rolname IN (
        'axentra_admin', 'axentra_migrator', 'axentra_runtime',
        'axentra_stage_migrator', 'axentra_stage_runtime', 'axents_stage_admin'
    )
)
SELECT current_database() AS database, current_user AS checked_by,
    current_database() = 'wallpapers'
        AND current_setting('server_version_num')::integer BETWEEN 180000 AND 189999 AS target_safe,
    runtime_safe,
    (SELECT count(*) = 6 FROM excluded)
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname LIKE 'axentra%' AND oid NOT IN (SELECT oid FROM excluded))
    AND NOT EXISTS (
        SELECT 1 FROM excluded WHERE has_database_privilege(oid, current_database(), 'CONNECT,CREATE,TEMPORARY')
    ) AS database_isolated,
    NOT EXISTS (SELECT 1 FROM excluded WHERE has_schema_privilege(oid, 'public', 'USAGE,CREATE')) AS schema_isolated,
    NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN excluded e
        WHERE n.nspname = 'public' AND (
            (c.relkind IN ('r', 'p', 'v', 'm', 'f') AND (
                has_table_privilege(e.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                OR has_any_column_privilege(e.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')))
            OR (c.relkind = 'S' AND has_sequence_privilege(e.oid, c.oid, 'SELECT,USAGE,UPDATE'))
        )
    ) AS objects_isolated,
    NOT EXISTS (
        SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
        WHERE d.defaclrole IN ('wallpapers-admin'::regrole, 'wallpapers-migrator'::regrole)
          AND d.defaclobjtype IN ('r', 'S', 'f') AND (acl.grantee = 0 OR acl.grantee IN (SELECT oid FROM excluded))
    ) AS defaults_isolated,
    (SELECT datdba = 'wallpapers-admin'::regrole FROM pg_database WHERE datname = current_database())
        AND has_database_privilege('wallpapers-migrator', current_database(), 'CONNECT')
        AND has_schema_privilege('wallpapers-migrator', 'public', 'USAGE')
        AND has_schema_privilege('wallpapers-migrator', 'public', 'CREATE')
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S') AND c.relowner <> 'wallpapers-migrator'::regrole
        ) AS owners_safe,
    NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
                AND usename IN (SELECT rolname FROM excluded)) AS sessions_isolated
FROM runtime_check;
ROLLBACK;
