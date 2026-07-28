# Build stage
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies if needed (e.g., for bcrypt)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY automation/package*.json ./automation/
COPY site/package*.json ./site/
RUN npm ci --include=dev

COPY . .
RUN cd automation && npm install
RUN cd site && npm install

# Final stage
FROM node:24-bookworm-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/automation/ ./automation/
COPY --from=builder /app/site/ ./site/
COPY --from=builder /app/knexfile.cjs ./
COPY --from=builder /app/database/ ./database/
COPY --from=builder /app/config/ ./config/
COPY --from=builder /app/cv/ ./cv/
COPY --from=builder /app/cover_letters/ ./cover_letters/

ENV NODE_ENV=production
ENV PORT=4173
EXPOSE 4173

CMD ["node", "site/server.mjs"]
