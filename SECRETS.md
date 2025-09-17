# Secrets Management

Simple, secure credential management for VentiAPI Scanner across all deployment environments.

## 🔑 Required Secrets

### Core Credentials
- **`JWT_SECRET`**: Token signing key (256-bit recommended)
- **`DEFAULT_ADMIN_USERNAME`**: Admin username (default: `admin`)
- **`DEFAULT_ADMIN_PASSWORD`**: Admin password (strong password required)

### Configuration
- **`SCANNER_MAX_PARALLEL_CONTAINERS`**: Parallel scanner limit
- **`SCANNER_CONTAINER_MEMORY_LIMIT`**: Memory per scanner
- **`REDIS_URL`**: Redis connection (auto-configured in most cases)

## 🏠 Local Development

### Quick Setup
```bash
# 1. Clone the repository
git clone <repo-url>
cd ScannerApp

# 2. Generate secure secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)

# 3. Start development
./start-dev.sh

# Your admin credentials:
echo "Username: admin"
echo "Password: $DEFAULT_ADMIN_PASSWORD"
```

### Environment File (.env.local)
```bash
# Create local environment file (git-ignored)
cat > .env.local << EOF
JWT_SECRET=$(openssl rand -base64 32)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)
SCANNER_MAX_PARALLEL_CONTAINERS=5
SCANNER_CONTAINER_MEMORY_LIMIT=512m
REDIS_URL=redis://redis:6379
EOF
```

## ☁️ Railway Cloud Deployment

### Automatic Setup
```bash
# One-command deployment with auto-generated secrets
./start-railway.sh
```

### Manual Configuration
```bash
# Set secure variables manually
railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"
railway variables --set "DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)"
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=3"

# Check variables
railway variables

# Deploy
railway up
```

## 🚀 Production Deployment

### Docker Compose
```bash
# 1. Generate production secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)

# 2. Create production environment
cat > .env.production << EOF
JWT_SECRET=$JWT_SECRET
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=$DEFAULT_ADMIN_PASSWORD
SCANNER_MAX_PARALLEL_CONTAINERS=10
SCANNER_CONTAINER_MEMORY_LIMIT=1g
REDIS_URL=redis://redis:6379
EOF

# 3. Secure the file and deploy
chmod 600 .env.production
docker compose --env-file .env.production up -d
```

### Environment Variables
```bash
# Set directly in environment
export JWT_SECRET="your-secure-jwt-secret"
export DEFAULT_ADMIN_PASSWORD="your-secure-password"

# Start production
./start-production.sh
```

## 🔒 Security Best Practices

### Secret Generation
```bash
# Generate cryptographically secure secrets
JWT_SECRET=$(openssl rand -base64 32)      # 256-bit JWT secret
ADMIN_PASSWORD=$(openssl rand -base64 16)  # Strong admin password

# Alternative: Use a password manager
# - 1Password
# - Bitwarden  
# - LastPass
```

### Storage Security
- ✅ **Never commit** secrets to git
- ✅ **Use environment variables** in production
- ✅ **Rotate secrets** regularly
- ✅ **Limit access** to secrets
- ✅ **Monitor access** to credentials

### File Permissions
```bash
# Secure environment files
chmod 600 .env.production    # Owner read/write only
chmod 600 .env.local         # Owner read/write only

# Check permissions
ls -la .env*
```

## 🐛 Troubleshooting

### Check Secrets Status
```bash
# Verify secrets are set (without showing values)
[ -n "$JWT_SECRET" ] && echo "✅ JWT_SECRET set" || echo "❌ JWT_SECRET missing"
[ -n "$DEFAULT_ADMIN_PASSWORD" ] && echo "✅ ADMIN_PASSWORD set" || echo "❌ ADMIN_PASSWORD missing"

# Railway environment
railway variables | grep -E "(JWT_SECRET|DEFAULT_ADMIN)"
```

### Common Issues

#### Login Failed
```bash
# Check admin credentials
railway variables | grep DEFAULT_ADMIN

# Reset password
railway variables --set "DEFAULT_ADMIN_PASSWORD=newpassword123"
railway up
```

#### JWT Errors
```bash
# Generate new JWT secret
export JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT secret: $JWT_SECRET"

# Update and restart
railway variables --set "JWT_SECRET=$JWT_SECRET"
railway up
```

## 📋 Quick Reference

### Development
```bash
./start-dev.sh              # Auto-generated secrets
```

### Railway Cloud
```bash
./start-railway.sh          # Auto-deployment
railway variables           # Check secrets
```

### Production
```bash
# Set secrets → Deploy
export JWT_SECRET=$(openssl rand -base64 32)
export DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)
./start-production.sh
```

---

**🔐 Keep secrets secure, rotate regularly, and never commit to version control.**