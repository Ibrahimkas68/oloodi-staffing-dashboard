# Application image. Build context is the repository root (see docker-compose.yml).
# Three stages: build everything, install production dependencies only, then assemble a small
# runtime image that contains compiled JavaScript and nothing else.

# --- Stage 1: build -------------------------------------------------------------------------------
# Full install (dev dependencies included) and a build of shared, web and server.
# The web build also type checks web/tests, so tests must be in the context.
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first: this layer is reused until a dependency changes.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.base.json ./
COPY shared shared
COPY server server
COPY web web
RUN npm run build

# --- Stage 2: production dependencies -------------------------------------------------------------
# Only what the server needs at run time. All four manifests are copied because npm checks the
# lockfile against every workspace listed in the root package.json, even when one is selected.
# --ignore-scripts: no dependency needs an install script at run time (pg is pure JavaScript).
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev -w @staffing/server --ignore-scripts

# --- Stage 3: runtime -----------------------------------------------------------------------------
# No sources, tests, specs or .env. Runs as the unprivileged "node" user that the base image ships.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# node_modules holds a symlink node_modules/@staffing/shared -> ../../shared, so shared must sit at
# /app/shared. Its package.json says where the compiled entry point is.
COPY --chown=node:node --from=prod-deps /app/node_modules node_modules
COPY --chown=node:node --from=prod-deps /app/package.json package.json
COPY --chown=node:node --from=prod-deps /app/shared/package.json shared/package.json
COPY --chown=node:node --from=prod-deps /app/server/package.json server/package.json
COPY --chown=node:node --from=build /app/shared/dist shared/dist
COPY --chown=node:node --from=build /app/server/dist server/dist
COPY --chown=node:node --from=build /app/web/dist web/dist
# Applied on first start when the database is empty (schema, roles, seed).
COPY --chown=node:node server/db server/db

USER node
EXPOSE 3000

# busybox wget is part of the base image, so no curl is needed. The port follows PORT.
# start-period and start-interval let a first start (schema and seed) finish without failed checks.
HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=30s --start-interval=2s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

CMD ["node", "server/dist/index.js"]
