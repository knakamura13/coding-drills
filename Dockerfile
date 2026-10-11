# Built by Railway (see .railway/railway.ts). SvelteKit with adapter-node:
# `pnpm build` writes ./build and `node build/index.js` serves it on $PORT.

FROM node:22-alpine AS build

WORKDIR /app

# corepack reads the pnpm version from the "packageManager" field in package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# Behind Railway's proxy, derive the request origin from the forwarded headers.
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=x-forwarded-host

# Vite bundles every dependency at build time, so the runtime image needs only
# the build output and package.json (for "type": "module").
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./

USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
