# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./
RUN npm run build

# Stage 2: Run
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY apps/api/package*.json ./
RUN npm install --omit=dev
EXPOSE 4001
CMD ["node", "dist/server.js"]
