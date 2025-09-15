#!/bin/bash

# Deploy updated images to the correct AWS region (us-west-1)
# This will fix the deployed scanner application

set -e

# Configuration for your actual AWS deployment
export AWS_REGION="us-west-1"  # Your deployment is in us-west-1
export PROJECT_NAME="ventiapi-scanner"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🚀 Deploying scanner fixes to AWS us-west-1..."
echo "Account: ${ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"

# ECR Login for us-west-1
echo "🔐 Logging into ECR us-west-1..."
aws ecr get-login-password --region ${AWS_REGION} | \
docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build and push frontend
echo "🏗️  Building and pushing FIXED frontend..."
docker build -t ${PROJECT_NAME}/frontend ./frontend
docker tag ${PROJECT_NAME}/frontend:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest

# Build and push backend  
echo "🏗️  Building and pushing FIXED backend..."
docker build -t ${PROJECT_NAME}/backend ./scanner-service/web-api
docker tag ${PROJECT_NAME}/backend:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest

# Build and push scanner
echo "🏗️  Building and pushing FIXED scanner..."
docker build -t ${PROJECT_NAME}/scanner ./external-scanner/ventiapi-scanner
docker tag ${PROJECT_NAME}/scanner:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest

echo "✅ All FIXED images pushed to us-west-1!"
echo ""
echo "📋 Updated Image URIs:"
echo "Frontend: ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest"
echo "Backend:  ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest"
echo "Scanner:  ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest"
echo ""

# Force update ECS services to use new images
# Update IAM policy for ECS task management
echo "🔑 Updating IAM policy for ECS RunTask permissions..."
if aws iam get-role --role-name ventiapi-task-role 2>/dev/null; then
    echo "📋 Updating existing IAM policy..."
    aws iam put-role-policy \
        --role-name ventiapi-task-role \
        --policy-name ventiapi-scanner-policy \
        --policy-document file://policy.json \
        --region ${AWS_REGION}
else
    echo "⚠️  IAM role 'ventiapi-task-role' not found. Please create it manually or via CDK."
fi

echo "🔄 Forcing ECS services to update with new images..."

# Update frontend service
echo "📱 Updating frontend service..."
aws ecs update-service \
    --cluster ${PROJECT_NAME}-cluster \
    --service ventiapi-frontend-service \
    --force-new-deployment \
    --region ${AWS_REGION}

# Update backend service  
echo "🖥️  Updating backend service..."
aws ecs update-service \
    --cluster ${PROJECT_NAME}-cluster \
    --service ventiapi-backend-service \
    --force-new-deployment \
    --region ${AWS_REGION}

echo ""
echo "⏳ Services are updating. Check status:"
echo "Frontend: aws ecs describe-services --cluster ${PROJECT_NAME}-cluster --services ventiapi-frontend-service --region ${AWS_REGION}"
echo "Backend:  aws ecs describe-services --cluster ${PROJECT_NAME}-cluster --services ventiapi-backend-service --region ${AWS_REGION}"
echo ""
echo "🌐 Test your deployment:"
echo "curl http://ventiapi-scanner-alb-610630590.us-west-1.elb.amazonaws.com/"
echo "curl http://ventiapi-scanner-alb-610630590.us-west-1.elb.amazonaws.com/api/health"
echo ""
echo "🎉 Deployment to AWS completed! Your fixes are now live!"
echo ""
echo "📝 IMPORTANT: Add these environment variables to your ECS task definition:"
echo "USE_AWS_SCANNER=true"
echo "ECS_CLUSTER_NAME=ventiapi-scanner-cluster"
echo "SCANNER_TASK_DEFINITION=ventiapi-scanner:latest"
echo "SUBNET_IDS=<your-subnet-ids>"
echo "SECURITY_GROUP_IDS=<your-security-group-ids>"
echo ""
echo "🔧 The scanner will now use AWS ECS RunTask instead of Docker commands!"