# Docker Production Deployment Guide for DrawDB

## Quick Start

### Production Deployment
```bash
# Clone the repository
git clone <repository-url>
cd drawdb

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your production values

# Build and start the application
docker-compose up --build -d

# Access application at http://localhost:3001
```

## Docker Configuration

### Single Production Setup
DrawDB uses a simplified Docker configuration focused on production deployment:
- **Full-stack container**: Single Node.js server serving both frontend and backend
- **Persistent storage**: Volume mapping for data persistence
- **Health monitoring**: Automated health checks
- **Security**: Non-root user, proper resource limits

## File Structure

```
drawdb/
├── Dockerfile              # Production full-stack build
├── compose.yml             # Production docker-compose
├── server/
│   ├── Dockerfile          # Standalone backend (if needed)
│   └── .dockerignore       # Backend build optimization
├── .env.example            # Environment template
└── README-docker.md        # This guide
```

## Environment Configuration

### Required Environment Variables (.env)
```env
# Application Environment
NODE_ENV=production
PORT=3001

# Application URL (change to your domain)
CLIENT_URL=http://localhost:3001

# Session Security (MUST CHANGE IN PRODUCTION)
SESSION_SECRET=your-very-secure-random-session-secret

# Database Connection Limits
DB_CONNECTION_TIMEOUT=30000
DB_MAX_CONNECTIONS=50
```

### Production Example
```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://yourdomain.com
SESSION_SECRET=super-secure-random-key-here-change-me
DB_CONNECTION_TIMEOUT=30000
DB_MAX_CONNECTIONS=100
```

## Deployment Commands

### Basic Commands
```bash
# Start application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop application
docker-compose down

# Rebuild and restart
docker-compose up --build -d

# Check status
docker-compose ps
```

### Maintenance Commands
```bash
# Update application
git pull
docker-compose down
docker-compose up --build -d

# Backup data
docker run --rm -v drawdb_drawdb-storage:/data -v $(pwd):/backup alpine tar czf /backup/drawdb-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore data
docker run --rm -v drawdb_drawdb-storage:/data -v $(pwd):/backup alpine tar xzf /backup/drawdb-backup-YYYYMMDD.tar.gz -C /data

# View container logs
docker logs drawdb-app -f --tail=100
```

## Data Persistence

### Storage Volume
- **Location**: `/app/server/storage` inside container
- **Volume**: `drawdb-storage` (persistent across restarts)
- **Contents**: Gists, user uploads, session data

### Backup Strategy
```bash
# Create backup script (backup.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker run --rm \
  -v drawdb_drawdb-storage:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/drawdb-backup-${DATE}.tar.gz -C /data .
echo "Backup created: drawdb-backup-${DATE}.tar.gz"

# Make executable and run
chmod +x backup.sh
./backup.sh
```

## Monitoring and Health Checks

### Built-in Health Check
- **Endpoint**: `GET /api/health`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts before marking unhealthy

### Monitoring Commands
```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3001/api/health

# Monitor resource usage
docker stats drawdb-app

# Container inspection
docker inspect drawdb-app
```

## Reverse Proxy Setup (Optional)

### Nginx Configuration
```nginx
# /etc/nginx/sites-available/drawdb
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Certbot
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Security Considerations

### Container Security
- ✅ Non-root user (drawdb:nodejs)
- ✅ Resource limits configured
- ✅ Security headers in responses
- ✅ Environment variables for secrets

### Production Security Checklist
- [ ] Change default SESSION_SECRET
- [ ] Use HTTPS in production
- [ ] Configure firewall rules
- [ ] Regular security updates
- [ ] Monitor container logs
- [ ] Backup data regularly

## Performance Optimization

### Resource Limits
```yaml
# Add to compose.yml if needed
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

### Log Management
```yaml
# Already configured in compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs drawdb

# Check disk space
df -h

# Check port conflicts
lsof -i :3001
```

#### Health Check Failing
```bash
# Manual test
curl -f http://localhost:3001/api/health

# Check container status
docker inspect drawdb-app | grep -A 5 '"Health"'

# Restart if needed
docker-compose restart drawdb
```

#### Data Loss Prevention
```bash
# Verify volume exists
docker volume ls | grep drawdb-storage

# Check volume mount
docker inspect drawdb-app | grep -A 5 '"Mounts"'
```

### Debug Mode
```bash
# Run in foreground with logs
docker-compose up

# Access container shell
docker exec -it drawdb-app sh

# Check environment variables
docker exec drawdb-app env | grep -E "(NODE_ENV|CLIENT_URL|SESSION_SECRET)"
```

## Scaling and Load Balancing

### Multiple Instances
```yaml
# Scale to 3 instances
version: '3.8'
services:
  drawdb:
    # ... existing config
    deploy:
      replicas: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - drawdb
```

### Load Balancer Configuration
```nginx
# nginx-lb.conf
upstream drawdb_backend {
    server drawdb-app:3001;
}

server {
    listen 80;
    location / {
        proxy_pass http://drawdb_backend;
        # ... other proxy settings
    }
}
```

## Migration and Updates

### Update Process
```bash
# 1. Backup current data
./backup.sh

# 2. Pull latest changes
git pull

# 3. Stop current containers
docker-compose down

# 4. Rebuild and start
docker-compose up --build -d

# 5. Verify health
curl http://localhost:3001/api/health
```

### Rollback Process
```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-commit-hash>

# Start previous version
docker-compose up --build -d
```

This simplified Docker setup provides a production-ready deployment solution for DrawDB with focus on reliability, security, and ease of maintenance.