# 🛡️ VentiAPI Scanner - Security Guide

This document outlines the comprehensive security measures implemented in the VentiAPI Scanner application and provides guidance for secure deployment and operation.

## 🚨 Security Implementations

### 1. Authentication & Authorization

#### JWT-Based Authentication
- **JWT tokens** with configurable expiration (default: 24 hours)
- **Strong secret keys** using cryptographically secure random generation
- **Token revocation** support with unique token IDs (JTI)
- **User role management** (admin/regular users)

#### Password Security
- **bcrypt hashing** with salt rounds
- **Minimum password requirements** (6+ characters)
- **Account lockout** after failed attempts (via rate limiting)

```python
# Example: Creating a secure user
POST /api/auth/login
{
  "username": "admin",
  "password": "your_secure_password"
}
```

### 2. Input Validation & Sanitization

#### File Upload Security
- **File size limits** (10MB max)
- **Extension whitelisting** (.yml, .yaml, .json only)
- **MIME type validation**
- **Malicious content scanning** for dangerous YAML/JSON constructs
- **Path traversal prevention**

#### URL Validation
- **Format validation** with regex patterns
- **Protocol restrictions** (http/https only)  
- **Private IP blocking** (prevents SSRF attacks)
- **Length limits** (2048 characters max)

#### Parameter Sanitization
- **SQL injection prevention** with parameterized queries
- **Command injection blocking** with input sanitization
- **XSS prevention** with output encoding

### 3. Rate Limiting & DDoS Protection

#### Endpoint-Specific Limits
```yaml
Login: 5 attempts/minute
Scan Start: 10 scans/hour  
File Upload: 20 files/hour
General API: 100 requests/minute
```

#### Implementation Details
- **Per-IP rate limiting** using SlowAPI
- **User-based limits** for authenticated endpoints
- **Burst handling** with token bucket algorithm
- **Rate limit headers** for client awareness

### 4. Container Security

#### Docker Hardening
```yaml
# Security restrictions applied to all containers
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - NET_RAW  # Only for scanners
read_only: true
user: "1000:1000"  # Non-root user
mem_limit: 512m
cpus: 0.5
```

#### Network Isolation
- **Separate networks** for different service tiers
- **Internal-only networks** for scanner containers
- **Minimal port exposure**
- **Docker socket protection** (read-only access)

#### Resource Limits
- **Memory limits** to prevent DoS
- **CPU quotas** for fair resource sharing
- **Process limits** (ulimits)
- **Disk usage controls** with tmpfs

### 5. Data Protection

#### Encryption
- **In-transit encryption** with TLS 1.3
- **JWT token encryption** with strong algorithms
- **Sensitive data hashing** for logs
- **File permissions** (600/700) for sensitive data

#### Data Minimization
- **Temporary file cleanup** after scan completion
- **Automatic scan result expiration**
- **No sensitive data in logs**
- **Memory-only storage** for temporary data

### 6. Security Headers

#### HTTP Security Headers
```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
Referrer-Policy: strict-origin-when-cross-origin
```

#### CORS Configuration
- **Specific origin allowlisting** (no wildcards)
- **Limited methods** (GET, POST, DELETE only)
- **Credential handling** with secure cookies
- **Preflight caching** for performance

### 7. Monitoring & Logging

#### Security Event Logging
```python
# Events logged for security monitoring
- login_attempt, login_failed, login_success
- scan_started, scan_completed, scan_failed
- rate_limit_exceeded, unauthorized_access
- file_upload_rejected, malicious_content_detected
```

#### Log Security
- **Sensitive data redaction** (passwords, tokens)
- **IP address hashing** for privacy
- **Structured logging** with JSON format
- **Log rotation** and retention policies

## 🚀 Secure Deployment

### 1. Production Setup

#### Environment Configuration
```bash
# Generate secure JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# Set production environment
export ENVIRONMENT=production

# Enable security features
export RATE_LIMIT_ENABLED=true
export SECURITY_LOG_ENABLED=true
```

#### TLS/SSL Configuration
```bash
# Obtain SSL certificates (Let's Encrypt recommended)
certbot certonly --webroot -w /var/www/html -d yourdomain.com

# Configure nginx with SSL
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
}
```

### 2. Secure Docker Deployment

#### Using Secure Compose File
```bash
# Deploy with security-focused configuration
docker-compose -f docker-compose.secure.yml up -d

# Verify security settings
docker inspect ventiapi-web-api-secure | jq '.[] | .HostConfig.SecurityOpt'
```

#### Container Image Security
```bash
# Scan images for vulnerabilities
docker scout cves ventiapi-web-api:secure
docker scout recommendations ventiapi-web-api:secure

# Sign images for supply chain security  
docker trust sign yourdomain.com/ventiapi-web-api:secure
```

### 3. Network Security

#### Firewall Configuration
```bash
# Basic iptables rules
iptables -A INPUT -p tcp --dport 22 -j ACCEPT  # SSH
iptables -A INPUT -p tcp --dport 80 -j ACCEPT  # HTTP
iptables -A INPUT -p tcp --dport 443 -j ACCEPT # HTTPS
iptables -A INPUT -j DROP  # Drop all other traffic
```

#### Network Isolation
```yaml
# Example firewall configuration
# Allow HTTPS traffic from anywhere
- protocol: tcp
  port: 443
  source: 0.0.0.0/0

# Allow SSH from private networks only  
- protocol: tcp
  port: 22
  source: 10.0.0.0/8
```

## 🔒 Security Best Practices

### 1. Regular Security Maintenance

#### Updates & Patches
```bash
# Regular security updates
apt update && apt upgrade -y

# Container image updates
docker-compose pull
docker-compose up -d

# Dependency updates
npm audit fix
pip-audit --fix
```

#### Certificate Management
```bash
# Automated certificate renewal
0 3 * * 0 /usr/bin/certbot renew --quiet --no-self-upgrade

# Certificate monitoring
openssl x509 -in cert.pem -noout -dates
```

### 2. Security Monitoring

#### Failed Login Detection
```python
# Monitor for brute force attacks
def detect_brute_force(ip_address):
    failed_attempts = get_failed_logins(ip_address, last_hour=True)
    if failed_attempts > 10:
        block_ip(ip_address, duration=3600)  # 1 hour block
```

#### Anomaly Detection
- **Unusual scan patterns** (too many requests)
- **Suspicious file uploads** (large files, unusual extensions)
- **Geolocation anomalies** (logins from new countries)
- **Resource consumption spikes**

### 3. Incident Response

#### Security Incident Procedures
1. **Immediate Response**
   - Block suspicious IPs
   - Revoke compromised tokens
   - Scale down if under attack

2. **Investigation**
   - Analyze security logs
   - Identify attack vectors
   - Assess data exposure

3. **Recovery**
   - Patch vulnerabilities
   - Update security configs
   - Notify affected users

4. **Post-Incident**
   - Update security procedures
   - Implement additional monitoring
   - Security training for team

## 🔍 Security Testing

### 1. Automated Security Testing

#### SAST (Static Analysis)
```bash
# Code security analysis
bandit -r scanner-service/
semgrep --config=auto .
npm audit
```

#### DAST (Dynamic Analysis)  
```bash
# API security testing
zap-baseline.py -t http://localhost:8000
nikto -h localhost:3000
```

#### Container Security
```bash
# Image vulnerability scanning
docker scout cves --only-severities critical,high
trivy image ventiapi-web-api:secure
```

### 2. Penetration Testing

#### Security Test Scenarios
- **Authentication bypass attempts**
- **Authorization privilege escalation**
- **Input validation fuzzing**
- **Rate limiting bypass**
- **Container escape attempts**
- **Network segmentation testing**

## 🚧 Known Security Considerations

### Current Limitations
1. **In-memory storage** - Use proper database for production
2. **Basic user management** - Implement proper identity provider
3. **Limited audit logging** - Add comprehensive audit trail
4. **Docker socket access** - Consider rootless Docker alternative

### Recommended Enhancements
1. **Database encryption** at rest
2. **Multi-factor authentication** (MFA)
3. **Web Application Firewall** (WAF)
4. **Intrusion Detection System** (IDS)
5. **Security Information and Event Management** (SIEM)

## 📞 Security Contact

For security issues or questions:
- **Email:** security@yourdomain.com
- **Encrypted:** [PGP Key](link-to-pgp-key)
- **Bug Bounty:** [HackerOne Program](link-to-program)

## 📚 Security References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

**⚠️ Remember: Security is an ongoing process, not a one-time implementation. Regularly review and update security measures.**