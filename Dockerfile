# Stage 1: Build the React/Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY ["Handbook Policy App/package*.json", "./"]
RUN npm install

COPY ["Handbook Policy App/", "./"]
RUN npm run build

# Stage 2: Build the Express/Node Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

# Install dependencies (better-sqlite3 requires python/make usually, but alpine node might need it if binary isn't pre-built for alpine)
RUN apk add --no-cache python3 make g++ 

COPY ["server/package*.json", "./"]
RUN npm install --omit=dev

COPY ["server/", "./"]

# Stage 3: Final Production Image
FROM node:20-alpine
WORKDIR /app

# SQLite binary dependencies
RUN apk add --no-cache python3 make g++

# Copy the built frontend exactly where server.js expects it: '../Handbook Policy App/dist'
COPY --from=frontend-builder ["/app/frontend/dist", "/app/Handbook Policy App/dist"]

# Copy the server codebase
COPY --from=backend-builder ["/app/server", "/app/server"]

# Ensure the database data directory exists and has proper permissions
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data

# Switch to the non-root node user for security
USER node

WORKDIR /app/server

# Expose standard Railway port binding variable
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Automatically initialize database and start server
CMD ["sh", "-c", "npm run init-db && npm start"]
