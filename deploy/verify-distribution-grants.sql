-- Read-only privilege verification; usable by psql and the worker connection.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles worker WHERE worker.rolname = 'wallpapers-distributor'
        AND worker.rolcanlogin AND NOT (worker.rolsuper OR worker.rolcreatedb OR worker.rolcreaterole OR worker.rolreplication OR worker.rolbypassrls)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = worker.oid)
        AND has_database_privilege(worker.oid, current_database(), 'CONNECT')
        AND NOT has_database_privilege(worker.oid, current_database(), 'CREATE,TEMPORARY')
        AND has_schema_privilege(worker.oid, 'public', 'USAGE')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE has_schema_privilege(worker.oid, oid, 'CREATE'))
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_shdepend WHERE refclassid='pg_catalog.pg_authid'::regclass
            AND refobjid=worker.oid AND deptype='o' AND dbid IN (0, (SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())))
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_default_acl, LATERAL aclexplode(defaclacl) acl WHERE defaclobjtype IN ('r','S','f') AND acl.grantee IN (0, worker.oid))
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class relation JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
            WHERE namespace.nspname='public' AND relation.relkind IN ('r','p','v','m','f')
              AND relation.relname NOT IN ('distribution_state','distribution_batches','distribution_publications','distribution_deliveries','distribution_attempts')
              AND (has_table_privilege(worker.oid, relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                OR has_any_column_privilege(worker.oid, relation.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))
        )
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class relation JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
            WHERE namespace.nspname='public' AND relation.relkind='S' AND has_sequence_privilege(worker.oid, relation.oid, 'USAGE,SELECT,UPDATE')
        )
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class relation JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace,
                LATERAL aclexplode(relation.relacl) acl
            WHERE namespace.nspname='public' AND acl.grantee IN (0,worker.oid) AND acl.is_grantable
        )
        AND NOT EXISTS (
            SELECT 1 FROM (VALUES ('distribution_state'),('distribution_batches'),('distribution_publications'),('distribution_deliveries'),('distribution_attempts')) required(name)
            WHERE NOT has_table_privilege(worker.oid, 'public.'||required.name, 'SELECT')
              OR has_table_privilege(worker.oid, 'public.'||required.name, 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        )
        AND NOT EXISTS (
            SELECT 1 FROM (VALUES ('distribution_batches'),('distribution_publications'),('distribution_deliveries'),('distribution_attempts')) required(name)
            WHERE NOT has_table_privilege(worker.oid, 'public.'||required.name, 'INSERT')
        )
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_attribute attribute JOIN pg_catalog.pg_class relation ON relation.oid=attribute.attrelid
            JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace, LATERAL aclexplode(attribute.attacl) acl
            WHERE namespace.nspname='public' AND acl.grantee IN (0,worker.oid) AND acl.is_grantable
        )
        AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc function JOIN pg_catalog.pg_namespace namespace ON namespace.oid=function.pronamespace
            WHERE namespace.nspname='public' AND function.prosecdef AND has_function_privilege(worker.oid,function.oid,'EXECUTE')
        )
        AND NOT EXISTS (
            SELECT 1 FROM (VALUES ('distribution_state'),('distribution_deliveries'),('distribution_attempts')) required(name)
            WHERE NOT has_table_privilege(worker.oid, 'public.'||required.name, 'UPDATE')
        )
        AND NOT has_table_privilege(worker.oid, 'public.distribution_batches', 'UPDATE')
        AND NOT has_table_privilege(worker.oid, 'public.distribution_publications', 'UPDATE')
    ) THEN
        RAISE EXCEPTION 'Distribution privilege isolation failed.';
    END IF;
END $$;
