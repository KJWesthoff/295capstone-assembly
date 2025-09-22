#!/bin/bash

# Quick fix for the current deployment
PUBLIC_IP="54.176.205.155"
KEY_PAIR_NAME="ventiapi-key"

echo "🔧 Fixing deployment on $PUBLIC_IP..."

ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

cd /opt/ventiapi

# Create the missing .env.local file
echo "Creating .env.local file..."
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

# Admin User
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

echo "✅ Environment file created"

# Restart the deployment
echo "🐳 Restarting Docker services..."
sg docker -c "
    cd /opt/ventiapi
    docker-compose down || true
    docker-compose up -d
"

echo "⏱️ Waiting for services to start..."
sleep 15

# Check status
echo "📊 Service Status:"
sg docker -c "cd /opt/ventiapi && docker-compose ps"

echo "🌐 Application should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
EOF

echo "✅ Deployment fixed!"
echo "🌐 Your application should now be available at: http://$PUBLIC_IP:3000"