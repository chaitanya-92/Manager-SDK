FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm test && npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node worker/gcp-web.mjs worker/render-web.mjs worker/project-store.mjs worker/hosted-start.mjs worker/circleci.mjs ./worker/
COPY --chown=node:node src/model.mjs ./src/model.mjs
USER node
EXPOSE 8080
CMD ["node","worker/hosted-start.mjs"]
