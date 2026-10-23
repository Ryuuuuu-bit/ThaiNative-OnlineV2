FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
RUN npm ci --include=dev --ignore-scripts
COPY server/package.json server/package-lock.json ./server/
RUN npm --prefix server ci --include=dev --ignore-scripts
COPY shared/ ./shared/
COPY maps/ ./maps/
COPY scripts/import-maps.mjs scripts/build-web.mjs ./scripts/
COPY meadow-3d/ ./meadow-3d/
COPY server/ ./server/
ARG VITE_BUILD_ID
ARG PUBLIC_SITE_URL
RUN npm run build:shared && npm --prefix server run build && npm run build:web
RUN npm prune --omit=dev --ignore-scripts && npm --prefix server prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/build ./server/build
COPY --from=build /app/server/sql ./server/sql
COPY --from=build /app/meadow-3d/dist ./meadow-3d/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s CMD node -e "fetch('http://127.0.0.1:8787/healthz',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/build/index.js"]
