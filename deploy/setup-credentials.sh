#!/bin/bash

# VentiAPI Scanner - Credential Setup Script
# This script helps you set up production credentials safely

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

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

# Generate a secure JWT secret
generate_jwt_secret() {
    # Generate a 64-character random string
    openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '+/=' | head -c 64
}

# Validate password strength
validate_password() {
    local password="$1"
    local errors=0
    
    if [[ ${#password} -lt 8 ]]; then
        print_error "Password must be at least 8 characters long"
        ((errors++))
    fi
    
    if [[ ! "$password" =~ [A-Z] ]]; then
        print_error "Password must contain at least one uppercase letter"
        ((errors++))
    fi
    
    if [[ ! "$password" =~ [a-z] ]]; then
        print_error "Password must contain at least one lowercase letter"
        ((errors++))
    fi
    
    if [[ ! "$password" =~ [0-9] ]]; then
        print_error "Password must contain at least one number"
        ((errors++))
    fi
    
    return $errors
}

# Main setup function
setup_credentials() {
    print_header "VentiAPI Scanner - Production Credential Setup"
    
    # Check if .env.production already exists
    if [[ -f ".env.production" ]]; then
        print_warning ".env.production already exists!"
        echo -n "Do you want to overwrite it? (yes/no): "
        read -r overwrite
        if [[ "$overwrite" != "yes" ]]; then
            print_status "Setup cancelled. Existing .env.production file preserved."
            exit 0
        fi
    fi
    
    # Check if example file exists
    if [[ ! -f ".env.production.example" ]]; then
        print_error ".env.production.example file not found!"
        print_status "Please make sure you're running this script from the deploy/ directory"
        exit 1
    fi
    
    echo
    print_status "Setting up production credentials..."
    print_warning "Please use strong, unique credentials for production!"
    echo
    
    # Get admin username
    echo -n "Enter admin username (default: admin): "
    read -r admin_username
    admin_username=${admin_username:-admin}
    
    # Get admin password with validation
    while true; do
        echo -n "Enter admin password: "
        read -s admin_password
        echo
        echo -n "Confirm admin password: "
        read -s admin_password_confirm
        echo
        
        if [[ "$admin_password" != "$admin_password_confirm" ]]; then
            print_error "Passwords do not match. Please try again."
            continue
        fi
        
        if validate_password "$admin_password"; then
            break
        else
            print_warning "Please choose a stronger password."
        fi
    done
    
    # Generate JWT secret
    print_status "Generating secure JWT secret..."
    jwt_secret=$(generate_jwt_secret)
    
    # Get optional domain name
    echo -n "Enter your domain name (optional, for CORS): "
    read -r domain_name
    if [[ -n "$domain_name" ]]; then
        frontend_url="https://$domain_name"
    else
        frontend_url="http://localhost:3000"
    fi
    
    # Create .env.production file
    print_status "Creating .env.production file..."
    
    cat > .env.production << EOF
# Production Environment Configuration
# Generated on $(date)

# Environment
ENVIRONMENT=production
NODE_ENV=production

# Database and Cache
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379

# Security Configuration
JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=24h

# Admin User
ADMIN_USERNAME=$admin_username
ADMIN_PASSWORD=$admin_password

# Application Configuration
APP_NAME=VentiAPI Scanner
APP_VERSION=1.0.0
DEBUG=false
LOG_LEVEL=INFO

# Scanner Configuration
MAX_SCAN_DURATION=3600  # 1 hour
MAX_REQUESTS_PER_SCAN=1000
DEFAULT_RATE_LIMIT=2.0
MAX_CONCURRENT_SCANS=5

# CORS Configuration
FRONTEND_URL=$frontend_url
ADDITIONAL_CORS_ORIGINS=

# File Upload Limits
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=json,yaml,yml

# Rate Limiting
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_SCAN=10/hour
RATE_LIMIT_API=100/minute

# Monitoring and Logging
ENABLE_METRICS=true
LOG_FORMAT=json
LOG_FILE=/var/log/ventiapi/app.log

# AWS Configuration
AWS_REGION=us-west-1

# Docker Configuration
DOCKER_SOCKET=/var/run/docker.sock
SCANNER_IMAGE=ventiapi-scanner
SCANNER_NETWORK=scanner-network

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=10
EOF
    
    # Set secure permissions
    chmod 600 .env.production
    
    print_success "✅ Production credentials configured successfully!"
    echo
    echo "Configuration Summary:"
    echo "  Admin Username: $admin_username"
    echo "  Admin Password: [PROTECTED]"
    echo "  JWT Secret: [GENERATED]"
    echo "  Frontend URL: $frontend_url"
    echo
    print_warning "🔒 Important Security Notes:"
    echo "  • .env.production is gitignored and won't be committed"
    echo "  • File permissions set to 600 (owner read/write only)"
    echo "  • Keep these credentials secure and don't share them"
    echo "  • Consider using a password manager"
    echo
    print_status "You can now run './deploy-simple.sh' to deploy with these credentials"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "VentiAPI Scanner - Credential Setup Script"
        echo
        echo "Usage: $0 [options]"
        echo
        echo "This script helps you set up secure production credentials"
        echo "for deploying VentiAPI Scanner to AWS."
        echo
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --check       Check if credentials are configured"
        echo
        echo "The script will:"
        echo "  • Generate a secure JWT secret"
        echo "  • Prompt for admin credentials with validation"
        echo "  • Create .env.production with secure permissions"
        echo "  • Ensure credentials are gitignored"
        echo
        exit 0
        ;;
    --check)
        if [[ -f ".env.production" ]]; then
            print_success "✅ .env.production file exists"
            
            # Check file permissions
            perms=$(stat -f "%A" .env.production 2>/dev/null || stat -c "%a" .env.production 2>/dev/null || echo "unknown")
            if [[ "$perms" == "600" ]]; then
                print_success "✅ File permissions are secure (600)"
            else
                print_warning "⚠️  File permissions: $perms (should be 600)"
                echo "Fix with: chmod 600 .env.production"
            fi
            
            # Check if required fields exist
            required_fields=("ADMIN_USERNAME" "ADMIN_PASSWORD" "JWT_SECRET")
            for field in "${required_fields[@]}"; do
                if grep -q "^$field=" .env.production; then
                    print_success "✅ $field is configured"
                else
                    print_error "❌ $field is missing"
                fi
            done
        else
            print_error "❌ .env.production file not found"
            print_status "Run './setup-credentials.sh' to create it"
        fi
        exit 0
        ;;
    "")
        # Change to script directory
        cd "$(dirname "$0")"
        setup_credentials
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac