#!/bin/bash

# VentiAPI Scanner - Simple AWS Deployment Script
# This script creates an EC2 instance directly without CloudFormation
#
# Usage: ./deploy-simple.sh [AWS_PROFILE]
#   AWS_PROFILE: Optional AWS CLI profile name (e.g., 'ventiapi', 'production')
#                If not provided, uses AWS_PROFILE environment variable or 'default'

set -e

# Parse arguments
AWS_PROFILE_ARG="${1:-${AWS_PROFILE:-default}}"
export AWS_PROFILE="$AWS_PROFILE_ARG"

# Configuration
REGION="us-west-1"
INSTANCE_TYPE="t3.medium"
KEY_PAIR_NAME="ventiapi-key"
AMI_ID="ami-00142eb1747a493d9"  # Amazon Linux 2023 (us-west-1)

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check AWS CLI
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    print_status "Using AWS Profile: ${AWS_PROFILE}"

    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured for profile '${AWS_PROFILE}'"
        print_error "Run: aws configure --profile ${AWS_PROFILE}"
        exit 1
    fi

    # Show which AWS account we're deploying to
    ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    USER_ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
    print_success "AWS CLI configured"
    print_status "Account: ${ACCOUNT_ID}"
    print_status "Identity: ${USER_ARN}"
}

# Create security group
create_security_group() {
    print_status "Creating security group..."
    
    # Get default VPC ID
    VPC_ID=$(aws ec2 describe-vpcs --region $REGION --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text)
    
    if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
        print_error "No default VPC found. You may need to create one first."
        exit 1
    fi
    
    print_status "Using default VPC: $VPC_ID"
    
    # Check if security group already exists
    SG_ID=$(aws ec2 describe-security-groups --region $REGION --filters "Name=group-name,Values=ventiapi-scanner" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
    
    if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
        # Create security group
        SG_ID=$(aws ec2 create-security-group \
            --region $REGION \
            --group-name ventiapi-scanner \
            --description "VentiAPI Scanner Security Group" \
            --vpc-id $VPC_ID \
            --query 'GroupId' \
            --output text)
        
        # Add rules
        aws ec2 authorize-security-group-ingress \
            --region $REGION \
            --group-id $SG_ID \
            --protocol tcp \
            --port 22 \
            --cidr 0.0.0.0/0
        
        aws ec2 authorize-security-group-ingress \
            --region $REGION \
            --group-id $SG_ID \
            --protocol tcp \
            --port 3000 \
            --cidr 0.0.0.0/0
        
        aws ec2 authorize-security-group-ingress \
            --region $REGION \
            --group-id $SG_ID \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0
        
        aws ec2 authorize-security-group-ingress \
            --region $REGION \
            --group-id $SG_ID \
            --protocol tcp \
            --port 3001 \
            --cidr 0.0.0.0/0
        
        aws ec2 authorize-security-group-ingress \
            --region $REGION \
            --group-id $SG_ID \
            --protocol tcp \
            --port 4111 \
            --cidr 0.0.0.0/0
        
        print_success "Created security group: $SG_ID"
    else
        print_success "Using existing security group: $SG_ID"
    fi
}

# Check for existing instances
check_existing_instances() {
    print_status "Checking for existing VentiAPI Scanner instances..."
    
    # Check for running instances
    existing_instances=$(aws ec2 describe-instances \
        --region $REGION \
        --filters "Name=tag:Name,Values=VentiAPI-Scanner" "Name=instance-state-name,Values=running,pending" \
        --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress]' \
        --output text)
    
    if [ -n "$existing_instances" ]; then
        echo
        print_warning "Found existing VentiAPI Scanner instances:"
        echo "$existing_instances"
        echo
        echo "Options:"
        echo "1. Use existing instance (recommended)"
        echo "2. Create new instance (will incur additional costs)"
        echo "3. Terminate existing and create new"
        echo "4. Exit"
        echo
        echo -n "Choose option (1-4): "
        read -r choice
        
        case $choice in
            1)
                # Use existing instance
                INSTANCE_ID=$(echo "$existing_instances" | head -1 | awk '{print $1}')
                PUBLIC_IP=$(echo "$existing_instances" | head -1 | awk '{print $3}')
                if [ "$PUBLIC_IP" = "None" ]; then
                    # Get Elastic IP if available
                    PUBLIC_IP=$(aws ec2 describe-addresses \
                        --region $REGION \
                        --filters "Name=instance-id,Values=$INSTANCE_ID" \
                        --query 'Addresses[0].PublicIp' \
                        --output text)
                fi
                print_success "Using existing instance: $INSTANCE_ID ($PUBLIC_IP)"
                return 0
                ;;
            2)
                print_status "Creating new instance (additional costs will apply)..."
                return 1
                ;;
            3)
                print_status "Terminating existing instances..."
                echo "$existing_instances" | while read -r line; do
                    if [ -n "$line" ]; then
                        inst_id=$(echo "$line" | awk '{print $1}')
                        aws ec2 terminate-instances --region $REGION --instance-ids $inst_id
                        print_status "Terminated: $inst_id"
                    fi
                done
                print_status "Waiting for termination to complete..."
                sleep 30
                return 1
                ;;
            4)
                print_status "Deployment cancelled"
                exit 0
                ;;
            *)
                print_error "Invalid choice. Exiting."
                exit 1
                ;;
        esac
    else
        print_status "No existing instances found. Creating new instance..."
        return 1
    fi
}

# Create EC2 instance
create_instance() {
    print_status "Creating EC2 instance..."
    
    # User data script
    USER_DATA=$(cat << 'EOF'
#!/bin/bash
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install Git
yum install -y git

# Create application directory
mkdir -p /opt/ventiapi
chown ec2-user:ec2-user /opt/ventiapi

# Create data directories
mkdir -p /opt/ventiapi/data/{results,specs,redis,postgres}
chown -R ec2-user:ec2-user /opt/ventiapi/data

# Create log directory
mkdir -p /var/log/ventiapi
chown ec2-user:ec2-user /var/log/ventiapi

# Create ready file
echo "$(date): Instance ready for deployment" > /tmp/deployment-ready
EOF
)

    # Launch instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --region $REGION \
        --image-id $AMI_ID \
        --instance-type $INSTANCE_TYPE \
        --key-name $KEY_PAIR_NAME \
        --security-group-ids $SG_ID \
        --user-data "$USER_DATA" \
        --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
        --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=VentiAPI-Scanner}]' \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    print_success "Created instance: $INSTANCE_ID"
    
    # Wait for instance to be running
    print_status "Waiting for instance to be running..."
    aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
    
    # Allocate and associate Elastic IP
    print_status "Allocating Elastic IP..."
    ALLOCATION_ID=$(aws ec2 allocate-address \
        --region $REGION \
        --domain vpc \
        --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=VentiAPI-EIP}]' \
        --query 'AllocationId' \
        --output text)
    
    aws ec2 associate-address \
        --region $REGION \
        --instance-id $INSTANCE_ID \
        --allocation-id $ALLOCATION_ID

    # Wait for Elastic IP association to propagate
    print_status "Waiting for Elastic IP association to propagate..."
    sleep 60

    # Get public IP
    PUBLIC_IP=$(aws ec2 describe-addresses \
        --region $REGION \
        --allocation-ids $ALLOCATION_ID \
        --query 'Addresses[0].PublicIp' \
        --output text)

    print_success "Elastic IP allocated and associated: $PUBLIC_IP"
}

# Deploy application
deploy_application() {
    print_status "Waiting for instance initialization to complete..."
    sleep 120  # Wait for user data script to complete
    
    print_status "Testing SSH connectivity..."
    # Wait for SSH to be available
    for i in {1..30}; do
        if ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ec2-user@$PUBLIC_IP "echo 'SSH ready'" 2>/dev/null; then
            break
        fi
        echo "Waiting for SSH... ($i/30)"
        sleep 10
    done
    
    print_status "Uploading application code..."
    
    # Go to the parent directory (where docker-compose.yml should be)
    cd "$(dirname "$(dirname "$0")")"
    
    # Create a temporary deployment package excluding unnecessary files
    TEMP_DIR=$(mktemp -d)
    rsync -av \
        --exclude='deploy/' \
        --exclude='.git/' \
        --exclude='node_modules/' \
        --exclude='*.log' \
        --exclude='data/' \
        --exclude='results/' \
        . "$TEMP_DIR/"
    
    # Copy the production environment file as .env.local
    if [ -f "$(dirname "$0")/.env.production" ]; then
        cp "$(dirname "$0")/.env.production" "$TEMP_DIR/.env.local"
        print_status "Using credentials from .env.production file"
        
        # Show what credentials will be used (without showing passwords)
        if grep -q "ADMIN_USERNAME" "$(dirname "$0")/.env.production"; then
            ADMIN_USER=$(grep "ADMIN_USERNAME" "$(dirname "$0")/.env.production" | cut -d'=' -f2)
            print_status "Admin username will be: $ADMIN_USER"
        fi
    else
        print_warning ".env.production file not found, creating default .env.local"
        cat > "$TEMP_DIR/.env.local" << 'ENVEOF'
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
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password

# OpenAI Configuration (required for Cedar AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Database Configuration
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

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
    
    # Update Cedar .env file with public IP and actual values
    print_status "Configuring Cedar environment with public IP: $PUBLIC_IP"
    if [ -f "$TEMP_DIR/cedar-mastra/.env" ]; then
        # Read OpenAI key from local cedar-mastra/.env
        OPENAI_KEY=$(grep "^OPENAI_API_KEY=" cedar-mastra/.env | cut -d'=' -f2)
        GITHUB_TOKEN=$(grep "^GITHUB_TOKEN=" cedar-mastra/.env | cut -d'=' -f2 || echo "")
        MISTRAL_KEY=$(grep "^MISTRAL_API_KEY=" cedar-mastra/.env | cut -d'=' -f2 || echo "")

        # Create production cedar-mastra/.env with correct URLs
        cat > "$TEMP_DIR/cedar-mastra/.env" << CEDAREOF
# OpenAI API Key
OPENAI_API_KEY=${OPENAI_KEY}

# Model configuration
MODEL=gpt-4o-mini

# Mistral (optional)
MISTRAL_API_KEY=${MISTRAL_KEY}

# GitHub Token (for advisory ingestion - higher rate limits)
GITHUB_TOKEN=${GITHUB_TOKEN}

# Database configuration (SSL enabled for security)
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db?sslmode=require
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

# Scanner service URL (for Mastra backend - uses internal Docker network)
SCANNER_SERVICE_URL=http://web-api:8000

# Scanner credentials (for Mastra backend tools)
SCANNER_USERNAME=MICS295
SCANNER_PASSWORD=MaryMcHale

# Scanner service URL for frontend (uses public IP)
NEXT_PUBLIC_SCANNER_SERVICE_URL=
NEXT_PUBLIC_SCANNER_USERNAME=MICS295
NEXT_PUBLIC_SCANNER_PASSWORD=MaryMcHale

# Mastra backend URL (uses public IP)
NEXT_PUBLIC_MASTRA_URL=http://${PUBLIC_IP}:4111
CEDAREOF
        print_success "Updated cedar-mastra/.env with IP: $PUBLIC_IP"
    else
        print_warning "cedar-mastra/.env not found in deployment package"
    fi

    # Upload the application files
    scp -r -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no "$TEMP_DIR/"* ec2-user@$PUBLIC_IP:/opt/ventiapi/

    # Clean up temp directory
    rm -rf "$TEMP_DIR"

    print_status "Deploying application on remote server..."
    
    # Create and execute deployment script on remote server
    ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'EOF'
#!/bin/bash
set -e

echo "Starting application deployment..."

# Change to app directory
cd /opt/ventiapi

# Verify we have the required files
if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found!"
    exit 1
fi

# Create .env.local file with production values
echo "Creating .env.local file with production values..."

# Check if .env.local exists, if not create it from .env.production values
if [ ! -f ".env.local" ]; then
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

# OpenAI Configuration (required for Cedar AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Database Configuration
DATABASE_URL=postgresql://rag_user:rag_pass@postgres:5432/rag_db
POSTGRES_USER=rag_user
POSTGRES_PASSWORD=rag_pass
POSTGRES_DB=rag_db

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

echo "Environment file contents:"
cat .env.local

echo "Environment file created"

# Make sure Docker is running
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group if not already
sudo usermod -a -G docker ec2-user

# Build and start services (run with current user in docker group)
echo "Building and starting Docker services..."
newgrp docker << 'DOCKEREOF'
cd /opt/ventiapi
docker-compose down || true

# Build all services including Cedar components
echo "Building all services..."
docker-compose build

# Build scanner images explicitly (required for scans to work)
echo "Building scanner images..."
docker-compose --profile build-only build scanner || echo "Profile build failed, trying manual build..."
docker-compose --profile build-only build zap || echo "Profile build failed, trying manual build..."

# Fallback: build scanner images manually if profile approach failed
echo "Verifying scanner images..."
if ! docker images | grep -q "ventiapi-scanner"; then
    echo "VentiAPI scanner image missing, building manually..."
    docker build -t ventiapi-scanner -f scanner.Dockerfile .
fi

if ! docker images | grep -q "ventiapi-zap"; then
    echo "ZAP scanner image missing, building manually..."
    docker build -t ventiapi-zap -f zap.Dockerfile .
fi

docker images | grep -E "ventiapi-scanner|ventiapi-zap" || echo "WARNING: Scanner images may not have built correctly"

# Test that scanner images can be launched
echo "Testing scanner images..."
timeout 10s docker run --rm ventiapi-scanner --help >/dev/null 2>&1 && echo "✅ VentiAPI scanner working" || echo "❌ VentiAPI scanner failed"
timeout 10s docker run --rm ventiapi-zap --help >/dev/null 2>&1 && echo "✅ ZAP scanner working" || echo "❌ ZAP scanner failed"

# Start all services
echo "Starting all services..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose exec -T postgres pg_isready -U rag_user -d rag_db > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ PostgreSQL failed to become ready"
    exit 1
fi

# Step 1: Run migrations (create scanner schema)
echo ""
echo "📊 Step 1/2: Running database migrations..."
if [ -f "database/init/01-create-scanner-schema.sql" ]; then
    echo "   Applying 01-create-scanner-schema.sql..."
    docker-compose exec -T postgres psql -U rag_user -d rag_db < database/init/01-create-scanner-schema.sql
    echo "   ✅ Scanner schema created"
else
    echo "   ⚠️  Migration file not found: database/init/01-create-scanner-schema.sql"
fi

# Step 2: Restore database dumps
echo ""
echo "📥 Step 2/2: Restoring database from dumps..."
if [ -d "database/dumps" ] && [ -f "database/dumps/rag_db_latest.sql.gz" ]; then
    echo "   Found database dump: database/dumps/rag_db_latest.sql.gz"
    DUMP_SIZE=$(ls -lh database/dumps/rag_db_latest.sql.gz | awk '{print $5}')
    echo "   Dump size: $DUMP_SIZE"
    echo "   Decompressing and restoring (this may take a few minutes)..."

    gunzip -c database/dumps/rag_db_latest.sql.gz | docker-compose exec -T postgres psql -U rag_user -d rag_db > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "   ✅ Database restored successfully!"

        # Show table count
        echo ""
        echo "   📋 Restored tables:"
        docker-compose exec -T postgres psql -U rag_user -d rag_db -c "\dt" | head -20
    else
        echo "   ⚠️  Database restore encountered errors (may be due to existing data)"
    fi
else
    echo "   ℹ️  No database dump found, starting with fresh database"
    echo "   Expected location: database/dumps/rag_db_latest.sql.gz"
fi

echo ""
echo "✅ Database setup complete!"

DOCKEREOF

# Wait a moment for services to start
sleep 10

# Show status
echo "Checking service status..."
newgrp docker << 'STATUSEOF'
cd /opt/ventiapi
docker-compose ps
STATUSEOF

echo "Deployment complete!"
echo "Application should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
EOF
    
    print_success "Application deployed successfully!"
}

# Show final information
show_final_info() {
    # Get admin credentials from .env.production file
    ENV_FILE="$(dirname "$0")/.env.production"
    if [ -f "$ENV_FILE" ]; then
        ADMIN_USER=$(grep "ADMIN_USERNAME" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "admin")
        ADMIN_PASS=$(grep "ADMIN_PASSWORD" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "check .env.local")
    else
        ADMIN_USER="admin"
        ADMIN_PASS="check .env.local"
    fi
    
    echo
    print_success "🎉 VentiAPI Scanner Deployed Successfully!"
    echo
    echo "Instance Information:"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Public IP: $PUBLIC_IP"
    echo "  SSH Command: ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP"
    echo
    echo "Application Access:"
    echo "  🌐 Scanner Application: http://$PUBLIC_IP:3000"
    echo "  🤖 Cedar AI Dashboard: http://$PUBLIC_IP:3001"
    echo "  🔧 Mastra AI Backend: http://$PUBLIC_IP:4111"
    echo "  📚 API Documentation: http://$PUBLIC_IP:3000/api/docs"
    echo "  🔑 Admin Login: $ADMIN_USER / $ADMIN_PASS"
    echo
    echo "⚠️  IMPORTANT: Configure OpenAI API Key for Cedar AI Features:"
    echo "  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP"
    echo "  cd /opt/ventiapi && nano .env.local"
    echo "  # Set OPENAI_API_KEY=your-actual-api-key"
    echo "  docker-compose restart cedar-mastra"
    echo
    echo "Management Commands:"
    echo "  # Check application status"
    echo "  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose ps'"
    echo
    echo "  # View application logs"
    echo "  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose logs -f'"
    echo
    echo "  # Restart application"
    echo "  ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose restart'"
    echo
    echo "  # Update application"
    echo "  ./deploy-simple.sh  # Run this script again to update"
    echo
    print_success "Your VentiAPI Scanner is ready to use!"
}

# Main execution
main() {
    echo "🚀 VentiAPI Scanner - Simple AWS Deployment"
    echo "=========================================="
    echo
    
    check_aws_cli
    create_security_group
    
    # Check for existing instances first
    if check_existing_instances; then
        # Using existing instance - skip creation
        skip_creation=true
    else
        # Create new instance
        create_instance
        skip_creation=false
    fi
    
    deploy_application
    show_final_info
}

# Handle cleanup
cleanup() {
    if [ ! -z "$INSTANCE_ID" ]; then
        echo
        print_status "To cleanup resources later, run:"
        echo "aws ec2 terminate-instances --region $REGION --instance-ids $INSTANCE_ID"
        echo "aws ec2 release-address --region $REGION --allocation-id $ALLOCATION_ID"
        echo "aws ec2 delete-security-group --region $REGION --group-id $SG_ID"
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [AWS_PROFILE] [options]"
        echo
        echo "Arguments:"
        echo "  AWS_PROFILE   AWS CLI profile name (default: 'default' or \$AWS_PROFILE env var)"
        echo
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --cleanup     Show cleanup commands"
        echo
        echo "Examples:"
        echo "  $0 ventiapi              # Deploy using 'ventiapi' profile"
        echo "  $0                        # Deploy using default profile"
        echo "  AWS_PROFILE=prod $0      # Deploy using 'prod' profile from env"
        exit 0
        ;;
    --cleanup)
        print_status "Manual cleanup commands for AWS resources:"
        echo
        echo "# List all VentiAPI Scanner instances:"
        echo "aws ec2 describe-instances --region $REGION --filters 'Name=tag:Name,Values=VentiAPI-Scanner' --query 'Reservations[].Instances[].[InstanceId,PublicIpAddress,State.Name]' --output table"
        echo
        echo "# Terminate instance (replace INSTANCE_ID):"
        echo "aws ec2 terminate-instances --region $REGION --instance-ids INSTANCE_ID"
        echo
        echo "# Release Elastic IP (replace ALLOCATION_ID):"
        echo "aws ec2 release-address --region $REGION --allocation-id ALLOCATION_ID"
        echo
        echo "# Delete security group:"
        echo "aws ec2 delete-security-group --region $REGION --group-name ventiapi-scanner"
        exit 0
        ;;
    *)
        # Anything else is treated as a profile name or triggers main()
        main
        trap cleanup EXIT
        ;;
esac