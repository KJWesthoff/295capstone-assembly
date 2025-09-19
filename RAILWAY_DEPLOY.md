# Railway Deployment Guide

This project is configured for Railway's microservice architecture with auto-scaling scanner workers.

## 🚀 Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Main App      │  │     Redis       │  │ Scanner Workers │
│ (railway.json)  │  │   (Railway      │  │ (railway-       │
│                 │  │   Plugin)       │  │ scanner.json)   │
│ • nginx proxy   │  │                 │  │                 │
│ • FastAPI API   │  │ • Job queue     │  │ • Auto-scaling  │
│ • Frontend      │  │ • Results cache │  │ • Stateless     │
│ • Port 3000     │  │                 │  │ • Parallel      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 📋 Deployment Steps

### 1. Setup Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway new

# Link to existing project (if needed)
railway link
```

### 2. Deploy Services in Order

#### A. Redis Service (First)
```bash
# Add Redis plugin to your Railway project
railway add redis
```

#### B. Main App Service
```bash
# Deploy main app (uses railway.json)
railway up --service main-app

# Set environment variables
railway variables set JWT_SECRET="your-super-secure-jwt-secret-here"
railway variables set DEFAULT_ADMIN_USERNAME="admin"
railway variables set DEFAULT_ADMIN_PASSWORD="your-secure-password"
```

#### C. Scanner Worker Service  
```bash
# Deploy scanner workers (uses railway-scanner.json)
railway up --service scanner-workers --config railway-scanner.json

# Scale workers based on demand (optional)
railway scale --replicas 3 --service scanner-workers
```

### 3. Configure Environment Variables

#### Main App (`railway.json`)
| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Auto-linked from Redis plugin | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | JWT token signing key | `H6KaXFDmL0C+qWzrzl5y...` |
| `DEFAULT_ADMIN_USERNAME` | Admin login username | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | Admin login password | `your-secure-password` |

#### Scanner Workers (`railway-scanner.json`)
| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Auto-linked from Redis plugin | `${{Redis.REDIS_URL}}` |
| `RAILWAY_REPLICA_ID` | Auto-set by Railway | `${{RAILWAY_REPLICA_ID}}` |

### 4. Domain & Access

```bash
# Get your app URL
railway domain

# Custom domain (optional)
railway domain add yourdomain.com
```

## 🔧 Local Development vs Production

### Development (Docker Compose)
```bash
# Start local development environment
./start-dev.sh

# Access at http://localhost:3000
```

### Production (Railway)
```bash
# Each service deploys independently
# Main app handles web traffic on assigned domain
# Workers auto-scale based on scan queue
```

## 📊 Monitoring & Scaling

### Queue Monitoring
- **Health Endpoint**: `https://your-app.railway.app/health`
- **Queue Stats**: `https://your-app.railway.app/api/queue/stats` (admin only)

### Auto-Scaling Workers
```bash
# Scale workers based on demand
railway scale --replicas 5 --service scanner-workers

# Monitor worker health
railway logs --service scanner-workers
```

### Resource Limits
```json
{
  "deploy": {
    "replicas": 2,
    "resources": {
      "memory": "512Mi",
      "cpu": "500m"
    }
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Redis Connection Failed
```bash
# Check Redis service
railway status --service redis

# Verify REDIS_URL variable
railway variables --service main-app
```

#### 2. Workers Not Processing Jobs
```bash
# Check worker logs
railway logs --service scanner-workers

# Scale up workers
railway scale --replicas 3 --service scanner-workers
```

#### 3. Build Failures
```bash
# Check build logs
railway logs --service main-app

# Redeploy with latest code
railway up --service main-app
```

### Log Monitoring
```bash
# Main app logs
railway logs --service main-app

# Worker logs  
railway logs --service scanner-workers

# Follow logs in real-time
railway logs --follow --service main-app
```

## 🔐 Security Considerations

### Environment Variables
- Never commit secrets to git
- Use Railway's environment variables for all sensitive data
- Rotate JWT secrets regularly

### Network Security
- All internal communication uses Railway's private networking
- Only main app is exposed to internet (port 3000)
- Workers communicate with Redis internally

### Access Control
- Admin endpoints require authentication
- Dangerous scans require admin privileges
- Rate limiting on all public endpoints

## 📈 Performance Optimization

### Scaling Strategy
1. **Horizontal Scaling**: Add more worker replicas during high load
2. **Queue Management**: Monitor queue depth and scale accordingly
3. **Resource Allocation**: Adjust memory/CPU limits per service

### Recommended Scaling
- **Low Traffic**: 1 main app + 1-2 workers
- **Medium Traffic**: 1 main app + 3-5 workers  
- **High Traffic**: 1 main app + 5-10 workers

## 🔄 CI/CD Integration

### GitHub Actions (Example)
```yaml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railway/cli-action@v1
        with:
          command: up --service main-app
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI Reference](https://docs.railway.app/develop/cli)
- [Scaling Guidelines](https://docs.railway.app/deploy/scaling)

---

**🎯 Ready for Production**: This architecture provides auto-scaling, fault tolerance, and cost optimization for the VentiAPI Scanner platform.