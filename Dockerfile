# Production Dockerfile - Optimized for Memory

# Stage 1: Prepare Backend
FROM node:20-alpine AS backend-build
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force
COPY server/ .

# Rebuild native modules for Alpine Linux
RUN npm rebuild

# Stage 2: Production Runtime
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S drawdb -u 1001

# Copy backend application
COPY --from=backend-build --chown=drawdb:nodejs /app ./server
WORKDIR /app/server

# Copy pre-built frontend files to the correct location
COPY --chown=drawdb:nodejs dist ../dist

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
