# API, pagina y Swagger en un puerto. Necesita DATABASE_URL

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci
COPY . .
RUN npm run build:demo

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci --omit=dev -w api && npm cache clean --force
COPY --from=build /app/api/dist api/dist
COPY --from=build /app/web/out web/out
ENV WEB_DIR=/app/web/out PORT=3001
USER node
EXPOSE 3001
CMD ["node", "api/dist/main.js"]
