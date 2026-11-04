# syntax=docker/dockerfile:1
#
# Image of the Ask gateway. Build from the REPOSITORY ROOT (the build needs the workspace packages,
# the signed packs and the public keys):
#
#   docker build -f apps/api/Dockerfile -t biblioteca-api .
#   docker run --rm -p 8787:8787 -e AI_PROVIDER=mock biblioteca-api
#
# Fly.io: see apps/api/fly.toml and docs/ask-api.md.

# --- Stage 1: install the workspace dependencies of the API and bundle it ---------------------
FROM node:22-alpine AS build
WORKDIR /repo
ENV CI=true
RUN corepack enable

# Manifests first: this layer (the install) is cached until a dependency changes. The package
# manager version comes from "packageManager" in the root package.json.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/content-tools/package.json packages/content-tools/
RUN pnpm install --frozen-lockfile --filter "@biblioteca/api..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/content-tools packages/content-tools
COPY apps/api apps/api
# Type-checks, then bundles src/server.ts (with the shared packages, the SDK and Hono) into dist/.
RUN pnpm --filter @biblioteca/api build

# --- Stage 2: runtime ---------------------------------------------------------------------------
# One JavaScript file, the verified-at-start packs and the public keys. No node_modules, no
# secrets: ANTHROPIC_API_KEY arrives as an environment variable (a Fly secret).
#
# Two settings are left out on purpose:
# - TRUST_PROXY: the image uses the default (`none`, the socket address). Only behind Fly's proxy
#   is the Fly-Client-IP header trustworthy, so apps/api/fly.toml sets TRUST_PROXY=fly; anywhere
#   else (a plain `docker run`, another host) a forged header must not be able to dodge the
#   per-address rate limit.
# - NODE_OPTIONS=--enable-source-maps: it loads the 5 MB map of the bundle and adds 30 to 40 MB of
#   resident memory (about 105 MB idle without it, 135 to 145 MB with it) on a 256 MB machine.
#   dist/server.js.map is shipped, so a readable stack trace is one `NODE_OPTIONS=--enable-source-maps`
#   away when needed.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    LISTEN_HOST=0.0.0.0 \
    AI_PROVIDER=claude \
    PACKS_DIR=/app/packs \
    KEYS_DIR=/app/keys
WORKDIR /app
# Owned by root and only readable for the "node" user the service runs as: a compromised process
# cannot rewrite the code, the packs, or the public keys the packs are verified against. COPY keeps
# the file modes of the build context, so the checkout must have world-readable files (a umask of
# 077 would leave 0600 files that the service user cannot read; packaging.test.ts checks it).
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/mobile/assets/packs ./packs
COPY content/keys/*.pub ./keys/

# The official image ships an unprivileged "node" user.
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/v1/health" || exit 1
CMD ["node", "dist/server.js"]
