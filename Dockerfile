# node:sqlite is built into Node, so the image has no native modules to compile.
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim
LABEL org.opencontainers.image.title="planificator-nunta" \
      org.opencontainers.image.description="Planificator de nuntă self-hosted: invitați, confirmări online, mese, buget, sarcini" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/teodorio95-portofolio/planificator-nunta"
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/nunta.db \
    BODY_SIZE_LIMIT=12M
# adapter-node bundles the dependencies into build/: there is no node_modules at runtime.
COPY --from=build /app/build ./build
COPY package.json db-snapshot.mjs ./
# Owned by `node` in the image, so a named volume mounted here starts out writable by it too.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "build"]
