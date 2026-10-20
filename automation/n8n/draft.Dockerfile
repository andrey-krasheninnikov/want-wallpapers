FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04
WORKDIR /app
COPY package.json bun.lock ./
COPY frontend/package.json frontend/package.json
RUN bun install --frozen-lockfile --ignore-scripts
COPY frontend/scripts frontend/scripts
COPY frontend/src/data frontend/src/data
COPY frontend/src/lib/collection-cover.ts frontend/src/lib/catalog-order.ts frontend/src/lib/
COPY backend/data/taxonomy.json backend/data/taxonomy.json
USER 1000:1000
CMD ["bun", "frontend/scripts/generation-api.ts"]
