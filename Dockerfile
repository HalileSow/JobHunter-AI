FROM node:24-bookworm-slim

WORKDIR /app

COPY automation/package*.json ./automation/
RUN cd automation && npm ci --omit=dev --no-audit

COPY site/package*.json ./site/
RUN cd site && npm ci --omit=dev --no-audit

COPY . .

ENV NODE_ENV=production
ENV PORT=4173
EXPOSE 4173

CMD ["node", "site/server.mjs"]
