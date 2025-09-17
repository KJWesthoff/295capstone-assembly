#!/bin/bash

echo "🚂 Deploying VentiAPI Scanner to Railway..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    print_warning "Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    print_status "Please log in to Railway:"
    railway login
fi

print_status "Creating Railway project..."

# Check if already linked to a project
if [ ! -f ".railway/project.json" ]; then
    print_status "Initializing new Railway project..."
    railway init
fi

print_status "Setting up environment variables..."

# Set environment variables using new CLI syntax
railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"
railway variables --set "DEFAULT_ADMIN_USERNAME=admin"
railway variables --set "DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 12)"
railway variables --set "REDIS_URL=redis://localhost:6379"
railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=3"
railway variables --set "SCANNER_CONTAINER_MEMORY_LIMIT=512m"
railway variables --set "PYTHONUNBUFFERED=1"

print_success "Environment variables configured"

print_status "Deploying to Railway..."

# Deploy using the Railway Dockerfile - Railway now uses railway.json for dockerfile config
railway up

print_success "🎉 Deployment started!"
echo ""
print_status "Your VentiAPI Scanner is being deployed..."
echo "📊 Monitor deployment: railway logs"
echo "🌐 Get your URL: railway domain"
echo "⚙️  View variables: railway variables"
echo ""

# Wait a moment then show the URL
sleep 5
railway domain 2>/dev/null || echo "💡 Run 'railway domain' to get your app URL"

print_success "Deployment complete! 🚀"