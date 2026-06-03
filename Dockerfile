# Smart Warehouse API — Node.js (Express 5)
# On start: wait for Postgres → migrate → seed:all → CMD (default: npm run dev)

FROM node:20-alpine

# Build deps for native modules (e.g. bcrypt). postgresql-client for pg_isready in entrypoint.
RUN apk add --no-cache python3 make g++ libc6-compat postgresql-client \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=development \
    PORT=3000 \
    RUN_DB_MIGRATE=1 \
    RUN_DB_SEED=1

COPY package*.json ./
RUN npm install

# App source + SQL migrations (db:migrate:all — gồm contract_appendices*.sql, payos, billing, …)
COPY server.js ./
COPY src ./src
COPY scripts ./scripts

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
