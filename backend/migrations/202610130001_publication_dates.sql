ALTER TABLE wallpapers ADD COLUMN published_at timestamptz;

-- Historical dates are the first public catalogue releases containing these IDs.
CREATE FUNCTION initial_wallpaper_publication(wallpaper_id text) RETURNS timestamptz
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE wallpaper_id
        WHEN 'contours-of-silence-1' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-2' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-3' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-4' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-5' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-6' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-7' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-8' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-9' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-10' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-11' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-12' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-13' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-14' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'contours-of-silence-15' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'woven-spectrum-1' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'woven-spectrum-2' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'woven-spectrum-3' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'woven-spectrum-4' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'woven-spectrum-5' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'path-to-the-light-1' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'path-to-the-light-2' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'path-to-the-light-3' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'path-to-the-light-4' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'path-to-the-light-5' THEN '2026-10-02T21:44:58Z'::timestamptz
        WHEN 'where-stars-graze-1' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN 'where-stars-graze-2' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN 'where-stars-graze-3' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN 'where-stars-graze-4' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN 'where-stars-graze-5' THEN '2026-10-05T00:42:54Z'::timestamptz
        WHEN 'a-night-beneath-the-ice-1' THEN '2026-10-05T04:04:04Z'::timestamptz
        WHEN 'a-night-beneath-the-ice-2' THEN '2026-10-05T04:04:04Z'::timestamptz
        WHEN 'a-night-beneath-the-ice-3' THEN '2026-10-05T04:04:04Z'::timestamptz
        WHEN 'a-night-beneath-the-ice-4' THEN '2026-10-05T04:04:04Z'::timestamptz
        WHEN 'a-night-beneath-the-ice-5' THEN '2026-10-05T04:04:04Z'::timestamptz
        ELSE NULL
    END
$$;

UPDATE wallpapers SET published_at = initial_wallpaper_publication(id);
