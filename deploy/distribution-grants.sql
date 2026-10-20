-- Run as wallpapers-migrator after the distribution migration. No default grants.
\set ON_ERROR_STOP on
DO $$ BEGIN
IF to_regclass('public.distribution_state') IS NOT NULL
   AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='wallpapers-distributor') THEN
GRANT SELECT ON public.distribution_state, public.distribution_batches, public.distribution_publications,
    public.distribution_deliveries, public.distribution_attempts TO "wallpapers-distributor";
GRANT INSERT ON public.distribution_batches, public.distribution_publications,
    public.distribution_deliveries, public.distribution_attempts TO "wallpapers-distributor";
GRANT UPDATE ON public.distribution_state, public.distribution_deliveries, public.distribution_attempts TO "wallpapers-distributor";
END IF;
END $$;
