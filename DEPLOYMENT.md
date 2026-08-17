# Production Deployment Guide

## Overview
- **Single entry point**: Nginx gateway on port 9990
- **Internal communication**: Docker network (no exposed backend/frontend/db ports)
- **Database**: PostgreSQL in container (no exposed port)
- **Frontend**: Built static assets served via Node.js
- **Backend**: FastAPI running in container

## Setup

### 1. Update Environment Variables
```bash
cp .env.prod .env.prod.local
# Edit .env.prod.local with your production values:
# - POSTGRES_PASSWORD
# - JWT_SECRET
# - Domain/SSL certificates if using HTTPS
```

### 2. SSL Certificates (Optional)
For HTTPS support:
```bash
mkdir ssl
# Copy your SSL certificates:
# - ssl/cert.pem (certificate)
# - ssl/key.pem (private key)
```

### 3. Build & Deploy
```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

## Architecture

```
Client (Internet)
    ↓
Nginx Gateway (Port 80/443)
    ├─→ /api/* → Backend (FastAPI)
    └─→ /* → Frontend (Static + Node.js)
        ↓
    Backend ↔ Database (PostgreSQL)
```

## Network
- All services communicate via Docker internal network `vocabflash`
- Only Nginx exposes ports to host machine
- Database and backend are isolated from external access

## Monitoring

### Check Service Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs nginx
```

### Health Checks
- Backend: http://localhost:9990/api/health
- Frontend: http://localhost:9990/

## Maintenance

### Database Backup
```bash
docker-compose -f docker-compose.prod.yml exec db pg_dump -U vocabflash vocabflash > backup.sql
```

### Database Restore
```bash
docker-compose -f docker-compose.prod.yml exec -T db psql -U vocabflash vocabflash < backup.sql
```

### Restart Services
```bash
# Single service
docker-compose -f docker-compose.prod.yml restart backend

# All services
docker-compose -f docker-compose.prod.yml restart
```

## Performance Tips

1. **Frontend Caching**: Nginx caches static assets (JS, CSS)
2. **Gzip Compression**: Enabled for text-based responses
3. **Database Connection Pool**: Configured in FastAPI
4. **Resource Limits**: Set appropriate CPU/memory limits in production

## Security

1. ✅ Change JWT_SECRET before deployment
2. ✅ Change POSTGRES_PASSWORD before deployment
3. ✅ Enable HTTPS with SSL certificates
4. ✅ Setup firewall rules to only allow port 80/443
5. ✅ Use environment variables for sensitive data
6. ✅ Keep Docker images updated

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Port already in use
```bash
# Change port in docker-compose.prod.yml:
# ports: "8080:80" (map to different host port)
```

### Database connection issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec db pg_isready -U vocabflash -d vocabflash

# View database logs
docker-compose -f docker-compose.prod.yml logs db
```

## Files
- `docker-compose.prod.yml` - Production compose file
- `.env.prod` - Environment variables template
- `nginx.conf` - Nginx configuration
- `frontend/Dockerfile.prod` - Production frontend build
- `backend/Dockerfile` - Backend production ready
