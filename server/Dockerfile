FROM node:20-alpine AS base
WORKDIR /app

# Prisma's query engine binary is dynamically linked against OpenSSL, which
# Alpine's base image doesn't ship — without this, `prisma generate` picks
# the wrong engine target and/or the engine fails to load libssl at runtime.
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY package.json ./

RUN mkdir -p /app/uploads/photos

EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npx tsx prisma/seed.ts && node dist/index.js"]
