-- Expanded distribution state remains compatible with earlier application images.
CREATE TABLE public.distribution_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    initialized boolean NOT NULL DEFAULT false
);
INSERT INTO public.distribution_state DEFAULT VALUES;
CREATE TABLE public.distribution_batches (
    request_id text PRIMARY KEY CHECK (request_id ~ '^[0-9a-f]{32}$'),
    file_hash text NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),
    receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
    verified_at bigint NOT NULL CHECK (verified_at > 0),
    publication_conflicts jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(publication_conflicts) = 'array'),
    ingested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.distribution_publications (
    collection_id text PRIMARY KEY,
    package_hash text CHECK (package_hash ~ '^[0-9a-f]{64}$'),
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    receipt jsonb NOT NULL CHECK (jsonb_typeof(receipt) = 'object'),
    baseline boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.distribution_deliveries (
    collection_id text NOT NULL REFERENCES public.distribution_publications(collection_id),
    destination text NOT NULL CHECK (destination IN ('telegram', 'pinterest', 'tumblr', 'deviantart', 'flickr')),
    item text NOT NULL CHECK (item ~ '^[a-z0-9-]{1,40}$'),
    payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    state text NOT NULL CHECK (state IN ('pending', 'in-flight', 'delivered', 'retryable', 'unknown', 'blocked')),
    generation bigint NOT NULL DEFAULT 0 CHECK (generation >= 0),
    claim_id uuid,
    claimed_at timestamptz,
    next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    progress jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(progress) = 'object'),
    remote_receipt jsonb,
    selected_at timestamptz,
    resolved_at timestamptz,
    error_code text CHECK (error_code ~ '^[a-z0-9-]{1,80}$'),
    PRIMARY KEY (collection_id, destination, item),
    CHECK ((state = 'in-flight' AND claim_id IS NOT NULL AND claimed_at IS NOT NULL)
        OR (state <> 'in-flight' AND claim_id IS NULL AND claimed_at IS NULL)),
    CHECK (state <> 'delivered' OR (remote_receipt IS NOT NULL AND jsonb_typeof(remote_receipt) = 'object'))
);
CREATE INDEX distribution_due ON public.distribution_deliveries (next_attempt_at, collection_id, destination, item)
    WHERE state IN ('pending', 'retryable');
CREATE TABLE public.distribution_attempts (
    claim_id uuid PRIMARY KEY,
    collection_id text NOT NULL,
    destination text NOT NULL,
    item text NOT NULL,
    generation bigint NOT NULL CHECK (generation > 0),
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    finished_at timestamptz,
    outcome text NOT NULL CHECK (outcome IN ('in-flight', 'delivered', 'pending', 'retryable', 'unknown', 'blocked')),
    error_code text,
    remote_receipt jsonb,
    FOREIGN KEY (collection_id, destination, item) REFERENCES public.distribution_deliveries(collection_id, destination, item),
    UNIQUE (collection_id, destination, item, generation)
);
CREATE FUNCTION public.keep_distribution_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.collection_id IS DISTINCT FROM OLD.collection_id
       OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
       OR NEW.payload IS DISTINCT FROM OLD.payload THEN
        RAISE EXCEPTION 'distribution identity is immutable';
    END IF;
    IF TG_TABLE_NAME = 'distribution_publications' THEN
        IF NEW.package_hash IS DISTINCT FROM OLD.package_hash OR NEW.receipt IS DISTINCT FROM OLD.receipt
           OR NEW.baseline IS DISTINCT FROM OLD.baseline OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'publication evidence is immutable';
        END IF;
    ELSE
        IF NEW.destination IS DISTINCT FROM OLD.destination OR NEW.item IS DISTINCT FROM OLD.item THEN
            RAISE EXCEPTION 'delivery identity is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_distribution_identity() FROM PUBLIC;
CREATE TRIGGER distribution_publication_identity BEFORE UPDATE ON public.distribution_publications
    FOR EACH ROW EXECUTE FUNCTION public.keep_distribution_identity();
CREATE TRIGGER distribution_delivery_identity BEFORE UPDATE ON public.distribution_deliveries
    FOR EACH ROW EXECUTE FUNCTION public.keep_distribution_identity();

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'wallpapers-backup') THEN
        GRANT SELECT ON public.distribution_state, public.distribution_batches, public.distribution_publications,
            public.distribution_deliveries, public.distribution_attempts TO "wallpapers-backup";
    END IF;
END $$;
