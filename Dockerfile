# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# One backend image runs API, migrations, ingestion, and email as separate processes.
# Prisma CLI dependencies stay installed so migration jobs use the exact same release.
FROM build AS backend
ENV NODE_ENV=production
WORKDIR /app/backend
RUN mkdir -p data && chown node:node data
USER node
CMD ["node", "dist/main.js"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
