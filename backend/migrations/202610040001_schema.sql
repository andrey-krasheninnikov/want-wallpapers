CREATE TABLE collections (
    id text PRIMARY KEY,
    folder_number bigint NOT NULL UNIQUE CHECK (folder_number > 0),
    slug text NOT NULL UNIQUE,
    data jsonb NOT NULL,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    archived boolean NOT NULL DEFAULT false
);
CREATE TABLE wallpapers (
    id text PRIMARY KEY,
    collection_id text NOT NULL REFERENCES collections(id),
    number bigint NOT NULL CHECK (number > 0),
    data jsonb NOT NULL,
    version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
    archived boolean NOT NULL DEFAULT false,
    UNIQUE (collection_id, number)
);
CREATE TABLE visitors (id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    role text NOT NULL CHECK (role IN ('visitor', 'admin')),
    visitor_id uuid REFERENCES visitors(id),
    csrf text NOT NULL,
    credential_fingerprint text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CHECK ((role = 'visitor') = (visitor_id IS NOT NULL))
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE admin_totp (credential_fingerprint text PRIMARY KEY, last_step bigint NOT NULL);
CREATE TABLE rate_limits (
    key text PRIMARY KEY,
    attempts integer NOT NULL CHECK (attempts > 0),
    resets_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(resets_at);
CREATE TABLE ratings (
    wallpaper_id text NOT NULL REFERENCES wallpapers(id),
    visitor_id uuid NOT NULL REFERENCES visitors(id),
    value text NOT NULL CHECK (value IN ('cringe', 'minus', 'plus', 'imba')),
    PRIMARY KEY (wallpaper_id, visitor_id)
);
CREATE TABLE comments (
    id uuid PRIMARY KEY,
    wallpaper_id text NOT NULL REFERENCES wallpapers(id),
    visitor_id uuid NOT NULL REFERENCES visitors(id),
    text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now(),
    hidden boolean NOT NULL DEFAULT false,
    version bigint NOT NULL DEFAULT 1
);
CREATE INDEX comments_wallpaper_recent ON comments(wallpaper_id, created_at DESC);
CREATE TABLE comment_authors (
    wallpaper_id text NOT NULL REFERENCES wallpapers(id),
    visitor_id uuid NOT NULL REFERENCES visitors(id),
    last_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (wallpaper_id, visitor_id)
);
CREATE TABLE reports (
    id uuid PRIMARY KEY,
    comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    visitor_id uuid NOT NULL REFERENCES visitors(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1,
    UNIQUE (comment_id, visitor_id)
);
CREATE INDEX reports_status_recent ON reports(status, created_at DESC);
CREATE TABLE feedback (
    id uuid PRIMARY KEY,
    visitor_id uuid NOT NULL REFERENCES visitors(id),
    topic text NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 100),
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    email text NOT NULL CHECK (char_length(email) <= 254),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    version bigint NOT NULL DEFAULT 1,
    CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX feedback_status_recent ON feedback(status, created_at DESC);
CREATE TABLE audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action text NOT NULL,
    target text NOT NULL,
    actor text NOT NULL CHECK (actor IN ('admin', 'catalog-token')),
    created_at timestamptz NOT NULL DEFAULT now()
);
