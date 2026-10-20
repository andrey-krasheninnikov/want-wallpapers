# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 AS media-tools
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

FROM media-tools AS frontend
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
COPY frontend/package.json frontend/package.json
COPY patches ./patches
RUN bun install --frozen-lockfile --ignore-scripts
COPY frontend ./frontend
ARG PUBLIC_FIREBASE_API_KEY
ARG PUBLIC_FIREBASE_PROJECT_ID=want-wallpapers
ARG PUBLIC_FIREBASE_APP_ID
ARG PUBLIC_FIREBASE_MEASUREMENT_ID
ENV PUBLIC_FIREBASE_API_KEY=$PUBLIC_FIREBASE_API_KEY \
    PUBLIC_FIREBASE_PROJECT_ID=$PUBLIC_FIREBASE_PROJECT_ID \
    PUBLIC_FIREBASE_APP_ID=$PUBLIC_FIREBASE_APP_ID \
    PUBLIC_FIREBASE_MEASUREMENT_ID=$PUBLIC_FIREBASE_MEASUREMENT_ID
RUN bun run build

FROM rust:1.93.0-bookworm@sha256:d0a4aa3ca2e1088ac0c81690914a0d810f2eee188197034edf366ed010a2b382 AS backend
WORKDIR /app
ARG VCS_REF="unknown"
ENV RUSTUP_TOOLCHAIN=1.93.0 WALLPAPERS_REVISION=$VCS_REF
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY backend ./backend
COPY deploy/verify-distribution-grants.sql ./deploy/verify-distribution-grants.sql
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/app/target,sharing=locked \
    cargo build --locked --release -p want-wallpapers-server \
    && cp /app/target/release/want-wallpapers-server /app/want-wallpapers-server

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS runtime
ARG VCS_REF="unknown"
LABEL org.opencontainers.image.source="https://github.com/andrey-krasheninnikov/want-wallpapers" \
      org.opencontainers.image.revision=${VCS_REF}
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 wallpapers && useradd --uid 10001 --gid wallpapers --no-create-home wallpapers
WORKDIR /app
COPY --from=backend /app/want-wallpapers-server /usr/local/bin/want-wallpapers-server
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY --from=frontend /app/frontend/runtime-catalog.json /app/frontend/runtime-catalog.json
COPY --from=frontend /app/frontend/runtime-publications.json /app/frontend/runtime-publications.json
USER 10001:10001
ENV APP_ENV=production BIND_ADDR=0.0.0.0:8080 STATIC_DIR=/app/frontend/dist SITE_URL=https://wallpapers.want.foundation
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD curl --fail --silent http://127.0.0.1:8080/health/ready || exit 1
ENTRYPOINT ["want-wallpapers-server"]
CMD ["serve"]
