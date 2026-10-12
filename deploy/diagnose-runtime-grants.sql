-- Read-only: first result lists failed checks; following results show catalog metadata only.
BEGIN READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
    IF current_database() <> 'wallpapers'
       OR current_setting('server_version_num')::integer NOT BETWEEN 180000 AND 189999 THEN
        RAISE EXCEPTION 'Expected wallpapers database on PostgreSQL 18.';
    END IF;
END $$;
WITH checks AS (
    SELECT check_name, passed
    FROM pg_roles runtime CROSS JOIN pg_roles migrator
    CROSS JOIN LATERAL (VALUES
    ('distinct_roles', runtime.oid <> migrator.oid),
    ('runtime_login', runtime.rolcanlogin),
    ('no_elevated_role_attributes', NOT (runtime.rolsuper OR runtime.rolcreatedb OR runtime.rolcreaterole OR runtime.rolreplication OR runtime.rolbypassrls)),
    ('no_memberships', NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = runtime.oid)),
    ('database_connect', has_database_privilege(runtime.oid, current_database(), 'CONNECT')),
    ('no_database_create_or_temp', NOT has_database_privilege(runtime.oid, current_database(), 'CREATE,TEMPORARY')),
    ('public_usage', has_schema_privilege(runtime.oid, 'public', 'USAGE')),
    ('no_schema_create', NOT EXISTS (
          SELECT 1 FROM pg_namespace namespace
          WHERE has_schema_privilege(runtime.oid, namespace.oid, 'CREATE')
      )),
    ('no_owned_objects', NOT EXISTS (
          SELECT 1 FROM pg_shdepend dependency
          WHERE dependency.refclassid = 'pg_authid'::regclass
            AND dependency.refobjid = runtime.oid AND dependency.deptype = 'o'
            AND dependency.dbid IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      )),
    ('no_broad_defaults', NOT EXISTS (
          SELECT 1 FROM pg_default_acl defaults, LATERAL aclexplode(defaults.defaclacl) acl
          WHERE defaults.defaclobjtype IN ('r', 'S', 'f') AND acl.grantee IN (0, runtime.oid)
      )),
    ('no_table_grant_options', NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          CROSS JOIN LATERAL aclexplode(relation.relacl) acl
          WHERE namespace.nspname = 'public' AND acl.grantee IN (0, runtime.oid) AND acl.is_grantable
      )),
    ('no_column_grant_options', NOT EXISTS (
          SELECT 1 FROM pg_attribute column_grant
          JOIN pg_class relation ON relation.oid = column_grant.attrelid
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          CROSS JOIN LATERAL aclexplode(column_grant.attacl) acl
          WHERE namespace.nspname = 'public' AND acl.grantee IN (0, runtime.oid) AND acl.is_grantable
      )),
    ('required_table_crud', NOT EXISTS (
          SELECT 1 FROM (VALUES
              ('collections'), ('wallpapers'), ('visitors'), ('sessions'), ('admin_totp'),
              ('rate_limits'), ('ratings'), ('comments'), ('comment_authors'), ('reports'), ('feedback')
          ) required(name)
          WHERE NOT (has_table_privilege(runtime.oid, 'public.' || required.name, 'SELECT')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'INSERT')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'UPDATE')
              AND has_table_privilege(runtime.oid, 'public.' || required.name, 'DELETE'))
      )),
    ('audit_select', has_table_privilege(runtime.oid, 'public.audit_log', 'SELECT')),
    ('audit_insert', has_table_privilege(runtime.oid, 'public.audit_log', 'INSERT')),
    ('no_audit_mutation', NOT has_table_privilege(runtime.oid, 'public.audit_log', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')),
    ('no_audit_column_mutation', NOT has_any_column_privilege(runtime.oid, 'public.audit_log', 'UPDATE,REFERENCES')),
    ('audit_sequence_usage', has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'USAGE')),
    ('audit_sequence_select', has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'SELECT')),
    ('no_audit_sequence_update', NOT has_sequence_privilege(runtime.oid, 'public.audit_log_id_seq', 'UPDATE')),
    ('no_migration_history_access', NOT has_table_privilege(runtime.oid, 'public._sqlx_migrations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')),
    ('no_migration_history_column_access', NOT has_any_column_privilege(runtime.oid, 'public._sqlx_migrations', 'SELECT,INSERT,UPDATE,REFERENCES')),
    ('no_extra_table_privileges', NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND has_table_privilege(runtime.oid, relation.oid, 'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      )),
    ('no_unknown_relation_access', NOT EXISTS (
          SELECT 1 FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
            AND relation.relname NOT IN ('collections', 'wallpapers', 'visitors', 'sessions', 'admin_totp',
                'rate_limits', 'ratings', 'comments', 'comment_authors', 'reports', 'feedback', 'audit_log')
            AND (has_table_privilege(runtime.oid, relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
                OR has_any_column_privilege(runtime.oid, relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
      ))
    ) AS check_result(check_name, passed)
    WHERE runtime.rolname = 'wallpapers' AND migrator.rolname = 'wallpapers-migrator'
    UNION ALL
    SELECT 'roles_exist', EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wallpapers')
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wallpapers-migrator')
)
SELECT check_name AS failed_check FROM checks WHERE NOT coalesce(passed, false) ORDER BY check_name;

SELECT d.classid::regclass AS catalog,
       pg_describe_object(d.classid, d.objid, d.objsubid) AS owned_object
FROM pg_shdepend d
WHERE d.refclassid = 'pg_authid'::regclass AND d.refobjid = 'wallpapers'::regrole
  AND d.deptype = 'o'
  AND d.dbid IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()));

SELECT nspname AS schema_with_create FROM pg_namespace
WHERE has_schema_privilege('wallpapers', oid, 'CREATE');

SELECT pg_get_userbyid(d.defaclrole) AS creator,
       n.nspname AS schema, d.defaclobjtype AS object_type,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclobjtype IN ('r', 'S', 'f') AND a.grantee IN (0, 'wallpapers'::regrole);
ROLLBACK;
