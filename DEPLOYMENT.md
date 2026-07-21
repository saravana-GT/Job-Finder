# Deployment Guide

Detailed documentation for container deployment and production orchestrations.

---

## 1. Containerized Setup (Docker)

To deploy the entire environment (database + application), make sure you have Docker and Docker Compose installed.

### Start the stack
Run the compose file from the project root:
```bash
docker-compose up -d --build
```
This command compiles the lightweight multi-stage Dockerfile and deploys the PostgreSQL database container with automatic health check checks.

### Inspect logs
```bash
docker logs -f placement-app
```

---

## 2. Production Hardening checklist

### Environment validation
- Ensure `NODE_ENV` is explicitly set to `production` in container variables.
- Keep `DATABASE_URL` credentials encrypted in vault configurations.

### Port security
- Restrict Postgres port `5432` from public internet access.
- Deploy an Nginx reverse-proxy or Cloudflare Tunnel facing Node port `3000` with SSL/TLS configurations.

### Database backups schedule
Automate the database backup runner using Linux `cron` scripts:
```bash
# Add to crontab - runs database dump daily at 02:00 AM
0 2 * * * cd /app && node scripts/backup-db.js >> /var/log/db_backup.log 2>&1
```

Restore a backup:
```bash
node scripts/restore-db.js backups/db_backup_xxxx.sql
```
