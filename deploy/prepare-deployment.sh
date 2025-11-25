#!/bin/bash

# VentiAPI Scanner - Deployment Preparation Script
# This script helps prepare the environment for EC2 deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🚀 VentiAPI Scanner - Deployment Preparation"
echo "============================================"
echo

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Checking deployment requirements..."

# Check for required files
missing_files=()

if [ ! -f "deploy/deploy-simple.sh" ]; then
    missing_files+=("deploy/deploy-simple.sh")
fi

if [ ! -f "database-restore.sh" ]; then
    missing_files+=("database-restore.sh")
fi

if [ ${#missing_files[@]} -gt 0 ]; then
    print_error "Missing required files:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

# Create .env.production template if it doesn't exist
if [ ! -f "deploy/.env.production" ]; then
    print_status "Creating deploy/.env.production template..."
    
    cat > deploy/.env.production << 'EOF'
# Production Environment Configuration
# Copy this file and update with your actual values

# OpenAI Configuration (REQUIRED for Cedar AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Admin User (Change these!)
ADMIN_USERNAME=MICS295
ADMIN_PASSWORD=MaryMcHale

# Security Configuration
JWT_SECRET=ventiapi-super-secret-jwt-key-for-production-deployment-32-chars
JWT_EXPIRES_IN=24h

# Database Configuration
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Application Configuration
APP_NAME=VentiAPI Scanner
APP_VERSION=1.0.0
DEBUG=false
LOG_LEVEL=INFO
ENVIRONMENT=production
NODE_ENV=production

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
EOF
    
    print_success "Created deploy/.env.production template"
    print_warning "IMPORTANT: Edit deploy/.env.production with your actual OpenAI API key and credentials!"
fi

# Check if database dump exists
if [ ! -d "database/dumps" ] || [ -z "$(ls -A database/dumps/ 2>/dev/null)" ]; then
    print_warning "No database dumps found in database/dumps/"
    print_status "The deployment will start with an empty database."
    print_status "To include your current database, export it first:"
    echo "  docker compose exec postgres pg_dump -U rag_user rag_db > database/dumps/rag_db_backup.sql"
fi

# Check Docker Compose services
print_status "Verifying Docker Compose configuration..."
if ! docker compose config >/dev/null 2>&1; then
    print_error "Docker Compose configuration is invalid!"
    print_status "Run 'docker compose config' to see the errors."
    exit 1
fi

# Count services
service_count=$(docker compose config --services | wc -l)
print_success "Docker Compose configuration is valid ($service_count services)"

# Check if we can build images locally
print_status "Testing if images can be built..."
if docker compose build --dry-run >/dev/null 2>&1; then
    print_success "All images can be built"
else
    print_warning "Some images may fail to build - check dependencies"
fi

echo
print_success "✅ Deployment preparation complete!"
echo
echo "Next steps:"
echo "1. Edit deploy/.env.production with your actual values (especially OPENAI_API_KEY)"
echo "2. Ensure you have AWS CLI configured with appropriate permissions"
echo "3. Create an EC2 key pair named 'ventiapi-key' in us-west-1 region"
echo "4. Run: ./deploy/deploy-simple.sh"
echo
echo "The deployment will create:"
echo "  🌐 Scanner Application: http://[EC2-IP]:3000"
echo "  🤖 Cedar AI Dashboard: http://[EC2-IP]:3001" 
echo "  🔧 Mastra AI Backend: http://[EC2-IP]:4111"
echo
echo "Required AWS permissions:"
echo "  - EC2: create instances, security groups, key pairs"
echo "  - VPC: describe VPCs"
echo "  - Elastic IP: allocate and associate addresses"