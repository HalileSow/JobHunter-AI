# Build stage
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Native modules used by sqlite3/bcrypt need build tooling and SQLite headers.
RUN apt-get update && apt-get install -y python3 make g++ pkg-config libsqlite3-dev && rm -rf /var/lib/apt/lists/*

# Force native modules to compile against the image runtime instead of relying on prebuilt binaries.
ENV npm_config_build_from_source=true

COPY package*.json ./
COPY automation/package*.json ./automation/
COPY site/package*.json ./site/

# Install each workspace separately so the final image can run without rebuilding.
RUN npm ci --include=dev

COPY . .

# Final stage
FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/knexfile.cjs ./
COPY --from=builder /app/database/ ./database/
COPY --from=builder /app/config/ ./config/
COPY --from=builder /app/cv/ ./cv/
COPY --from=builder /app/cover_letters/ ./cover_letters/
COPY --from=builder /app/automation/ ./automation/
COPY --from=builder /app/site/ ./site/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/automation/node_modules/ ./automation/node_modules/
COPY --from=builder /app/site/node_modules/ ./site/node_modules/

# Install the Chromium browser used by Playwright.
RUN cd automation && npx playwright install --with-deps chromium

EXPOSE 10000

CMD ["node", "site/server.mjs"]
