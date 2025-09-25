# DrawDB Docker Production Setup

This guide covers running DrawDB in production using Docker.

## Prerequisites

- Docker
- Docker Compose
- Node.js 20+ (for building frontend)

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   git clone https://github.com/drawdb-io/drawdb.git
   cd drawdb
   ```

2. **Install dependencies and build frontend:**
   ```bash
   npm install
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   # Edit .env file with your production settings
   ```

4. **Build and run Docker containers:**
   ```bash
   docker-compose up -d
   ```

DrawDB will be available at http://localhost:3001

## Build Process

The production Docker setup uses a **build-then-containerize** approach for memory efficiency:

1. **Frontend is built locally** to avoid memory issues during Docker build
2. **Only the built `dist/` folder** is copied to the container
3. **Backend dependencies** are installed and native modules rebuilt for Alpine Linux

This approach solves memory allocation issues that can occur during Docker builds.

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
CLIENT_URL=http://localhost:3001
SESSION_SECRET=your-secret-key-change-me
DB_CONNECTION_TIMEOUT=30000
DB_MAX_CONNECTIONS=50
```

### Docker Compose

The `compose.yml` file contains production-optimized settings:
- Memory limits and reservations (2GB reserved, 4GB limit)
- Health checks with proper timeouts
- Automatic restarts
- Persistent storage volume
- Logging with rotation

## Production Deployment

1. **Set secure session secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Configure CLIENT_URL:**
   ```env
   CLIENT_URL=https://yourdomain.com
   ```

3. **Build frontend locally:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

4. **Deploy with Docker:**
   ```bash
   docker-compose up -d
   ```

## Architecture

The Docker setup consists of:
- **Multi-stage build** for optimal image size
- **Alpine Linux** base for security and size
- **Non-root user** for security
- **Native module rebuilding** for compatibility
- **Health checks** for monitoring
- **Resource limits** for stability

## Monitoring

- Health check endpoint: `/api/health`
- Container logs: `docker-compose logs drawdb`
- Resource usage: `docker stats`
- Health status: Built-in Docker health checks

## Storage

- Database files stored in `drawdb-storage` Docker volume
- Persistent across container restarts
- Located at `/app/server/storage` inside container
- Backup the volume for data safety:
  ```bash
  docker run --rm -v drawdb-storage:/source -v $(pwd):/backup alpine tar czf /backup/drawdb-backup.tar.gz -C /source .
  ```

## Security Features

- **Non-root user** (drawdb:nodejs) with UID 1001
- **Minimal container surface** using Alpine Linux
- **No unnecessary ports** exposed
- **Production-grade Node.js** settings
- **Memory limits** to prevent resource exhaustion
- **Health checks** for monitoring

## Troubleshooting

### Memory Issues During Build
If you encounter memory issues during local build:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=8192" npm run build
```

### Container Issues

1. **Check container status:**
   ```bash
   docker-compose ps
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f drawdb
   ```

3. **Check health status:**
   ```bash
   docker inspect drawdb-app | grep Health -A 10
   ```

4. **Restart services:**
   ```bash
   docker-compose restart
   ```

5. **Clean rebuild:**
   ```bash
   docker-compose down
   npm run build  # Rebuild frontend first
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Native Module Issues
If you see "Exec format error" for sqlite3:
```bash
# The Dockerfile automatically rebuilds native modules
# If issues persist, try clearing node_modules in server/
rm -rf server/node_modules
docker-compose build --no-cache
```

## Performance Optimization

- Frontend chunking reduces initial load time
- Build-time optimizations reduce container memory usage
- Resource limits prevent system overload
- Health checks ensure service availability