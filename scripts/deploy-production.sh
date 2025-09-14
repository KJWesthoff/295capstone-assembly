#!/bin/bash

# Production Deployment Script with AWS Secrets Manager Integration
# This script fetches secrets from AWS Secrets Manager and deploys the application

set -e

echo "🚀 Starting Production Deployment..."

# Configuration
SECRET_NAME="${SECRET_NAME:-scanner-app-secrets}"
AWS_REGION="${AWS_REGION:-us-east-1}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install it first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
echo "🔐 Verifying AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ Error: AWS credentials not configured or invalid."
    echo "Please configure AWS credentials using one of the following methods:"
    echo "  - aws configure"
    echo "  - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
    echo "  - IAM roles (if running on EC2)"
    exit 1
fi

echo "✅ AWS credentials verified"

# Fetch secrets from AWS Secrets Manager
echo "🔑 Fetching secrets from AWS Secrets Manager..."
source ./scripts/fetch-secrets.sh

if [ $? -ne 0 ]; then
    echo "❌ Failed to fetch secrets. Deployment aborted."
    exit 1
fi

# Verify required environment variables are set
echo "🔍 Verifying required environment variables..."

required_vars=("JWT_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '  - %s\n' "${missing_vars[@]}"
    echo "Please ensure these variables are set in your AWS Secrets Manager secret."
    exit 1
fi

echo "✅ All required environment variables verified"

# Stop existing containers if running
echo "🛑 Stopping existing containers..."
docker compose down --remove-orphans || true

# Pull latest images (if using remote images)
echo "📥 Pulling latest images..."
docker compose pull || true

# Build and start the application
echo "🏗️  Building and starting the application..."
docker compose -f "$COMPOSE_FILE" up --build -d

if [ $? -eq 0 ]; then
    echo "✅ Application started successfully!"
    
    # Wait a moment for containers to fully start
    echo "⏳ Waiting for containers to start..."
    sleep 10
    
    # Check container health
    echo "🏥 Checking container health..."
    docker compose ps
    
    # Get the status of all containers
    if docker compose ps | grep -q "unhealthy\|exited"; then
        echo "⚠️  Warning: Some containers may not be healthy"
        echo "Check logs with: docker compose logs"
    else
        echo "✅ All containers are running"
    fi
    
    echo ""
    echo "🎉 Production deployment completed successfully!"
    echo ""
    echo "📊 Container Status:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📝 To view logs: docker compose logs -f"
    echo "🛑 To stop: docker compose down"
    
else
    echo "❌ Deployment failed. Check the logs for more details:"
    docker compose logs
    exit 1
fi