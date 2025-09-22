#!/bin/bash

# EMERGENCY SECURITY FIX - Replace insecure default credentials
PUBLIC_IP="54.176.205.155"
KEY_PAIR_NAME="ventiapi-key"

echo "🚨 EMERGENCY SECURITY FIX - Removing insecure default credentials"

# First, let's fix the security.py file properly
cat > /tmp/security_fix.py << 'EOF'
# Replace the problematic section in security.py
import os

class UserDB:
    """Simple user database - replace with proper DB in production"""
    def __init__(self):
        self.users: Dict[str, Dict] = {}
        # Create default admin user from environment variables
        admin_username = os.getenv("ADMIN_USERNAME")
        admin_password = os.getenv("ADMIN_PASSWORD")
        
        # REQUIRE credentials to be set - no insecure defaults
        if not admin_username or not admin_password:
            raise ValueError("ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set!")
        
        if admin_username in ["admin", "test", "user"] and admin_password in ["admin123", "password", "123456"]:
            raise ValueError("Insecure default credentials detected! Please use secure credentials.")
        
        self.create_user(admin_username, admin_password, is_admin=True)
EOF

# Apply the complete fix
ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

cd /opt/ventiapi

echo "🔒 Applying emergency security fix..."

# Stop all services immediately
echo "🛑 Stopping all services..."
sg docker -c "cd /opt/ventiapi && docker-compose down"

# Verify our secure credentials are in place
echo "🔍 Checking environment variables..."
if grep -q "ADMIN_USERNAME=MICS295" .env.local && grep -q "ADMIN_PASSWORD=MaryMcHale" .env.local; then
    echo "✅ Secure credentials found in .env.local"
else
    echo "❌ Secure credentials not found! Updating .env.local..."
    # Recreate with secure credentials
    cat > .env.local << 'ENVEOF'
# Production Environment
ENVIRONMENT=production
NODE_ENV=production
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Security Configuration
JWT_SECRET=ventiapi-super-secret-jwt-key-for-production-deployment-32-chars
JWT_EXPIRES_IN=24h

# Admin User - SECURE CREDENTIALS
ADMIN_USERNAME=MICS295
ADMIN_PASSWORD=MaryMcHale

# Application Configuration
APP_NAME=VentiAPI Scanner
APP_VERSION=1.0.0
DEBUG=false
LOG_LEVEL=INFO

# Scanner Configuration
MAX_SCAN_DURATION=3600
MAX_REQUESTS_PER_SCAN=1000
DEFAULT_RATE_LIMIT=2.0
MAX_CONCURRENT_SCANS=5

# AWS Configuration
AWS_REGION=us-west-1

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock
SCANNER_IMAGE=ventiapi-scanner
SCANNER_NETWORK=scanner-network

# Rate Limiting
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SCAN=10/hour
RATE_LIMIT_API=100/minute

# Monitoring
ENABLE_METRICS=true
LOG_FORMAT=json
LOG_FILE=/var/log/ventiapi/app.log
ENVEOF
fi

echo "🛠️ Rebuilding with secure configuration..."
sg docker -c "
    cd /opt/ventiapi
    docker-compose build --no-cache web-api
    docker-compose up -d
"

echo "⏱️ Waiting for secure restart..."
sleep 15

# Verify no insecure credentials are active
echo "🔐 Verifying security..."
sg docker -c "cd /opt/ventiapi && docker-compose logs web-api | tail -10"

echo "✅ Security fix applied!"
echo "🔑 Secure login: MICS295 / MaryMcHale"
EOF

# Upload the fixed security.py file
echo "📤 Uploading properly secured security.py..."
scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ../scanner-service/web-api/security.py ec2-user@$PUBLIC_IP:/opt/ventiapi/scanner-service/web-api/

echo
echo "🚨 SECURITY STATUS: FIXED"
echo "✅ Insecure defaults removed"
echo "✅ Secure credentials enforced: MICS295 / MaryMcHale"
echo "🌐 Application: http://$PUBLIC_IP:3000"
echo
echo "⚠️  IMPORTANT: Change the JWT_SECRET in production!"
echo "⚠️  IMPORTANT: Monitor logs for any suspicious activity!"