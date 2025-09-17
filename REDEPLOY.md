# Redeployment Guide

Quick reference for redeploying VentiAPI Scanner after making changes.

## 🚀 Railway Cloud (Production)

### Code Changes
```bash
# Redeploy with latest code
railway up

# Monitor deployment
railway logs
```

### Environment Variables

#### Using .env.deploy (Recommended)
```bash
# Edit environment file
nano .env.deploy

# Redeploy with updated environment
./start-railway.sh
```

#### Manual Variable Updates
```bash
# Update variables directly
railway variables --set "VARIABLE_NAME=new_value"

# Redeploy to apply changes
railway up
```

### Force Rebuild
```bash
# Clear cache and rebuild
railway up --detach
```

## 🏠 Local Development

### Quick Restart
```bash
# Stop and restart with latest changes
./start-dev.sh
```

### Manual Restart
```bash
# Stop services
docker compose down

# Rebuild and start
docker compose up --build -d
```

## 🏭 Production Deployment

### Using .env.deploy
```bash
# Redeploy with production settings
./start-production.sh
```

### Environment Changes
```bash
# Edit production environment
nano .env.deploy

# Redeploy with new settings
./start-production.sh
```

### Manual Production
```bash
# Stop services
docker compose down

# Start with production config
docker compose --env-file .env.deploy up --build -d
```

## 🔧 Specific Change Types

### Frontend Changes
- **Railway**: `railway up` (automatic rebuild)
- **Local**: `./start-dev.sh` or `docker compose up --build -d`

### Backend/API Changes  
- **Railway**: `railway up` (automatic rebuild)
- **Local**: `./start-dev.sh` or `docker compose up --build -d`

### Scanner Changes
- **Railway**: `railway up` (automatic rebuild)
- **Local**: `./start-dev.sh` or `docker compose up --build -d`

### Environment Variables
- **Railway**: `railway variables --set "VAR=value"` then `railway up`
- **Local**: Edit `.env.local` then `./start-dev.sh`
- **Production**: Edit `.env.deploy` then `./start-production.sh`

### Database/Redis Changes
- **Railway**: Handled automatically by Redis service
- **Local**: `docker compose down && ./start-dev.sh`

## 📊 Monitoring Deployment

### Railway
```bash
railway logs          # View logs
railway status        # Check service status
railway variables     # List environment variables
```

### Local/Production
```bash
docker compose ps     # Check running services
docker compose logs   # View all logs
docker compose logs web-api  # Specific service logs
```

## 🚨 Troubleshooting

### Deployment Fails
```bash
# Railway: Check logs
railway logs

# Local: Check specific service
docker compose logs [service-name]
```

### Service Won't Start
```bash
# Rebuild without cache
docker compose build --no-cache
docker compose up -d
```

### Port Conflicts
```bash
# Stop all containers
docker compose down

# Remove all containers and restart
docker system prune -f
./start-dev.sh
```

---

**🔄 Quick Commands**: `railway up` (cloud) | `./start-dev.sh` (local) | `./start-production.sh` (prod)