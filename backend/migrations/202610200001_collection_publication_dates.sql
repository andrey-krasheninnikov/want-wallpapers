ALTER TABLE collections ADD COLUMN published_at timestamptz;

-- Historical dates come from the existing catalogue publication metadata.
CREATE FUNCTION initial_collection_publication(collection_id text) RETURNS timestamptz
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE collection_id
        WHEN '0001-contours-of-silence' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN '0002-woven-spectrum' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN '0003-path-to-the-light' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN '0004-where-stars-graze' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN '0005-a-night-beneath-the-ice' THEN '2026-10-05T04:04:04Z'::timestamptz
        WHEN '0006-neon-tide' THEN '2026-10-19T20:13:10.668531Z'::timestamptz
        ELSE NULL
    END
$$;

UPDATE collections SET published_at = initial_collection_publication(id);
