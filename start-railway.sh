#!/bin/bash

echo "🚂 Deploying VentiAPI Scanner to Railway..."

# Colors for output
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}❌ $1${NC}"
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

print_status "Creating Railway project and web service..."

# Remove any existing configuration
rm -rf .railway 2>/dev/null || true

# Create project with unique name
TIMESTAMP=$(date +%s)
PROJECT_NAME="ventiapi-scanner-${TIMESTAMP}"
print_status "Initializing Railway project: $PROJECT_NAME"
railway init --name "$PROJECT_NAME"

# Deploy first to create the service
print_status "Initial deployment to create service..."
railway up --detach

# Wait for service to be created
sleep 5

# Link to the created service (it will have the same name as the project)
print_status "Linking to the created service..."
railway service "$PROJECT_NAME"

print_status "Setting up environment variables..."

# Check for environment configuration file
if [ -f ".env.deploy" ]; then
    print_status "Loading environment variables from .env.deploy..."
    
    # Read and set variables from .env.deploy
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z "$key" ]]; then
            continue
        fi
        
        # Remove any trailing comments and whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | sed 's/#.*//' | xargs)
        
        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^"//;s/"$//')
        
        if [[ -n "$key" && -n "$value" ]]; then
            print_status "Setting $key=$value"
            if railway variables --set "$key=$value"; then
                print_success "✓ Set $key"
            else
                print_error "✗ Failed to set $key"
            fi
        fi
    done < .env.deploy
    
    print_success "Environment variables loaded from .env.deploy"
    
    # Verify variables were set
    print_status "Verifying environment variables..."
    railway variables
    
elif [ -f ".env.local" ]; then
    print_warning "Using .env.local (consider creating .env.deploy for Railway deployment)"
    
    # Read and set variables from .env.local
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z "$key" ]]; then
            continue
        fi
        
        # Remove any trailing comments and whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | sed 's/#.*//' | xargs)
        
        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^"//;s/"$//')
        
        if [[ -n "$key" && -n "$value" ]]; then
            print_status "Setting $key..."
            railway variables --set "$key=$value"
        fi
    done < .env.local
    
    print_success "Environment variables loaded from .env.local"
    
else
    print_warning "No environment file found, generating default variables..."
    
    # Set default environment variables using new CLI syntax
    railway variables --set "JWT_SECRET=$(openssl rand -base64 32)"
    railway variables --set "DEFAULT_ADMIN_USERNAME=admin"
    railway variables --set "DEFAULT_ADMIN_PASSWORD=$(openssl rand -base64 12)"
    railway variables --set "REDIS_URL=redis://localhost:6379"
    railway variables --set "SCANNER_MAX_PARALLEL_CONTAINERS=3"
    railway variables --set "SCANNER_CONTAINER_MEMORY_LIMIT=512m"
    
    print_success "Default environment variables configured"
fi

# Always set these Railway-specific variables
railway variables --set "PYTHONUNBUFFERED=1"

# Final deployment with environment variables
print_status "Final deployment with configuration..."
railway up

print_success "🎉 Deployment complete!"

# Generate a domain for the service
print_status "Creating external domain..."
railway domain generate

# Wait a moment for domain to be created
sleep 3

# Get and display the URL
print_status "Getting your app URL..."
APP_URL=$(railway domain 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1)

if [ -n "$APP_URL" ]; then
    print_success "🌐 Your VentiAPI Scanner is live at: $APP_URL"
    echo ""
    echo "📍 Access points:"
    echo "   • Application: $APP_URL"
    echo "   • API Health:  $APP_URL/health"
    echo "   • API Docs:    $APP_URL/api/docs"
else
    print_warning "Domain not found. Generate manually with: railway domain generate"
fi

echo ""
echo "📊 Monitor deployment: railway logs"
echo "⚙️  View variables: railway variables"

print_success "Railway deployment complete! 🚀"