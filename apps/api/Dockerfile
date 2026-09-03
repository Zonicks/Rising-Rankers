FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-validation/package.json packages/shared-validation/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @learning/shared-types build \
 && pnpm --filter @learning/shared-validation build \
 && pnpm --filter @learning/api db:generate \
 && pnpm --filter @learning/api build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
