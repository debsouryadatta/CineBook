FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --audit=false
RUN npx prisma generate

COPY . .
RUN npm run build
RUN npm prune --omit=dev --audit=false

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

EXPOSE 4000

CMD ["npm", "start"]
