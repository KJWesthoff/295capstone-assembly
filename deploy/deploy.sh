#!/bin/bash

# VentiAPI Scanner - AWS Deployment Script
# This script deploys the application to AWS EC2 using CloudFormation

set -e  # Exit on any error

# Configuration
STACK_NAME="ventiapi-scanner"
REGION="us-west-1"
INSTANCE_TYPE="t3.medium"
KEY_PAIR_NAME=""  # Will be prompted if not set
ALLOWED_CIDR="0.0.0.0/0"  # Change to your IP for security
REPO_URL="https://github.com/yourusername/ventiapi-scanner.git"  # Update this

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if AWS CLI is installed and configured
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first:"
        echo "  curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
        echo "  unzip awscliv2.zip"
        echo "  sudo ./aws/install"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "AWS CLI is configured"
}

# Function to get or validate key pair
get_key_pair() {
    if [ -z "$KEY_PAIR_NAME" ]; then
        print_status "Available EC2 Key Pairs:"
        aws ec2 describe-key-pairs --region $REGION --query 'KeyPairs[].KeyName' --output table
        
        echo -n "Enter the name of your EC2 Key Pair: "
        read KEY_PAIR_NAME
        
        if [ -z "$KEY_PAIR_NAME" ]; then
            print_error "Key pair name is required"
            exit 1
        fi
    fi
    
    # Validate key pair exists
    if ! aws ec2 describe-key-pairs --region $REGION --key-names $KEY_PAIR_NAME &> /dev/null; then
        print_error "Key pair '$KEY_PAIR_NAME' not found in region $REGION"
        print_status "Create a key pair with: aws ec2 create-key-pair --key-name mykey --query 'KeyMaterial' --output text > mykey.pem"
        exit 1
    fi
    
    print_success "Key pair '$KEY_PAIR_NAME' found"
}

# Function to deploy CloudFormation stack
deploy_infrastructure() {
    print_status "Deploying CloudFormation stack..."
    
    # Check if stack exists
    if aws cloudformation describe-stacks --region $REGION --stack-name $STACK_NAME &> /dev/null; then
        print_status "Stack exists, updating..."
        aws cloudformation update-stack \
            --region $REGION \
            --stack-name $STACK_NAME \
            --template-body file://cloudformation-simple.yml \
            --parameters \
                ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE \
                ParameterKey=KeyPairName,ParameterValue=$KEY_PAIR_NAME \
                ParameterKey=AllowedCIDR,ParameterValue=$ALLOWED_CIDR \
            --capabilities CAPABILITY_IAM
        
        print_status "Waiting for stack update to complete..."
        aws cloudformation wait stack-update-complete --region $REGION --stack-name $STACK_NAME
    else
        print_status "Creating new stack..."
        aws cloudformation create-stack \
            --region $REGION \
            --stack-name $STACK_NAME \
            --template-body file://cloudformation-simple.yml \
            --parameters \
                ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE \
                ParameterKey=KeyPairName,ParameterValue=$KEY_PAIR_NAME \
                ParameterKey=AllowedCIDR,ParameterValue=$ALLOWED_CIDR \
            --capabilities CAPABILITY_IAM
        
        print_status "Waiting for stack creation to complete (this may take 10-15 minutes)..."
        aws cloudformation wait stack-create-complete --region $REGION --stack-name $STACK_NAME
    fi
    
    print_success "CloudFormation stack deployed successfully"
}

# Function to get stack outputs
get_stack_outputs() {
    print_status "Getting stack outputs..."
    
    INSTANCE_ID=$(aws cloudformation describe-stacks \
        --region $REGION \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
        --output text)
    
    PUBLIC_IP=$(aws cloudformation describe-stacks \
        --region $REGION \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
        --output text)
    
    APPLICATION_URL=$(aws cloudformation describe-stacks \
        --region $REGION \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`ApplicationURL`].OutputValue' \
        --output text)
    
    print_success "Instance ID: $INSTANCE_ID"
    print_success "Public IP: $PUBLIC_IP"
    print_success "Application URL: $APPLICATION_URL"
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application to EC2 instance..."
    
    # Wait for instance to be ready
    print_status "Waiting for instance to be ready..."
    aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
    
    # Wait a bit more for user data script to complete
    print_status "Waiting for instance initialization to complete..."
    sleep 120
    
    # Create deployment script
    cat > deploy_app.sh << EOF
#!/bin/bash
set -e

# Clone or update repository
if [ -d "/opt/ventiapi/.git" ]; then
    echo "Updating existing repository..."
    cd /opt/ventiapi
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL /opt/ventiapi
    cd /opt/ventiapi
fi

# Copy environment file
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "Created .env.local - please update with your configuration"
fi

# Build and start services
echo "Building and starting Docker services..."
docker-compose down || true
docker-compose build
docker-compose up -d

# Show status
echo "Deployment complete!"
echo "Application URL: http://\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
docker-compose ps
EOF
    
    # Copy and execute deployment script
    scp -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no deploy_app.sh ec2-user@$PUBLIC_IP:/tmp/
    ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP "chmod +x /tmp/deploy_app.sh && sudo /tmp/deploy_app.sh"
    
    # Cleanup
    rm deploy_app.sh
    
    print_success "Application deployed successfully"
}

# Function to show final information
show_final_info() {
    echo
    print_success "🎉 Deployment Complete!"
    echo
    echo "Instance Information:"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Public IP: $PUBLIC_IP"
    echo "  SSH Command: ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP"
    echo
    echo "Application Information:"
    echo "  Application URL: $APPLICATION_URL"
    echo "  API Documentation: $APPLICATION_URL/api/docs"
    echo
    echo "Management Commands:"
    echo "  View logs: ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose logs'"
    echo "  Restart app: ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && docker-compose restart'"
    echo "  Update app: ssh -i ~/.ssh/${KEY_PAIR_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/ventiapi && git pull && docker-compose up -d --build'"
    echo
    print_warning "Remember to update your .env.local file with proper configuration!"
}

# Main execution
main() {
    echo "🚀 VentiAPI Scanner - AWS Deployment"
    echo "===================================="
    echo
    
    # Change to deploy directory
    cd "$(dirname "$0")"
    
    # Pre-flight checks
    check_aws_cli
    get_key_pair
    
    # Deploy infrastructure
    deploy_infrastructure
    get_stack_outputs
    
    # Deploy application
    deploy_application
    
    # Show final information
    show_final_info
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --destroy           Destroy the CloudFormation stack"
        echo
        echo "Environment Variables:"
        echo "  STACK_NAME          CloudFormation stack name (default: ventiapi-scanner)"
        echo "  REGION              AWS region (default: us-east-1)"
        echo "  INSTANCE_TYPE       EC2 instance type (default: t3.medium)"
        echo "  KEY_PAIR_NAME       EC2 key pair name (will prompt if not set)"
        echo "  ALLOWED_CIDR        CIDR for security group (default: 0.0.0.0/0)"
        exit 0
        ;;
    --destroy)
        print_warning "This will destroy the entire CloudFormation stack and all resources!"
        echo -n "Are you sure? (yes/no): "
        read confirm
        if [ "$confirm" = "yes" ]; then
            print_status "Destroying CloudFormation stack..."
            aws cloudformation delete-stack --region $REGION --stack-name $STACK_NAME
            print_status "Waiting for stack deletion to complete..."
            aws cloudformation wait stack-delete-complete --region $REGION --stack-name $STACK_NAME
            print_success "Stack destroyed successfully"
        else
            print_status "Operation cancelled"
        fi
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        print_status "Use --help for usage information"
        exit 1
        ;;
esac