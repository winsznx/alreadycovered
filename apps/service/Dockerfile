FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/service/package.json apps/service/package.json
RUN pnpm install --frozen-lockfile --filter @alreadycovered/shared --filter @alreadycovered/service

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/service apps/service
RUN pnpm --filter @alreadycovered/shared build
RUN pnpm --filter @alreadycovered/service build

FROM node:22-bookworm-slim AS runtime
# Playwright's Chromium needs these system libraries to run headless on Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json /repo/pnpm-lock.yaml ./
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/apps/service/package.json apps/service/package.json
RUN pnpm install --frozen-lockfile --prod --filter @alreadycovered/shared --filter @alreadycovered/service

COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/service/dist apps/service/dist
COPY --from=build /repo/apps/service/migrations apps/service/migrations

RUN npx playwright install chromium

ENV NODE_ENV=production
EXPOSE 4173
CMD ["node", "apps/service/dist/index.js"]
