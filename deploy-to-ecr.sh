#!/bin/bash

# Quick deployment script to push updated images to ECR
# Run this after making changes to push to AWS

set -e

# Configuration
export AWS_REGION="us-east-1"
export PROJECT_NAME="ventiapi-scanner"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🚀 Starting ECR deployment for ${PROJECT_NAME}..."
echo "Account: ${ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"

# Create ECR repositories if they don't exist
echo "📦 Setting up ECR repositories..."

# Frontend repository
aws ecr describe-repositories --repository-names ${PROJECT_NAME}/frontend --region ${AWS_REGION} 2>/dev/null || \
aws ecr create-repository --repository-name ${PROJECT_NAME}/frontend --region ${AWS_REGION}

# Backend repository
aws ecr describe-repositories --repository-names ${PROJECT_NAME}/backend --region ${AWS_REGION} 2>/dev/null || \
aws ecr create-repository --repository-name ${PROJECT_NAME}/backend --region ${AWS_REGION}

# Scanner repository
aws ecr describe-repositories --repository-names ${PROJECT_NAME}/scanner --region ${AWS_REGION} 2>/dev/null || \
aws ecr create-repository --repository-name ${PROJECT_NAME}/scanner --region ${AWS_REGION}

# ECR Login
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build and push frontend
echo "🏗️  Building and pushing frontend..."
docker build -t ${PROJECT_NAME}/frontend ./frontend
docker tag ${PROJECT_NAME}/frontend:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest

# Build and push backend
echo "🏗️  Building and pushing backend..."
docker build -t ${PROJECT_NAME}/backend ./scanner-service/web-api
docker tag ${PROJECT_NAME}/backend:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest

# Build and push scanner
echo "🏗️  Building and pushing scanner..."
docker build -t ${PROJECT_NAME}/scanner ./external-scanner/ventiapi-scanner
docker tag ${PROJECT_NAME}/scanner:latest ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest
docker push ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest

echo "✅ All images pushed to ECR successfully!"
echo ""
echo "📋 Image URIs:"
echo "Frontend: ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/frontend:latest"
echo "Backend:  ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/backend:latest"
echo "Scanner:  ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/scanner:latest"
echo ""

# Check if ECS cluster exists and offer to update services
if aws ecs describe-clusters --clusters ${PROJECT_NAME}-cluster --region ${AWS_REGION} &>/dev/null; then
    echo "🔄 ECS cluster found. Would you like to update the services? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
        echo "🚀 Updating ECS services..."
        
        # Update frontend service
        aws ecs update-service \
            --cluster ${PROJECT_NAME}-cluster \
            --service ${PROJECT_NAME}-frontend \
            --force-new-deployment \
            --region ${AWS_REGION} || echo "Frontend service not found"
        
        # Update backend service
        aws ecs update-service \
            --cluster ${PROJECT_NAME}-cluster \
            --service ${PROJECT_NAME}-backend \
            --force-new-deployment \
            --region ${AWS_REGION} || echo "Backend service not found"
        
        echo "✅ Services updated!"
    fi
else
    echo "ℹ️  No ECS cluster found. Use the full AWS deployment guide to set up infrastructure."
fi

echo "🎉 Deployment completed!"