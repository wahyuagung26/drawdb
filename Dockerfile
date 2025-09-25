# Production Full-Stack Dockerfile

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Prepare Backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY server/ .

# Stage 3: Production Runtime
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S drawdb -u 1001

# Copy backend application
COPY --from=backend-build --chown=drawdb:nodejs /app ./server
WORKDIR /app/server

# Copy frontend build to serve as static files
COPY --from=frontend-build --chown=drawdb:nodejs /app/dist ./public

# Create storage directories
RUN mkdir -p storage/gists && chown -R drawdb:nodejs storage

# Switch to non-root user
USER drawdb

# Set environment variables
ENV NODE_ENV=production
ENV CLIENT_URL=http://localhost:3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3001, path: '/api/health', timeout: 2000 }; const req = http.request(options, (res) => { if (res.statusCode === 200) process.exit(0); else process.exit(1); }); req.on('error', () => process.exit(1)); req.end();"

# Start application
CMD ["npm", "start"]
