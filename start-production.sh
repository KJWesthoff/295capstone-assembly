#!/bin/bash

echo "🚀 Starting VentiAPI Scanner Production Environment with Nginx Proxy..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check for production environment file
if [ -f ".env.deploy" ]; then
    print_status "Using .env.deploy for production configuration"
    ENV_FILE=".env.deploy"
elif [ -f ".env.local" ]; then
    print_warning "Using .env.local (consider creating .env.deploy for production)"
    ENV_FILE=".env.local"
else
    print_warning "No environment file found, using default values"
    ENV_FILE=""
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose and try again."
    exit 1
fi

# Load environment variables
if [ -f .env.local ]; then
    print_status "Loading environment variables from .env.local..."
    set -a
    source .env.local
    set +a
    print_success "Loaded credentials:"
    echo "   Admin Username: ${DEFAULT_ADMIN_USERNAME}"
    echo "   Admin Password: ${DEFAULT_ADMIN_PASSWORD}"
    echo "   JWT Secret: ${JWT_SECRET:0:20}..."
else
    print_warning "No .env.local file found. Using default environment variables."
    export JWT_SECRET="dev-secret-change-in-production"
    export DEFAULT_ADMIN_USERNAME="admin"
    export DEFAULT_ADMIN_PASSWORD="admin123"
fi

# Set default values for other environment variables
export SCANNER_MAX_PARALLEL_CONTAINERS=${SCANNER_MAX_PARALLEL_CONTAINERS:-5}
export SCANNER_CONTAINER_MEMORY_LIMIT=${SCANNER_CONTAINER_MEMORY_LIMIT:-1g}

# Create shared directories if they don't exist
print_status "Creating shared directories..."
mkdir -p shared/results shared/specs
chmod 755 shared/results shared/specs
print_success "Shared directories created"

# Stop existing containers
print_status "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# The scanner image will be built automatically as part of the dependency chain

# Build and start all services
print_status "Building and starting all services with Nginx proxy..."
if [ -n "$ENV_FILE" ]; then
    docker compose --env-file "$ENV_FILE" up --build -d
else
    docker compose up --build -d
fi

# Check if services started successfully
sleep 5

# Verify nginx is running
if docker compose ps nginx | grep -q "Up"; then
    print_success "Nginx reverse proxy is running"
else
    print_error "Nginx failed to start"
    docker compose logs nginx
    exit 1
fi

# Verify backend is healthy
print_status "Checking backend health..."
for i in {1..30}; do
    if curl -s http://localhost/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
        break
    elif [ $i -eq 30 ]; then
        print_error "Backend health check failed after 30 attempts"
        print_status "Backend logs:"
        docker compose logs web-api --tail=20
        exit 1
    else
        echo -n "."
        sleep 2
    fi
done

# Show running services
print_status "Running services:"
docker compose ps

# Show access information
echo ""
print_success "🎉 VentiAPI Scanner is now running with Nginx reverse proxy!"
echo ""
echo "📍 Access points:"
echo "   • Application: http://localhost"
echo "   • API Health:  http://localhost/health"
echo "   • API Docs:    http://localhost/api/docs"
echo ""
echo "🔧 Service details:"
echo "   • Nginx Proxy: Port 80 (main entry point)"
echo "   • Frontend:    Internal access via nginx"
echo "   • Backend:     Internal access via nginx (/api routes)"
echo "   • Redis:       Internal access only"
echo ""
echo "📊 Monitoring:"
echo "   • View logs: docker compose logs [service-name]"
echo "   • View status: docker compose ps"
echo "   • Stop services: docker compose down"
echo ""
echo "🔐 Default login:"
echo "   • Username: ${DEFAULT_ADMIN_USERNAME}"
echo "   • Password: ${DEFAULT_ADMIN_PASSWORD}"
echo ""

# Show nginx logs briefly to verify everything is working
print_status "Recent nginx logs:"
docker compose logs nginx --tail=5

print_success "Setup complete! Visit http://localhost to start using the application."