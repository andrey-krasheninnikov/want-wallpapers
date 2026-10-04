# syntax=docker/dockerfile:1
ARG BUN_IMAGE=oven/bun:1.4.0-slim@sha256:e0ee68d16ccb9927bf02aa7dd8fd4bf3369ee6d46da04faa72b05ce8bfd135f6
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e
FROM ${BUN_IMAGE} AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG PUBLIC_FIREBASE_MEASUREMENT_ID=""
ARG PUBLIC_RECAPTCHA_SITE_KEY=""
ENV PUBLIC_FIREBASE_MEASUREMENT_ID=${PUBLIC_FIREBASE_MEASUREMENT_ID} \
    PUBLIC_RECAPTCHA_SITE_KEY=${PUBLIC_RECAPTCHA_SITE_KEY} \
    PUBLIC_USE_FIREBASE_EMULATORS=false
RUN cp .env.example .env && bun run build

FROM ${NGINX_IMAGE} AS runtime
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]