# Stage 1: Build the React/Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Accept build-time args for Vite (Google OAuth client ID)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY ["Handbook Policy App/package*.json", "./"]
RUN npm install

COPY ["Handbook Policy App/", "./"]
RUN npm run build

# Stage 2: Build the Express/Node Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY ["server/package*.json", "./"]
RUN npm install --omit=dev

COPY ["server/", "./"]

# Stage 3: Final Production Image
FROM node:20-alpine
WORKDIR /app

# Copy the built frontend exactly where server.js expects it: '../Handbook Policy App/dist'
COPY --from=frontend-builder ["/app/frontend/dist", "/app/Handbook Policy App/dist"]

# Copy the server codebase
COPY --from=backend-builder ["/app/server", "/app/server"]

# Ensure the data/uploads directory exists (for file uploads)
RUN mkdir -p /app/server/data/uploads

WORKDIR /app/server

# Expose standard Railway port binding variable
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Start server (migrations run automatically on startup via server.js)
CMD ["node", "server.js"]
