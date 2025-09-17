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
- Generates secure secrets
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

Railway automatically sets these variables:

| Variable | Auto-Generated | Description |
|----------|----------------|-------------|
| `JWT_SECRET` | ✅ | Secure 256-bit signing key |
| `DEFAULT_ADMIN_USERNAME` | ✅ | Admin username (`admin`) |
| `DEFAULT_ADMIN_PASSWORD` | ✅ | Random secure password |
| `SCANNER_MAX_PARALLEL_CONTAINERS` | ✅ | Parallel scanners (3) |
| `REDIS_URL` | ✅ | Redis connection string |

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