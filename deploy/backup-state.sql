-- Stable metadata for restoration and conservative application rollback checks.
SET LOCAL search_path = pg_catalog;
WITH metadata AS (
 SELECT jsonb_build_object(
  'namespaces', (SELECT jsonb_agg(nspname ORDER BY nspname) FROM pg_namespace
                 WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'),
  'relations', (SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity)
                  ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
  'columns', (SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,
                 format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,
                 coll.collname,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
              FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
              LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
              LEFT JOIN pg_collation coll ON coll.oid=a.attcollation
              WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_array(c.conrelid::regclass::text,c.conname,
                     pg_get_constraintdef(c.oid,true)) ORDER BY c.conrelid::regclass::text COLLATE "C",c.conname)
                  FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
  'indexes', (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text COLLATE "C")
              FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace),
  'views', (SELECT jsonb_agg(jsonb_build_array(c.relname,pg_get_viewdef(c.oid,true)) ORDER BY c.relname)
            FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('v','m')),
  'functions', (SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),
                  p.prokind,p.provolatile,p.prosecdef,p.prosrc,p.probin,p.proconfig,format_type(p.prorettype,NULL),
                  CASE WHEN p.prokind <> 'a' THEN pg_get_functiondef(p.oid) ELSE NULL END)
                  ORDER BY p.proname,pg_get_function_identity_arguments(p.oid) COLLATE "C")
                FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
  'triggers', (SELECT jsonb_agg(pg_get_triggerdef(t.oid,true) ORDER BY c.relname,t.tgname)
               FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
               WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
  'policies', (SELECT jsonb_agg(jsonb_build_array(c.relname,p.polname,p.polcmd,p.polpermissive,
                   pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))
                   ORDER BY c.relname,p.polname) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
               WHERE c.relnamespace='public'::regnamespace),
  'enums', (SELECT jsonb_agg(jsonb_build_array(t.typname,e.enumlabel,e.enumsortorder)
                  ORDER BY t.typname,e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
            WHERE t.typnamespace='public'::regnamespace)
 ) AS value
), catalog AS (
 SELECT jsonb_build_object(
  'collections',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id COLLATE "C") FROM public.collections c),
  'wallpapers',(SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id COLLATE "C") FROM public.wallpapers w)) AS value
)
SELECT jsonb_build_object(
 'schema',encode(sha256(convert_to(metadata.value::text,'UTF8')),'hex'),
 'catalog',encode(sha256(convert_to(catalog.value::text,'UTF8')),'hex'),
 'history',(SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,
              'checksum',encode(checksum,'hex'),'success',success) ORDER BY version),'[]'::jsonb)
             FROM public._sqlx_migrations)
) FROM metadata,catalog;
