FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.js tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate \
    && mkdir -p /data/uploads \
    && ln -sfn /data/uploads /app/public \
    && ln -sfn /data/uploads /public \
    && chown -R node:node /data/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data/uploads"]

USER node

CMD ["sh", "-c", "export DIRECT_URL=\"${DIRECT_URL:-$DATABASE_URL}\"; npx prisma migrate deploy && exec npx tsx ./src/app.ts"]
