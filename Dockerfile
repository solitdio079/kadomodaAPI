FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Prisma and tsx are needed at runtime, even though listed as devDependencies.
RUN npm ci --include=dev && npm cache clean --force

COPY prisma.config.js tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN ./node_modules/.bin/prisma generate \
    && mkdir -p /data/uploads \
    && ln -sfn /data/uploads /app/public \
    && ln -sfn /data/uploads /public \
    && chown -R node:node /data/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data/uploads"]

USER node

# Supply secrets at runtime; DIRECT_URL can override the migration connection.
CMD ["sh", "-ec", ": \"${DATABASE_URL:?DATABASE_URL is required}\"; : \"${SECRET_KEY:?SECRET_KEY is required}\"; : \"${BREVO_API_KEY:?BREVO_API_KEY is required}\"; export DIRECT_URL=\"${DIRECT_URL:-$DATABASE_URL}\"; ./node_modules/.bin/prisma migrate deploy; exec ./node_modules/.bin/tsx ./src/app.ts"]
