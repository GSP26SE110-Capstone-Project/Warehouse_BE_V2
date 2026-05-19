# Smart Warehouse API — Node.js (Express 5) image
# Compose mounts ./src and ./server.js over /app at runtime and runs `npm run dev`,
# so this image only needs Node + installed deps (including nodemon).

FROM node:20-alpine

# Build deps for native modules (e.g. bcrypt). libc6-compat helps prebuilt binaries
# load on Alpine's musl libc.
RUN apk add --no-cache python3 make g++ libc6-compat \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

ENV NODE_ENV=development \
    PORT=3000

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the source. At runtime compose will bind-mount ./src and ./server.js
# on top of this, so local edits hot-reload via nodemon.
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
