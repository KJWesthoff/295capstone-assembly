#!/bin/bash
set -ex

# =============================================================================
# VentiAPI Scanner - EC2 Bootstrap Script
# =============================================================================
# This script runs on first boot to:
# 1. Install Docker and Docker Compose
# 2. Pull secrets from AWS Secrets Manager
# 3. Clone application code
# 4. Generate environment files
# 5. Start services
# =============================================================================

exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user-data script at $(date)"

# Variables injected by Terraform
ENVIRONMENT="${environment}"
PROJECT_NAME="${project_name}"
SECRETS_ARN="${secrets_arn}"
AWS_REGION="${aws_region}"
GITHUB_REPO="${github_repo}"
GITHUB_BRANCH="${github_branch}"

# =============================================================================
# System Setup
# =============================================================================

echo "=== Installing system packages ==="
dnf update -y
dnf install -y docker git jq unzip

# Install AWS CLI v2 (for Secrets Manager)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose
COMPOSE_VERSION="2.24.0"
curl -L "https://github.com/docker/compose/releases/download/v$${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# =============================================================================
# Install Certbot (for Let's Encrypt SSL)
# =============================================================================

echo "=== Installing Certbot ==="
yum install -y certbot python3-certbot-nginx

# Create directories for certbot
mkdir -p /opt/ventiapi/certbot-webroot/.well-known/acme-challenge
mkdir -p /etc/letsencrypt
chmod -R 755 /opt/ventiapi/certbot-webroot

echo "Certbot installed (SSL setup must be run manually after DNS configuration)"

# =============================================================================
# Get Public IP (with IMDSv2 support)
# Wait for EIP to be attached before proceeding
# =============================================================================

echo "=== Getting instance metadata ==="
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# Wait for EIP to be attached (Terraform attaches it after instance creation)
echo "Waiting for Elastic IP to be attached..."
MAX_EIP_WAIT=60
EIP_WAIT_COUNT=0
INITIAL_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
PUBLIC_IP=$INITIAL_IP

while [ $EIP_WAIT_COUNT -lt $MAX_EIP_WAIT ]; do
    sleep 5
    CURRENT_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)

    # If IP changed from initial IP, EIP has been attached
    if [ "$CURRENT_IP" != "$INITIAL_IP" ]; then
        PUBLIC_IP=$CURRENT_IP
        echo "EIP attached! Public IP: $PUBLIC_IP"
        break
    fi

    EIP_WAIT_COUNT=$((EIP_WAIT_COUNT + 1))
    echo "Still waiting for EIP... ($EIP_WAIT_COUNT/$MAX_EIP_WAIT)"
done

if [ "$PUBLIC_IP" = "$INITIAL_IP" ]; then
    echo "Warning: EIP may not have been attached, using initial IP: $PUBLIC_IP"
else
    echo "Public IP confirmed: $PUBLIC_IP"
fi

# =============================================================================
# Fetch Secrets from AWS Secrets Manager
# =============================================================================

echo "=== Fetching secrets from Secrets Manager ==="
SECRETS_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRETS_ARN" \
  --region "$AWS_REGION" \
  --query 'SecretString' \
  --output text)

# Parse secrets
OPENAI_API_KEY=$(echo "$SECRETS_JSON" | jq -r '.OPENAI_API_KEY')
MODEL=$(echo "$SECRETS_JSON" | jq -r '.MODEL // "gpt-4o-mini"')
JWT_SECRET=$(echo "$SECRETS_JSON" | jq -r '.JWT_SECRET // empty')
ADMIN_USERNAME=$(echo "$SECRETS_JSON" | jq -r '.ADMIN_USERNAME')
ADMIN_PASSWORD=$(echo "$SECRETS_JSON" | jq -r '.ADMIN_PASSWORD')
DATABASE_URL=$(echo "$SECRETS_JSON" | jq -r '.DATABASE_URL // "postgresql://rag_user:rag_pass@postgres:5432/rag_db?sslmode=require"')
POSTGRES_USER=$(echo "$SECRETS_JSON" | jq -r '.POSTGRES_USER // "rag_user"')
POSTGRES_PASSWORD=$(echo "$SECRETS_JSON" | jq -r '.POSTGRES_PASSWORD // "rag_pass"')
POSTGRES_DB=$(echo "$SECRETS_JSON" | jq -r '.POSTGRES_DB // "rag_db"')
MISTRAL_API_KEY=$(echo "$SECRETS_JSON" | jq -r '.MISTRAL_API_KEY // empty')
GITHUB_TOKEN=$(echo "$SECRETS_JSON" | jq -r '.GITHUB_TOKEN // empty')

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

echo "Secrets loaded successfully"

# =============================================================================
# Clone Application Code
# =============================================================================

echo "=== Cloning application repository ==="
mkdir -p /opt/ventiapi
cd /opt/ventiapi

if [ -n "$GITHUB_TOKEN" ]; then
  # Use token for private repos
  REPO_URL=$(echo "$GITHUB_REPO" | sed "s|https://|https://$GITHUB_TOKEN@|")
  git clone --branch "$GITHUB_BRANCH" --single-branch "$REPO_URL" .
else
  git clone --branch "$GITHUB_BRANCH" --single-branch "$GITHUB_REPO" .
fi

echo "Repository cloned: branch $GITHUB_BRANCH"

# =============================================================================
# Generate Environment Files
# =============================================================================

echo "=== Generating environment files ==="

# Production environment file (.env.remote)
cat > /opt/ventiapi/.env.remote << EOF
# =============================================================================
# VentiAPI Scanner - Production Environment
# Generated by Terraform on $(date)
# =============================================================================

# Environment
ENVIRONMENT=$ENVIRONMENT
DEBUG=false
NODE_ENV=production

# Security
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Redis
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Database
DATABASE_URL=$DATABASE_URL
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB

# Scanner
SCANNER_IMAGE=ventiapi-scanner
ZAP_IMAGE=ventiapi-zap
MAX_SCAN_DURATION=3600
MAX_REQUESTS_PER_SCAN=1000
DEFAULT_RATE_LIMIT=2.0

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# CORS (allow access from domain and IP - both HTTP and HTTPS)
ADDITIONAL_CORS_ORIGINS=https://ventiapi.com,https://www.ventiapi.com,http://ventiapi.com,http://www.ventiapi.com,http://$PUBLIC_IP,http://$PUBLIC_IP:3001,http://$PUBLIC_IP:3000,https://$PUBLIC_IP,https://$PUBLIC_IP:3001

# Frontend public URLs (for cedar-frontend container)
NEXT_PUBLIC_SCANNER_SERVICE_URL=http://$PUBLIC_IP:8000
NEXT_PUBLIC_SCANNER_USERNAME=$ADMIN_USERNAME
NEXT_PUBLIC_SCANNER_PASSWORD=$ADMIN_PASSWORD
NEXT_PUBLIC_MASTRA_URL=http://$PUBLIC_IP:4111
EOF

# Cedar/Mastra .env
mkdir -p /opt/ventiapi/cedar-mastra
cat > /opt/ventiapi/cedar-mastra/.env << EOF
# =============================================================================
# Cedar/Mastra - Production Environment
# Generated by Terraform on $(date)
# =============================================================================

# OpenAI
OPENAI_API_KEY=$OPENAI_API_KEY
MODEL=$MODEL

# Mistral (optional)
MISTRAL_API_KEY=$MISTRAL_API_KEY

# GitHub (for advisory ingestion)
GITHUB_TOKEN=$GITHUB_TOKEN

# Database
DATABASE_URL=$DATABASE_URL
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB

# Scanner Service (internal Docker network)
SCANNER_SERVICE_URL=http://web-api:8000
SCANNER_USERNAME=$ADMIN_USERNAME
SCANNER_PASSWORD=$ADMIN_PASSWORD

# Public URLs (for frontend)
NEXT_PUBLIC_SCANNER_SERVICE_URL=http://$PUBLIC_IP:8000
NEXT_PUBLIC_SCANNER_USERNAME=$ADMIN_USERNAME
NEXT_PUBLIC_SCANNER_PASSWORD=$ADMIN_PASSWORD
NEXT_PUBLIC_MASTRA_URL=http://$PUBLIC_IP:4111
EOF

# Set ownership
chown -R ec2-user:ec2-user /opt/ventiapi

echo "Environment files generated"

# =============================================================================
# Build and Start Services
# =============================================================================

echo "=== Building Docker images ==="
cd /opt/ventiapi

# Create symlink for docker-compose compatibility
# (docker-compose loads .env.local from service definitions even with --env-file)
ln -sf .env.remote .env.local

# Load .env.remote into current shell for docker-compose build
# This makes NEXT_PUBLIC_* vars available as build args
set -a
source /opt/ventiapi/.env.remote
set +a

# Build all services with --env-file to ensure NEXT_PUBLIC vars are available
docker-compose --env-file .env.remote build

# Build scanner images (critical for scans to work)
docker-compose --env-file .env.remote --profile build-only build scanner
docker-compose --env-file .env.remote --profile build-only build zap

echo "=== Starting services ==="
docker-compose --env-file .env.remote up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# =============================================================================
# Database Setup
# =============================================================================

echo "=== Setting up database ==="

# Wait for PostgreSQL
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose --env-file .env.remote exec -T postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB > /dev/null 2>&1; then
        echo "PostgreSQL is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

# Run migrations
if [ -f "database/init/01-create-scanner-schema.sql" ]; then
    echo "Running database migrations..."
    docker-compose --env-file .env.remote exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < database/init/01-create-scanner-schema.sql || true
fi

# Download and restore database dump from S3
echo "Downloading database dump from S3..."
mkdir -p database/dumps
aws s3 cp s3://ventiapi-database-dumps/rag_db_migration_20251012_221658.sql.gz database/dumps/ --region "$AWS_REGION" || true

if [ -f "database/dumps/rag_db_migration_20251012_221658.sql.gz" ]; then
    echo "Restoring database dump..."
    gunzip -c database/dumps/rag_db_migration_20251012_221658.sql.gz | docker-compose --env-file .env.remote exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB > /dev/null 2>&1 || true
    echo "Database restore complete"
else
    echo "No database dump found, skipping restore"
fi

# =============================================================================
# Verification
# =============================================================================

echo "=== Verifying deployment ==="
docker-compose --env-file .env.remote ps

echo ""
echo "=============================================="
echo "  VentiAPI Scanner Deployment Complete!"
echo "=============================================="
echo ""
echo "  Environment: $ENVIRONMENT"
echo "  Public IP:   $PUBLIC_IP"
echo ""
echo "  URLs:"
echo "    Cedar Dashboard:    http://$PUBLIC_IP (nginx on port 80)"
echo "    Scanner API:        http://$PUBLIC_IP:8000"
echo "    Mastra Backend:     http://$PUBLIC_IP:4111"
echo ""
echo "  Direct Access (development):"
echo "    Cedar Frontend:     http://$PUBLIC_IP:3001"
echo ""
echo "  Login: $ADMIN_USERNAME / [password in Secrets Manager]"
echo ""
echo "=============================================="
echo "  Next Steps: SSL Configuration"
echo "=============================================="
echo ""
echo "  1. Configure DNS A record to point to: $PUBLIC_IP"
echo "     ventiapi.com    → $PUBLIC_IP"
echo "     www.ventiapi.com → $PUBLIC_IP"
echo ""
echo "  2. Wait for DNS propagation (5-15 minutes)"
echo "     Test: dig +short ventiapi.com"
echo ""
echo "  3. Run SSL setup script:"
echo "     cd /opt/ventiapi"
echo "     sudo ./deploy/setup-certbot.sh ventiapi.com admin@ventiapi.com"
echo ""
echo "  See: /opt/ventiapi/deploy/SSL_SETUP.md for detailed instructions"
echo ""
echo "=============================================="

echo "User-data script completed at $(date)"
