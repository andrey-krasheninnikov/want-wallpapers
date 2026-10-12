#!/usr/bin/env python3
"""Check the reviewed cross-project ACL procedure on a fresh local PostgreSQL 18."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

repository = Path(__file__).resolve().parent.parent
nonce = secrets.token_hex(4)
container = f'wallpapers-isolation-{nonce}'
environment = os.environ.copy()
environment.update(TEST_DB_CONTAINER=container, TEST_DB_PORT='55439',
                   TEST_SECRETS_DIR=f'/tmp/wallpapers-isolation-{nonce}')

def query(sql, user='postgres', database='wallpapers', fails=False):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-qAt',
                             '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database],
                            input=sql, text=True, capture_output=True)
    if fails:
        assert result.returncode != 0, 'Unsafe operation was accepted.'
    elif result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()

roles = ['axentra_admin', 'axentra_migrator', 'axentra_runtime',
         'axentra_stage_migrator', 'axentra_stage_runtime', 'axents_stage_admin']
admin = (repository / 'deploy/isolate-project-admin.sql').read_text()
migrator = (repository / 'deploy/isolate-project-migrator.sql').read_text()
verification = (repository / 'deploy/verify-project-isolation.sql').read_text()
try:
    subprocess.run([sys.executable, str(repository / 'scripts/test-db.py')],
                   env=environment, check=True)
    inspection = subprocess.run(['docker', 'inspect', container, '--format', '{{json .Config.Labels}}'],
                                capture_output=True, text=True, check=True)
    assert json.loads(inspection.stdout)['foundation.want.wallpapers.test'] == 'true'
    query('CREATE ROLE "wallpapers-admin" LOGIN CREATEDB CREATEROLE; '
          'CREATE ROLE "wallpapers-migrator" LOGIN; CREATE ROLE wallpapers LOGIN; '
          'CREATE ROLE backup_user LOGIN; CREATE ROLE "wallpapers-backup" LOGIN; ' +
          ''.join(f'CREATE ROLE {role} LOGIN; ' for role in roles), database='postgres')
    query('CREATE DATABASE wallpapers OWNER "wallpapers-admin"; '
          'CREATE DATABASE axentra_fixture OWNER axentra_admin;', database='postgres')
    query('REVOKE ALL ON DATABASE wallpapers FROM PUBLIC; '
          'GRANT CONNECT ON DATABASE wallpapers TO wallpapers, "wallpapers-migrator", "wallpapers-backup", backup_user; '
          'GRANT CONNECT, TEMPORARY ON DATABASE wallpapers TO axentra_stage_migrator, axentra_stage_runtime, axents_stage_admin; '
          'GRANT USAGE ON SCHEMA public TO wallpapers, "wallpapers-migrator"; '
          'GRANT CREATE ON SCHEMA public TO "wallpapers-migrator"; '
          'GRANT USAGE, CREATE ON SCHEMA public TO "wallpapers-backup"; '
          'GRANT USAGE, CREATE ON SCHEMA public TO axentra_migrator;', user='wallpapers-admin')
    query((repository / 'backend/migrations/202610040001_schema.sql').read_text() +
          'CREATE TABLE public._sqlx_migrations(version bigint); '
          'GRANT ALL ON ALL TABLES IN SCHEMA public TO "wallpapers-admin", axentra_migrator; '
          'GRANT SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "wallpapers-admin", axentra_migrator; '
          'GRANT SELECT (version) ON public._sqlx_migrations TO axentra_stage_runtime; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "wallpapers-admin", axentra_migrator; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "wallpapers-admin"; '
          'ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "wallpapers-admin";',
          user='wallpapers-migrator')
    query((repository / 'deploy/runtime-grants.sql').read_text(), user='wallpapers-migrator')
    query('REVOKE CREATE ON SCHEMA public FROM "wallpapers-migrator"; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS '
          'TO "wallpapers-migrator", axentra_stage_migrator, axentra_stage_runtime, axents_stage_admin;',
          user='wallpapers-admin')
    query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "wallpapers-migrator";',
          user='axentra_stage_runtime')
    query('CREATE TABLE public.keep_rights(id integer); '
          'GRANT SELECT ON public.keep_rights TO axentra_runtime; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO axentra_runtime;',
          user='axentra_admin', database='axentra_fixture')
    acl_snapshot = """SELECT string_agg(c.relname || ':' || coalesce(a.privilege_type, '') || ':' || coalesce(a.is_grantable::text, ''), ',' ORDER BY c.relname, a.privilege_type)
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
        WHERE n.nspname = 'public' AND r.rolname IN ('wallpapers', 'wallpapers-admin');"""
    preserved = query(acl_snapshot)
    other_database = query('SELECT relacl::text FROM pg_class WHERE oid = \'public.keep_rights\'::regclass;', database='axentra_fixture')
    other_defaults = query("SELECT defaclacl::text FROM pg_default_acl WHERE defaclrole = 'axentra_stage_runtime'::regrole;")
    query('CREATE ROLE axentra_unreviewed LOGIN;')
    query(admin, user='wallpapers-admin', fails=True)
    query('DROP ROLE axentra_unreviewed;')
    query(admin, user='wallpapers-migrator', fails=True)
    query(migrator, user='wallpapers-admin', fails=True)
    query(admin, user='wallpapers-admin', database='axentra_fixture', fails=True)
    query(migrator, user='wallpapers-migrator', database='axentra_fixture', fails=True)
    query(migrator, user='wallpapers-migrator', fails=True)
    # A late postcondition failure must undo earlier REVOKEs and the schema grant.
    query('CREATE SCHEMA isolation_unreviewed; ALTER DEFAULT PRIVILEGES IN SCHEMA isolation_unreviewed '
          'GRANT SELECT ON TABLES TO axentra_runtime;', user='wallpapers-admin')
    query(admin, user='wallpapers-admin', fails=True)
    assert query("SELECT has_database_privilege('axentra_stage_runtime', 'wallpapers', 'CONNECT') "
                 "AND NOT has_schema_privilege('wallpapers-migrator', 'public', 'CREATE');") == 't'
    query('ALTER DEFAULT PRIVILEGES IN SCHEMA isolation_unreviewed REVOKE SELECT ON TABLES FROM axentra_runtime;',
          user='wallpapers-admin')
    query(admin, user='wallpapers-admin')
    query('ALTER DEFAULT PRIVILEGES IN SCHEMA isolation_unreviewed GRANT SELECT ON TABLES TO axentra_runtime;',
          user='wallpapers-migrator')
    query(migrator, user='wallpapers-migrator', fails=True)
    assert query("SELECT has_table_privilege('axentra_migrator', 'public._sqlx_migrations', 'SELECT') "
                 "AND has_any_column_privilege('axentra_stage_runtime', 'public._sqlx_migrations', 'SELECT');") == 't'
    query('ALTER DEFAULT PRIVILEGES IN SCHEMA isolation_unreviewed REVOKE SELECT ON TABLES FROM axentra_runtime;',
          user='wallpapers-migrator')
    for _ in range(2):
        query(admin, user='wallpapers-admin')
        query(migrator, user='wallpapers-migrator')
        result = query(verification, user='wallpapers-admin').splitlines()[-1].split('|')
        assert result[0:2] == ['wallpapers', 'wallpapers-admin'] and result[2:] == ['t'] * 8, result
        query((repository / 'deploy/verify-runtime-grants.sql').read_text(), user='wallpapers-admin')
    diagnostics = (repository / 'deploy/diagnose-runtime-grants.sql').read_text()
    assert query(diagnostics, user='wallpapers-admin') == '', 'Safe fixture has diagnostic failures.'
    query('GRANT CREATE ON SCHEMA public TO wallpapers;', user='wallpapers-admin')
    assert 'no_schema_create' in query(diagnostics, user='wallpapers-admin').splitlines()
    query('REVOKE CREATE ON SCHEMA public FROM wallpapers;', user='wallpapers-admin')
    assert query(acl_snapshot) == preserved, 'Runtime or administrator object privileges changed.'
    assert query('SELECT relacl::text FROM pg_class WHERE oid = \'public.keep_rights\'::regclass;', database='axentra_fixture') == other_database
    assert query("SELECT defaclacl::text FROM pg_default_acl WHERE defaclrole = 'axentra_stage_runtime'::regrole;") == other_defaults
    assert query("SELECT has_database_privilege('backup_user', 'wallpapers', 'CONNECT');") == 't'
    assert query("SELECT pg_has_role('wallpapers-admin', 'wallpapers-migrator', 'SET');") == 'f'
    query("BEGIN; INSERT INTO public.audit_log(action,target,actor) VALUES ('permission-test','fixture','admin'); "
          'SELECT count(*) FROM public.collections; ROLLBACK;', user='wallpapers')
    for sql in ['CREATE TABLE public.forbidden(id integer);', 'SELECT version FROM public._sqlx_migrations;',
                'UPDATE public.audit_log SET action=action;', 'DELETE FROM public.audit_log;']:
        query(sql, user='wallpapers', fails=True)
    future_rights = query('BEGIN; CREATE TABLE public.migration_probe(id integer); '
          'CREATE SEQUENCE public.migration_sequence; '
          'CREATE FUNCTION public.migration_function() RETURNS integer LANGUAGE sql AS \'SELECT 1\'; '
          "SELECT NOT has_table_privilege('axentra_migrator', 'public.migration_probe', 'SELECT') "
          "AND NOT has_sequence_privilege('axentra_migrator', 'public.migration_sequence', 'USAGE') "
          "AND NOT has_function_privilege('axentra_stage_runtime', 'public.migration_function()', 'EXECUTE') "
          "AND NOT has_table_privilege('wallpapers', 'public.migration_probe', 'SELECT'); ROLLBACK;",
          user='wallpapers-migrator')
    assert future_rights == 't', 'Future migration objects leaked privileges.'
    repair_defaults = (repository / 'deploy/repair-runtime-defaults.sql').read_text()
    repair_migrator = (repository / 'deploy/repair-runtime-migrator.sql').read_text()
    query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wallpapers; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, UPDATE ON SEQUENCES TO wallpapers; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO wallpapers;', user='wallpapers-admin')
    query('ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wallpapers; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, UPDATE ON SEQUENCES TO wallpapers; '
          'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO wallpapers;', user='wallpapers-backup')
    query('GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log, public._sqlx_migrations TO wallpapers; '
          'GRANT SELECT, UPDATE ON SEQUENCE public.audit_log_id_seq TO wallpapers; '
          'REVOKE USAGE ON SEQUENCE public.audit_log_id_seq FROM wallpapers;', user='wallpapers-migrator')
    reported_failures = {'audit_sequence_usage', 'no_audit_column_mutation', 'no_audit_mutation',
                         'no_audit_sequence_update', 'no_broad_defaults', 'no_migration_history_access',
                         'no_migration_history_column_access', 'no_unknown_relation_access'}
    actual_failures = {line for line in query(diagnostics, user='wallpapers-admin').splitlines() if '|' not in line}
    assert actual_failures == reported_failures, actual_failures
    query(repair_defaults, user='wallpapers-migrator', fails=True)
    query(repair_defaults, user='wallpapers-admin', database='axentra_fixture', fails=True)
    query(repair_migrator, user='wallpapers-admin', fails=True)
    query(repair_migrator, user='wallpapers-migrator', database='axentra_fixture', fails=True)
    query(repair_migrator, user='wallpapers-migrator', fails=True)
    assert query("SELECT has_table_privilege('wallpapers', 'public.audit_log', 'UPDATE') "
                 "AND NOT has_sequence_privilege('wallpapers', 'public.audit_log_id_seq', 'USAGE');") == 't'
    assert query("SELECT pg_has_role('wallpapers-admin', 'wallpapers-backup', 'SET');") == 'f'
    query(repair_defaults, user='wallpapers-backup', database='axentra_fixture', fails=True)
    query(repair_defaults, user='wallpapers-admin')
    query(repair_migrator, user='wallpapers-migrator', fails=True)
    assert query("SELECT has_table_privilege('wallpapers', 'public.audit_log', 'UPDATE') "
                 "AND NOT has_sequence_privilege('wallpapers', 'public.audit_log_id_seq', 'USAGE');") == 't'
    assert query("SELECT EXISTS (SELECT 1 FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) a "
                 "WHERE d.defaclrole='wallpapers-backup'::regrole AND a.grantee='wallpapers'::regrole);") == 't'
    for _ in range(2):
        query(repair_defaults, user='wallpapers-admin')
        query(repair_defaults, user='wallpapers-backup')
        query(repair_migrator, user='wallpapers-migrator')
        assert query(diagnostics, user='wallpapers-admin') == ''
        assert query(verification, user='wallpapers-admin').split('|')[2:] == ['t'] * 8
    assert query(acl_snapshot) == preserved, 'Repair changed the reviewed runtime/admin allowlist.'
    assert query('SELECT relacl::text FROM pg_class WHERE oid = \'public.keep_rights\'::regclass;', database='axentra_fixture') == other_database
    query("BEGIN; INSERT INTO public.audit_log(action,target,actor) VALUES ('repair-test','fixture','admin'); ROLLBACK;",
          user='wallpapers')
    for sql in ['SELECT version FROM public._sqlx_migrations;', 'UPDATE public.audit_log SET action=action;',
                'DELETE FROM public.audit_log;', "SELECT setval('public.audit_log_id_seq', 1);"]:
        query(sql, user='wallpapers', fails=True)
    admin_future = query('BEGIN; CREATE TABLE public.admin_default_probe(id integer); '
                        'CREATE SEQUENCE public.admin_default_sequence; '
                        'CREATE FUNCTION public.admin_default_function() RETURNS integer LANGUAGE sql AS \'SELECT 1\'; '
                        "SELECT NOT has_table_privilege('wallpapers', 'public.admin_default_probe', 'SELECT') "
                        "AND NOT has_sequence_privilege('wallpapers', 'public.admin_default_sequence', 'SELECT,UPDATE') "
                        "AND NOT has_function_privilege('wallpapers', 'public.admin_default_function()', 'EXECUTE'); ROLLBACK;",
                        user='wallpapers-admin')
    assert admin_future == 't', 'Administrator defaults still expose new objects to runtime.'
    print('Runtime repair passed: exact eight reported failures reproduced, wrong actor/database/order rejected, '
          'administrator and backup defaults, full verification before commit, repeat safe, runtime writes work and excess permissions denied.')
    print('PostgreSQL 18 isolation passed: two unprivileged connections, idempotence, actor/database/order guards, '
          'transaction rollback, column grants, runtime and administrator preservation, migrator DDL and other-database isolation.')
finally:
    # Preserve the fixture database; stop only this uniquely named test container.
    subprocess.run(['docker', 'stop', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
