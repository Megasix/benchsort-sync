# BenchSort Sync for servers: docker run with the configuration and the state mounted.
FROM node:24.10-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npx esbuild src/cli.ts --bundle --platform=node --format=cjs --target=node24 --external:pg-native --outfile=build/benchsort-sync.cjs

FROM node:24.10-alpine
WORKDIR /data
COPY --from=build /app/build/benchsort-sync.cjs /app/benchsort-sync.cjs
USER node
ENTRYPOINT ["node", "/app/benchsort-sync.cjs"]
CMD ["run"]
