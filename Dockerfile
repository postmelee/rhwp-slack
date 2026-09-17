FROM node:24.21.0-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553 AS dependencies
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

FROM dependencies AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY studio/upstream.json ./studio/upstream.json
COPY scripts/prepare-studio.mjs ./scripts/prepare-studio.mjs
RUN npm run prepare:studio
COPY src ./src
COPY studio ./studio
COPY scripts ./scripts
COPY tsconfig*.json vite.config.ts ./
RUN npm run build && npm run build:dev \
    && node_modules/.bin/esbuild src/server/cloud/main.ts --bundle --platform=node --format=cjs '--external:@google-cloud/*' --external:google-auth-library --external:@playwright/test '--external:@rhwp/*' --outfile=dist/cloud/main.cjs

FROM dependencies AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 HOME=/tmp NODE_COMPILE_CACHE=/app/.node-compile-cache NODE_COMPILE_CACHE_PORTABLE=1
COPY --from=build /app/dist/cloud ./dist/cloud
COPY --from=build /app/dist/editor ./dist/editor
COPY --from=build /app/dist/studio ./dist/studio
COPY --from=build /app/.cache/conversion ./.cache/conversion
COPY --from=build /app/.cache/studio-source/rhwp-studio/src/command/print-pages.ts ./.cache/studio-source/rhwp-studio/src/command/print-pages.ts
COPY --from=build /app/.cache/studio-source/rhwp-studio/src/core/generated/font-rule-projections/webfont-supply.ts ./.cache/studio-source/rhwp-studio/src/core/generated/font-rule-projections/webfont-supply.ts
COPY --from=build /app/.cache/studio-source/assets/fonts ./.cache/studio-source/assets/fonts
COPY --from=build /app/src ./src
COPY scripts/healthcheck.mjs scripts/slack-preflight.ts ./scripts/
RUN mkdir -p /app/data /app/.node-compile-cache && chown node:node /app/data /app/.node-compile-cache && chmod 700 /app/data /app/.node-compile-cache
USER node
RUN node dist/cloud/main.cjs --warm-code
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "scripts/healthcheck.mjs"]
CMD ["node", "--import", "tsx", "src/server/main.ts"]

# Same runtime layers, with synthetic fixtures/tests added only to this verification target.
FROM runtime AS smoke
COPY tests ./tests
COPY playwright.config.ts ./playwright.config.ts
COPY scripts/run-tests.mjs scripts/serve-viewer.mjs scripts/container-smoke.mjs ./scripts/
COPY studio/adapters ./studio/adapters
CMD ["node", "scripts/container-smoke.mjs"]

# Default image never contains the smoke fixtures or test ingress.
FROM runtime AS release
