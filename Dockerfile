FROM node:20-bookworm-slim AS build

WORKDIR /usr/src/app

ENV NODE_OPTIONS="--max-old-space-size=4096"

# npm ci usa package-lock.json (rápido y determinista).
# El mount de caché evita re-descargar los paquetes en cada build.
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx nest build --path tsconfig.build.json

FROM node:20-bookworm-slim AS production

ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/usr/src/app/.cache/puppeteer

WORKDIR /usr/src/app

# Puppeteer downloads Chrome during dependency installation. These libraries
# are required by Chrome when PDFs are generated in the production container.
# El mount de caché apt reutiliza los .deb descargados entre builds.
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /root/.cache/puppeteer ./.cache/puppeteer
COPY --from=build /usr/src/app/dist ./dist
COPY scripts ./scripts
COPY tsconfig.json ./tsconfig.json
COPY nest-cli.json ./nest-cli.json

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nestjs \
    && mkdir -p backups \
    && chown -R nestjs:nodejs /usr/src/app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/agencias/v1/api-docs-json', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]