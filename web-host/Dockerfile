FROM node:26-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 GAME_RELEASE_ROOT=/srv/releases CURRENT_MANIFEST=/srv/state/current.json
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY web-host ./web-host
COPY web-shell ./web-shell
COPY scripts/web/activate.mjs ./scripts/web/activate.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "web-host/server.mjs"]
