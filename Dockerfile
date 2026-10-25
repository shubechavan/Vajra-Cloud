# Vajra Cloud — single container: backend API + dashboard + worker pool
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=7860 \
    AUTO_ENABLE_SCALING=true

WORKDIR /app

# Install dependencies first so they cache between builds
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --omit=dev \
 && npm --prefix backend ci --omit=dev \
 && npm --prefix frontend install --include=dev

# Build the dashboard, then drop frontend dev dependencies
COPY . .
RUN npm --prefix frontend run build \
 && rm -rf frontend/node_modules \
 && mkdir -p backend/data \
 && chown -R node:node /app

# Hugging Face Spaces runs containers as uid 1000 (the "node" user)
USER node

EXPOSE 7860
CMD ["node", "backend/src/server.js"]
