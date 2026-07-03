# clusterscape: one container = static site + live bridge (SSE).
# The bridge shells out to kubectl (in-cluster ServiceAccount) and queries
# Prometheus via PROM_URL. amd64-only (CI builds on the a2 dind runner).

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.35.0/bin/linux/amd64/kubectl" \
  && chmod +x /usr/local/bin/kubectl
WORKDIR /app
COPY --from=build /app/out ./out
COPY bridge ./bridge
COPY scripts/snapshot.mjs ./scripts/snapshot.mjs
COPY public/data ./public/data
COPY public/logos ./public/logos

ENV PORT=8080 SERVE_STATIC=/app/out INTERVAL_MS=20000
EXPOSE 8080
CMD ["node", "bridge/server.mjs"]
