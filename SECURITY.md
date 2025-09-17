# 🛡️ Security Guide

VentiAPI Scanner implements comprehensive security measures for production-ready API security testing with containerized architecture.

## 🔐 Authentication & Authorization

### JWT Authentication
- **JWT tokens** with configurable expiration (24 hours default)
- **Secure secrets** using cryptographically strong random generation
- **Role-based access** (admin/regular users)

### Password Security
- **bcrypt hashing** with proper salt rounds
- **Rate limiting** prevents brute force attacks (5 attempts/minute)

```bash
# Login with secure credentials
POST /api/auth/login
{
  "username": "admin",
  "password": "your_secure_password"
}
```

## 🛡️ Input Protection

### File Upload Security
- **Size limits**: 10MB maximum
- **Type validation**: .yml, .yaml, .json only
- **Content scanning**: Malicious YAML/JSON detection
- **Path traversal prevention**

### API Input Validation
- **URL validation** with protocol restrictions
- **Parameter sanitization** prevents injection attacks
- **Rate limiting** by endpoint type:
  - Login: 5/minute
  - Scan: 10/hour
  - Upload: 20/hour
  - General: 100/minute

## 🐳 Container Security

### Scanner Container Isolation
- **Isolated execution**: Each scanner runs in separate containers
- **Resource limits**: Memory and CPU constraints per scanner
- **Non-root users**: All containers run as user 1000:1000
- **Read-only filesystem**: Containers cannot modify system files
- **No privileged access**: Containers run without elevated permissions

### Docker Hardening
```yaml
# Applied to all scanner containers
security_opt: [no-new-privileges]
user: "1000:1000"  # Non-root execution
read_only: true    # Read-only root filesystem
mem_limit: 512m    # Memory constraints
cpu_limit: 0.5     # CPU limitations
cap_drop: [ALL]    # Drop all capabilities
```

### Network Isolation
- **Internal networks** for service communication
- **Minimal port exposure** (only necessary ports)
- **Container-to-container** communication only
- **Scanner isolation** prevents cross-contamination

## 🌐 Web Security

### Security Headers
```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### CORS Protection
- **Specific origins** only (no wildcards)
- **Limited methods**: GET, POST, DELETE
- **Secure credentials** handling

## 📊 Security Monitoring

### Event Logging
- **Login attempts** (success/failure)
- **Scan activities** (start/complete/fail)
- **Rate limit violations**
- **File upload rejections**

### Data Protection
- **Sensitive data redaction** in logs
- **Automatic cleanup** of temporary files
- **Memory-only** storage for tokens

## 🚀 Deployment Security

### Local Development
```bash
# Generate secure secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)

# Start with production security
./start-production.sh
```

### Railway Cloud
```bash
# Set secure variables
railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"
railway variables --set "DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 16)"

# Deploy with built-in security
./start-railway.sh
```

### SSL/HTTPS Setup
```bash
# Local SSL (optional)
# 1. Obtain certificates (Let's Encrypt)
# 2. Copy to nginx/ssl/
# 3. Use nginx/nginx-ssl.conf
# 4. Restart: ./start-production.sh

# Railway SSL (automatic)
# HTTPS enabled by default at *.railway.app
```

## 🔧 Security Best Practices

### Regular Maintenance
```bash
# Update dependencies
npm audit fix              # Frontend
pip-audit --fix           # Backend
docker-compose pull       # Container images

# Security scanning
docker scout cves ventiapi-web-api:latest
```

### Monitoring & Response
- **Monitor logs** for suspicious patterns
- **Update secrets** regularly
- **Review user access** periodically
- **Test security measures** with scans

## ⚠️ Security Considerations

### Current Security Features
✅ **Authentication**: JWT with secure secrets  
✅ **Input Validation**: Comprehensive sanitization  
✅ **Rate Limiting**: Per-endpoint protection  
✅ **Container Security**: Hardened Docker setup  
✅ **Security Headers**: Full HTTP protection  
✅ **Logging**: Security event monitoring  

### Production Recommendations
- **Database**: Replace in-memory storage with encrypted database
- **MFA**: Implement multi-factor authentication
- **WAF**: Add Web Application Firewall
- **Monitoring**: Enhanced security monitoring

## 📞 Security Contact

Report security issues responsibly:
- **GitHub Issues**: For general security questions
- **Private Disclosure**: For vulnerability reports

---

**🔒 Security is built-in, not bolted-on. VentiAPI Scanner follows security-first principles.**