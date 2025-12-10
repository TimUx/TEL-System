# TEL-System Deployment Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM
- 5GB free disk space

## Production Deployment

### 1. Environment Configuration

Create a `.env` file in the project root:

```env
# Database Configuration
POSTGRES_DB=tel_system
POSTGRES_USER=tel_user
POSTGRES_PASSWORD=<strong-password-here>

# Flask Configuration
SECRET_KEY=<generate-strong-secret-key>
FLASK_ENV=production

# API Configuration
API_KEY=<generate-strong-api-key>
```

### 2. Generate Secure Keys

```bash
# Generate SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"

# Generate API_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Start the Application

```bash
# Build and start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Initial Setup

1. Access the application at `http://your-server:8080`
2. Create your first operation
3. Add locations (fire stations)
4. Add vehicles
5. Start managing assignments

## Security Considerations

### Database Security
- Change default PostgreSQL credentials
- Use strong passwords (min 16 characters)
- Restrict database access to backend only

### API Security
- Change default API_KEY immediately
- Use HTTPS in production (add reverse proxy)
- Rotate API keys regularly

### Network Security
- Use firewall rules to restrict access
- Consider VPN for internal use
- Enable HTTPS with Let's Encrypt or similar

## Backup Strategy

### Database Backup

```bash
# Manual backup
docker compose exec db pg_dump -U tel_user tel_system > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T db psql -U tel_user tel_system < backup_20251210.sql
```

### Automated Backups

Add to crontab:
```cron
0 2 * * * cd /path/to/TEL-System && docker compose exec -T db pg_dump -U tel_user tel_system | gzip > /backups/tel-system_$(date +\%Y\%m\%d).sql.gz
```

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:5000/api/external/health

# Check active operation
curl http://localhost:5000/api/operations/active
```

### Docker Logs

```bash
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs frontend
docker compose logs db

# Follow logs
docker compose logs -f backend
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Rebuild container
docker compose up -d --build <service-name>
```

### Database Connection Issues

```bash
# Check database status
docker compose exec db pg_isready -U tel_user

# Connect to database
docker compose exec db psql -U tel_user -d tel_system
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker compose down -v

# Start fresh
docker compose up -d
```

## Upgrading

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build

# Database migrations (if needed)
# Add migration commands here when available
```

## Performance Tuning

### PostgreSQL Optimization

Edit `docker-compose.yml` to add PostgreSQL parameters:

```yaml
db:
  environment:
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
    POSTGRES_MAX_CONNECTIONS: 100
```

### Nginx Optimization

For high traffic, consider:
- Enabling gzip compression
- Adding caching headers
- Using CDN for static files

## Support

For issues and questions:
- GitHub Issues: https://github.com/TimUx/TEL-System/issues
- Documentation: See README.md

## License

See LICENSE file in repository.
