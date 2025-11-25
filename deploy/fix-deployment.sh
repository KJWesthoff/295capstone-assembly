#!/bin/bash

# VentiAPI Scanner - Deployment Fix Script
# This script fixes common deployment issues on the EC2 instance

set -e

REGION="us-west-1"
KEY_PAIR_NAME="ventiapi-key"

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

# Get instance IP from AWS
get_instance_info() {
    print_status "Finding VentiAPI Scanner instance..."
    
    INSTANCE_INFO=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running,stopped" \
        --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress]' \
        --output text | head -1)
    
    if [ -z "$INSTANCE_INFO" ]; then
        print_error "No VentiAPI Scanner instance found"
        exit 1
    fi
    
    INSTANCE_ID=$(echo "$INSTANCE_INFO" | awk '{print $1}')
    INSTANCE_STATE=$(echo "$INSTANCE_INFO" | awk '{print $2}')
    PUBLIC_IP=$(echo "$INSTANCE_INFO" | awk '{print $3}')
    
    print_status "Found instance: $INSTANCE_ID ($INSTANCE_STATE) at $PUBLIC_IP"
}

# Start instance if stopped
start_instance_if_needed() {
    if [ "$INSTANCE_STATE" = "stopped" ]; then
        print_warning "Instance is stopped. Starting it..."
        aws ec2 start-instances --region $REGION --instance-ids $INSTANCE_ID
        print_status "Waiting for instance to be running..."
        aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
        
        # Get new IP after restart
        PUBLIC_IP=$(aws ec2 describe-instances \
            --region $REGION \
            --instance-ids $INSTANCE_ID \
            --query 'Reservations[0].Instances[0].PublicIpAddress' \
            --output text)
        
        print_success "Instance is now running at $PUBLIC_IP"
        
        # Wait for SSH to be available
        print_status "Waiting for SSH to be available..."
        sleep 60
    fi
}

# Fix Docker Compose issues and restart services
fix_services() {
    print_status "Connecting to instance to fix services..."
    
    # Test SSH connectivity first
    for i in {1..10}; do
        if ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$PUBLIC_IP "echo 'SSH ready'" 2>/dev/null; then
            break
        fi
        echo "Waiting for SSH... ($i/10)"
        sleep 15
    done
    
    print_status "Fixing services on remote instance..."
    
    ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

echo "🔧 Starting service repair process..."

# Ensure we're in the right directory
cd /opt/ventiapi

# Check if required files exist
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in /opt/ventiapi"
    exit 1
fi

# Make sure Docker is running
echo "🐳 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Stop all containers first
echo "🛑 Stopping existing containers..."
newgrp docker << 'DOCKEREOF'
cd /opt/ventiapi
docker-compose down || true
docker container prune -f
DOCKEREOF

# Wait a moment
sleep 5

# Restart services with proper ordering
echo "🚀 Starting services..."
newgrp docker << 'DOCKEREOF'
cd /opt/ventiapi

# Start infrastructure services first
echo "Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 30

# Try to restore database
if [ -f "database-restore.sh" ]; then
    echo "📊 Restoring database..."
    chmod +x database-restore.sh
    ./database-restore.sh || echo "Database restore failed, continuing..."
fi

# Start remaining services
echo "Starting application services..."
docker-compose up -d

# Show status
echo "📋 Service status:"
docker-compose ps

# Check ports
echo "🌐 Checking listening ports:"
ss -tlnp | grep -E "(3000|3001|4111|8000)" || echo "No application ports listening yet"

DOCKEREOF

echo "✅ Service repair complete!"
echo "🌐 Application should be available at:"
echo "   Scanner: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
echo "   Cedar Dashboard: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001"
echo "   Mastra Backend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):4111"
EOF
    
    print_success "Service repair completed!"
}

# Test connectivity after fix
test_services() {
    print_status "Testing service connectivity..."
    
    # Wait for services to start
    sleep 30
    
    services=(
        "3000:Scanner Application"
        "3001:Cedar Dashboard"
        "4111:Mastra Backend"
        "8000:API Backend"
    )
    
    for service in "${services[@]}"; do
        port=$(echo $service | cut -d: -f1)
        name=$(echo $service | cut -d: -f2)
        
        if curl -I --connect-timeout 10 http://$PUBLIC_IP:$port >/dev/null 2>&1; then
            print_success "$name (port $port) is responding"
        else
            print_warning "$name (port $port) is not responding yet"
        fi
    done
}

# Main execution
main() {
    echo "🛠️  VentiAPI Scanner - Deployment Fix"
    echo "====================================="
    echo
    
    get_instance_info
    start_instance_if_needed
    fix_services
    test_services
    
    echo
    print_success "🎉 Deployment fix complete!"
    echo
    echo "Application URLs:"
    echo "  🌐 Scanner: http://$PUBLIC_IP:3000"
    echo "  🤖 Cedar Dashboard: http://$PUBLIC_IP:3001"
    echo "  🔧 Mastra Backend: http://$PUBLIC_IP:4111"
    echo
    echo "If services are still not responding, check logs with:"
    echo "  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose logs'"
}

main "$@"