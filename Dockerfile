# syntax=docker/dockerfile:1

# The cloud half of the deployment — see docs/deploy-cloud.md.
#
# The LAN half never touches this file: it builds with
# scripts/build-standalone.sh and runs the same standalone server straight on
# the host. Two deployments of one codebase, neither needing the other.

FROM node:22-slim AS deps
WORKDIR /app
# Exactly the lockfile, the same way CI and the LAN host install it.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build context has no .git (see .dockerignore), so the commit comes in as
# an argument and next.config.mjs falls back to it for the build stamp.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run routes traffic to $PORT and expects the server on every interface.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 8080
CMD ["node", "server.js"]
