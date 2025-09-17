# 🚂 Railway Deployment Guide

Deploy VentiAPI Scanner to Railway cloud platform with automatic HTTPS and scaling.

## 🚀 One-Command Deploy

```bash
# Deploy to Railway (everything automated)
./start-railway.sh
```

**This script automatically:**
- Installs Railway CLI (if needed)
- Handles Railway login
- Creates project and environment
- Loads secrets from `.env.deploy` (or `.env.local` as fallback)
- Generates secure defaults if no environment file exists
- Deploys optimized container
- Provides your live HTTPS URL

## 🌐 Access Your Deployed App

After deployment completes:

```bash
# Get your app URL
railway domain

# Check deployment status
railway logs

# View environment variables
railway variables
```

**Your app will be live at**: `https://your-app-name.up.railway.app`

## ⚙️ Configuration

### Environment Variables

Railway loads variables in this priority order:

1. **`.env.deploy`** (recommended for Railway deployment)
2. **`.env.local`** (fallback for development)
3. **Auto-generated defaults** (if no files exist)

| Variable | Source | Description |
|----------|--------|-------------|
| `JWT_SECRET` | .env.deploy or auto-generated | Secure 256-bit signing key |
| `DEFAULT_ADMIN_USERNAME` | .env.deploy or auto-generated | Admin username |
| `DEFAULT_ADMIN_PASSWORD` | .env.deploy or auto-generated | Admin password |
| `SCANNER_MAX_PARALLEL_CONTAINERS` | .env.deploy or auto-generated | Parallel scanners |
| `REDIS_URL` | .env.deploy or auto-generated | Redis connection string |

**Using .env.deploy for Railway:**
```bash
# Create deployment-specific environment file
cp .env.local .env.deploy

# Customize for Railway deployment
nano .env.deploy

# Deploy with custom environment
./start-railway.sh
```

### Manual Configuration

```bash
# Change admin password
railway variables --set "DEFAULT_ADMIN_PASSWORD=yournewpassword"

# Scale parallel containers
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=5"

# Apply changes
railway up
```

## 🔧 Management Commands

```bash
# View logs
railway logs

# Get app URL
railway domain

# Check environment variables
railway variables

# Redeploy
railway up

# Connect to shell (if needed)
railway shell
```

## 💰 Railway Pricing

- **Free Tier**: Perfect for demos and testing
- **Pro Tier** ($5/month): Custom domains, more resources
- **Automatic HTTPS**: Included on all tiers

## 🐛 Troubleshooting

### Deployment Issues
```bash
# Check build logs
railway logs

# Verify environment variables
railway variables

# Restart deployment
railway up
```

### Scanner Not Working
✅ **Fixed**: Railway automatically detects environment and uses subprocess execution instead of Docker containers.

### Authentication Issues
```bash
# Check admin credentials
railway variables | grep DEFAULT_ADMIN

# Reset password
railway variables --set "DEFAULT_ADMIN_PASSWORD=newpassword123"
railway up
```

### Performance Tuning
```bash
# For Railway Free Tier
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=2"

# For Railway Pro Tier
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=8"
```

## 🔄 Updates

```bash
# Deploy code updates
git push    # If auto-deploy enabled
# OR
railway up  # Manual deploy

# Update Railway CLI
npm update -g @railway/cli
```

## 🌍 Custom Domain (Pro Plan)

```bash
# Add custom domain
railway domain add yourdomain.com

# Verify domain setup
railway domain
```

## 📊 Features Included

Your Railway deployment includes:

- ✅ **Automatic HTTPS** with valid SSL certificates
- ✅ **Professional domain** (*.railway.app)
- ✅ **Railway-compatible scanning** (no Docker-in-Docker)
- ✅ **Real-time progress tracking**
- ✅ **Parallel API scanning**
- ✅ **Admin authentication**
- ✅ **Security headers and rate limiting**
- ✅ **Automatic scaling**

---

**🚀 Your VentiAPI Scanner is production-ready with Railway's enterprise infrastructure!**